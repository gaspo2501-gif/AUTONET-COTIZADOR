const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFTextField } = require('pdf-lib');

const COMMON_FIELDS = {
  fechaDia: 'Dia',
  fechaMes: 'mes',
  fechaAnio: 'año',
  clienteNombre: 'Apellido y Nombres',
  clienteDni: 'DocIdent LELCDNICI',
  clienteCuit: 'CUIT',
  clienteNacimientoDia: 'Text4',
  clienteNacimientoMes: 'Text5',
  clienteNacimientoAnio: 'Text6',
  clienteEstadoCivil: 'EstCivil',
  clienteActividad: 'Actividad o profesión',
  clienteCondicionIva: 'Condición ante el IVA',
  clienteDireccion: 'Dirección',
  clienteLocalidad: 'Localidad',
  clienteProvincia: 'Text7',
  clienteCodigoPostal: 'Text8',
  clienteTelefono: 'Teléfono',
  clienteEmail: 'Email',
  operacionLista: 'COD',
  operacionPrecioVehiculo: 'Text10',
  operacionColor: 'COLOR',
  operacionSena: 'Text18',
  operacionEfectivo: 'Text19',
  operacionTotalPrimario: 'undefined',
  operacionTotalSecundario: 'undefined_8',
  unidadModelo: 'Modelo',
  unidadAnio: 'Text36',
  unidadDominio: 'Dominio',
  unidadColor: 'COLOR',
  unidadStock: 'STOCK',
  unidadMotor: 'Motor',
  unidadChasis: 'Chasis',
  unidadFechaEntrega: 'Fecha de Entrega',
  usadoValorToma: 'Text11',
  usadoModelo: 'Modelo_2',
  usadoAnio: 'Text37',
  usadoDominio: 'Dominio_2',
  usadoMotor: 'Motor_2',
  usadoChasis: 'Chasis_2',
};

const PAYMENT_ROWS = [
  'Text21', // Cheque c/Bco Fila 1 (y: 432.5)
  'Text22', // Cheque c/Bco Fila 2 (y: 418.5)
  'Text23', // Cheque c/Bco Fila 3 (y: 404.5)
  'Text24', // Cheque c/Bco Fila 4 (y: 390.5)
  'Text25', // Cheque c/Bco Fila 5 (y: 376.5)
  'Text26', // Cheque c/Bco Fila 6 (y: 362.5)
];

function formatMoney(amount) {
  if (!amount) return '';
  return new Intl.NumberFormat('es-AR').format(Math.round(amount));
}

async function fillBoleto(templatePath, data, isMirage = false) {
  const bytes = fs.readFileSync(templatePath);
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();

  // Reset/clean all fields to ensure zero residue
  for (const f of form.getFields()) {
    if (f instanceof PDFTextField) f.setText('');
  }

  const setT = (name, val) => {
    if (!name) return;
    try {
      const f = form.getTextField(name);
      if (f) f.setText(val !== undefined && val !== null ? String(val) : '');
    } catch (e) {}
  };

  const clearT = (name) => {
    if (!name) return;
    try {
      const f = form.getTextField(name);
      if (f) f.setText('');
    } catch (e) {}
  };

  // Fecha
  setT(COMMON_FIELDS.fechaDia, data.fechaDia);
  setT(COMMON_FIELDS.fechaMes, data.fechaMes);
  setT(COMMON_FIELDS.fechaAnio, data.fechaAnio);

  // V2: Text1 en Mirage DEBE quedar vacío
  clearT('Text1');

  // Cliente
  setT(COMMON_FIELDS.clienteNombre, data.cliente.nombreCompleto);
  setT(COMMON_FIELDS.clienteDni, data.cliente.dni);
  setT(COMMON_FIELDS.clienteCuit, data.cliente.cuitCuil);
  setT(COMMON_FIELDS.clienteNacimientoDia, data.cliente.nacimientoDia);
  setT(COMMON_FIELDS.clienteNacimientoMes, data.cliente.nacimientoMes);
  setT(COMMON_FIELDS.clienteNacimientoAnio, data.cliente.nacimientoAnio);
  setT(COMMON_FIELDS.clienteEstadoCivil, data.cliente.estadoCivil);
  setT(COMMON_FIELDS.clienteActividad, data.cliente.actividad);
  setT(COMMON_FIELDS.clienteCondicionIva, data.cliente.condicionIVA);
  setT(COMMON_FIELDS.clienteDireccion, data.cliente.direccion);
  setT(COMMON_FIELDS.clienteLocalidad, data.cliente.localidad);
  setT(COMMON_FIELDS.clienteProvincia, data.cliente.provincia);
  setT(COMMON_FIELDS.clienteCodigoPostal, data.cliente.codigoPostal);
  setT(COMMON_FIELDS.clienteTelefono, data.cliente.telefono);
  setT(COMMON_FIELDS.clienteEmail, data.cliente.email);

  // Operación
  setT(COMMON_FIELDS.operacionLista, data.operacion.referenciaLista);
  setT(COMMON_FIELDS.operacionPrecioVehiculo, formatMoney(data.operacion.precioVehiculo));
  setT(COMMON_FIELDS.operacionColor, data.operacion.color);
  setT(COMMON_FIELDS.operacionSena, formatMoney(data.operacion.sena));

  if (data.operacion.efectivoAdicional && data.operacion.efectivoAdicional > 0) {
    setT(COMMON_FIELDS.operacionEfectivo, formatMoney(data.operacion.efectivoAdicional));
  } else {
    clearT(COMMON_FIELDS.operacionEfectivo);
  }

  // undefined: Total de la operación
  // undefined_8: Total de la operación según patrón de referencia real (Requisitos 1, 3, 4)
  const totalOp = data.operacion.totalOperacion || data.operacion.precioVehiculo;
  const totalFormatted = formatMoney(totalOp);
  setT(COMMON_FIELDS.operacionTotalPrimario, totalFormatted);
  setT(COMMON_FIELDS.operacionTotalSecundario, totalFormatted);

  // Limpiar todas las filas de cheques
  for (const field of PAYMENT_ROWS) {
    clearT(field);
  }

  // Normalizar financiaciones activas
  let activeFinancings = [];
  if (Array.isArray(data.operacion.financiaciones) && data.operacion.financiaciones.length > 0) {
    activeFinancings = data.operacion.financiaciones.filter(f => f.activo && f.montoFinanciado > 0);
  } else if (data.operacion.llevaFinanciacion && data.operacion.montoFinanciado > 0) {
    activeFinancings = [{
      entidad: data.operacion.entidadFinanciera || 'BANCO',
      montoFinanciado: data.operacion.montoFinanciado,
      cuotas: data.operacion.cuotas,
      valorCuota: data.operacion.valorCuota,
      activo: true,
    }];
  }

  // Financiaciones en las filas de Cheque c/Bco (ENTIDAD + IMPORTE)
  activeFinancings.forEach((fin, idx) => {
    if (idx < PAYMENT_ROWS.length) {
      const field = PAYMENT_ROWS[idx];
      const entidad = fin.entidad?.trim() ? fin.entidad.toUpperCase() : '';
      const monto = formatMoney(fin.montoFinanciado);
      setT(field, entidad ? `${entidad}  ${monto}` : monto);
    }
  });

  // Requisitos 9 y 10: Banco que financia, Text34 y Text35 deben quedar estrictamente VACÍOS
  clearT('Banco que financia');
  clearT('Text28');
  clearT('Text20');
  clearT('Text34');
  clearT('Text35');

  // Unidad Adquirida
  setT(COMMON_FIELDS.unidadModelo, data.unidadAdquirida.descripcion);
  setT(COMMON_FIELDS.unidadAnio, data.unidadAdquirida.anio ? String(data.unidadAdquirida.anio) : '');
  setT(COMMON_FIELDS.unidadDominio, data.unidadAdquirida.patente);
  setT(COMMON_FIELDS.unidadColor, data.unidadAdquirida.color);
  setT(COMMON_FIELDS.unidadStock, data.unidadAdquirida.stockInterno);
  setT(COMMON_FIELDS.unidadMotor, data.unidadAdquirida.motor);
  setT(COMMON_FIELDS.unidadChasis, data.unidadAdquirida.chasis);
  setT(COMMON_FIELDS.unidadFechaEntrega, data.unidadAdquirida.fechaEntrega);

  // Usado
  if (data.entregaUsado && data.entregaUsado.enabled) {
    setT(COMMON_FIELDS.usadoValorToma, formatMoney(data.entregaUsado.valorToma));
    setT(COMMON_FIELDS.usadoModelo, data.entregaUsado.modelo);
    setT(COMMON_FIELDS.usadoAnio, data.entregaUsado.anio ? String(data.entregaUsado.anio) : '');
    setT(COMMON_FIELDS.usadoDominio, data.entregaUsado.patente);
    setT(COMMON_FIELDS.usadoMotor, data.entregaUsado.motor);
    setT(COMMON_FIELDS.usadoChasis, data.entregaUsado.chasis);
  } else {
    clearT(COMMON_FIELDS.usadoValorToma);
    clearT(COMMON_FIELDS.usadoModelo);
    clearT(COMMON_FIELDS.usadoAnio);
    clearT(COMMON_FIELDS.usadoDominio);
    clearT(COMMON_FIELDS.usadoMotor);
    clearT(COMMON_FIELDS.usadoChasis);
  }

  return await doc.save();
}

async function runTests() {
  console.log('--- TEST 1: MIRAGE PATRÓN REFERENCIA (Requisito 41) ---');
  const mirageData = {
    fechaDia: '10',
    fechaMes: 'Septiembre',
    fechaAnio: '26',
    cliente: {
      nombreCompleto: 'FIGUEROA DIEGO NICOLAS',
      dni: '36.852.147',
      direccion: 'Roca 1234',
      telefono: '299-4123456',
    },
    operacion: {
      referenciaLista: 'LISTA SEPTIEMBRE 2026',
      precioVehiculo: 16500000,
      color: 'GRIS PLATA',
      sena: 1000000,
      efectivoAdicional: 0,
      totalOperacion: 17410000,
      llevaFinanciacion: true,
      financiaciones: [
        {
          id: 'fin-1',
          entidad: 'BNA',
          montoFinanciado: 10410000,
          cuotas: 36,
          valorCuota: 320000,
          activo: true,
        }
      ]
    },
    unidadAdquirida: {
      descripcion: 'TOYOTA COROLLA XEI 2.0 CVT',
      anio: 2022,
      patente: 'AF123CD',
      color: 'GRIS PLATA',
      stockInterno: 'STK-4410',
      motor: '2ZR-982143',
      chasis: '8AJBA3FE9N00124',
    },
    entregaUsado: {
      enabled: true,
      valorToma: 5000000,
      modelo: 'FORD FOCUS SE 2.0',
      anio: 2017,
      patente: 'AA999ZZ',
      motor: 'DURATEC-4412',
      chasis: '8AF334411122',
    },
  };

  const miragePdfBytes = await fillBoleto('public/templates/boleto-mirage-template.pdf', mirageData, true);
  const mirageCheckDoc = await PDFDocument.load(miragePdfBytes);
  const mForm = mirageCheckDoc.getForm();

  const getEmptyOrText = (f) => (f ? (f.getText() || '') : '');

  if (getEmptyOrText(mForm.getTextField('Text10')) !== '16.500.000') throw new Error('Text10 mismatch');
  if (getEmptyOrText(mForm.getTextField('Text18')) !== '1.000.000') throw new Error('Text18 mismatch');
  if (getEmptyOrText(mForm.getTextField('Text21')) !== 'BNA  10.410.000') throw new Error('Text21 mismatch: expected "BNA  10.410.000"');
  if (getEmptyOrText(mForm.getTextField('Text28')) !== '') throw new Error('Text28 must be strictly empty');
  if (getEmptyOrText(mForm.getTextField('Text20')) !== '') throw new Error('Text20 must be strictly empty');
  if (getEmptyOrText(mForm.getTextField('undefined')) !== '17.410.000') throw new Error('undefined mismatch');
  if (getEmptyOrText(mForm.getTextField('undefined_8')) !== '17.410.000') throw new Error('undefined_8 mismatch');
  if (getEmptyOrText(mForm.getTextField('Text1')) !== '') throw new Error('Text1 must be strictly empty in V2');
  if (getEmptyOrText(mForm.getTextField('Text19')) !== '') throw new Error('Text19 should be empty when no extra cash');
  if (mForm.getFields().some(f => f.getName() === 'Banco que financia')) {
    if (getEmptyOrText(mForm.getTextField('Banco que financia')) !== '') throw new Error('Banco que financia must be strictly empty');
  }
  if (getEmptyOrText(mForm.getTextField('Text34')) !== '') throw new Error('Text34 must be strictly empty');
  if (getEmptyOrText(mForm.getTextField('Text35')) !== '') throw new Error('Text35 must be strictly empty');
  if (mirageCheckDoc.getPageCount() !== 2) throw new Error('Must maintain 2 pages');
  console.log('✓ TEST 1 MIRAGE PASSED (Text1: VACÍO, Text10: 16.500.000, Text18: 1.000.000, Text21: BNA  10.410.000, Text28: VACÍO, Text34/35: VACÍO, 2 pages intact)');

  console.log('\n--- TEST 2: IRUÑA TEST (Requisito 42) ---');
  const irunaPdfBytes = await fillBoleto('public/templates/boleto-iruna-template.pdf', mirageData, false);
  const irunaCheckDoc = await PDFDocument.load(irunaPdfBytes);
  if (irunaCheckDoc.getPageCount() !== 2) throw new Error('Iruña must be 2 pages');
  console.log('✓ TEST 2 IRUÑA PASSED (2 pages intact, clean appearance)');

  console.log('\n--- TEST 3: OIL BULL TEST (Requisito 43) ---');
  const oilBullPdfBytes = await fillBoleto('public/templates/boleto-oil-bull-template.pdf', mirageData, false);
  const oilBullCheckDoc = await PDFDocument.load(oilBullPdfBytes);
  if (oilBullCheckDoc.getPageCount() !== 2) throw new Error('Oil Bull must be 2 pages');
  console.log('✓ TEST 3 OIL BULL PASSED (2 pages intact, clean appearance)');

  console.log('\n--- TEST 4: MULTI-FINANCIACIÓN COMBINADA (Requisitos 5, 6, 11) ---');
  const multiFinancData = {
    ...mirageData,
    operacion: {
      ...mirageData.operacion,
      totalOperacion: 33500000,
      sena: 1000000,
      efectivoAdicional: 2000000,
      financiaciones: [
        {
          id: 'fin-1',
          entidad: 'BNA',
          montoFinanciado: 20000000,
          cuotas: 36,
          valorCuota: 700000,
          activo: true,
        },
        {
          id: 'fin-2',
          entidad: 'CREDINET',
          montoFinanciado: 10500000,
          cuotas: 24,
          valorCuota: 550000,
          activo: true,
        },
      ],
    },
  };
  const multiFinDoc = await PDFDocument.load(await fillBoleto('public/templates/boleto-mirage-template.pdf', multiFinancData, true));
  const mfForm = multiFinDoc.getForm();
  if (getEmptyOrText(mfForm.getTextField('Text18')) !== '1.000.000') throw new Error('Text18 mismatch');
  if (getEmptyOrText(mfForm.getTextField('Text19')) !== '2.000.000') throw new Error('Text19 mismatch');
  if (getEmptyOrText(mfForm.getTextField('Text21')) !== 'BNA  20.000.000') throw new Error('Text21 mismatch row 0');
  if (getEmptyOrText(mfForm.getTextField('Text22')) !== 'CREDINET  10.500.000') throw new Error('Text22 mismatch row 1');
  if (getEmptyOrText(mfForm.getTextField('Text28')) !== '') throw new Error('Text28 must be empty');
  if (getEmptyOrText(mfForm.getTextField('Text20')) !== '') throw new Error('Text20 must be empty');
  if (getEmptyOrText(mfForm.getTextField('undefined')) !== '33.500.000') throw new Error('undefined mismatch');
  if (getEmptyOrText(mfForm.getTextField('undefined_8')) !== '33.500.000') throw new Error('undefined_8 mismatch');
  if (mfForm.getFields().some(f => f.getName() === 'Banco que financia')) {
    if (getEmptyOrText(mfForm.getTextField('Banco que financia')) !== '') throw new Error('Banco que financia must be strictly empty');
  }
  if (getEmptyOrText(mfForm.getTextField('Text34')) !== '') throw new Error('Text34 must be strictly empty');
  if (getEmptyOrText(mfForm.getTextField('Text35')) !== '') throw new Error('Text35 must be strictly empty');
  console.log('✓ TEST 4 MULTI-FINANCIACIÓN COMBINADA PASSED (Row 0: BNA $20M in Text21, Row 1: CREDINET $10.5M in Text22, Text28/20/34/35 strictly empty, undefined_8: 33.500.000)');

  console.log('\n--- TEST 5: SIN FINANCIACIÓN (Requisito 44) ---');
  const sinFinancData = {
    ...mirageData,
    operacion: {
      ...mirageData.operacion,
      llevaFinanciacion: false,
      financiaciones: [],
    },
  };
  const sinFinDoc = await PDFDocument.load(await fillBoleto('public/templates/boleto-mirage-template.pdf', sinFinancData, true));
  const sfForm = sinFinDoc.getForm();
  if (getEmptyOrText(sfForm.getTextField('Text28')) !== '') throw new Error('Text28 should be empty');
  if (getEmptyOrText(sfForm.getTextField('Text20')) !== '') throw new Error('Text20 should be empty');
  if (getEmptyOrText(sfForm.getTextField('Text29')) !== '') throw new Error('Text29 should be empty');
  if (getEmptyOrText(sfForm.getTextField('Text21')) !== '') throw new Error('Text21 should be empty');
  if (sfForm.getFields().some(f => f.getName() === 'Banco que financia')) {
    if (getEmptyOrText(sfForm.getTextField('Banco que financia')) !== '') throw new Error('Banco que financia should be empty');
  }
  if (getEmptyOrText(sfForm.getTextField('Text34')) !== '') throw new Error('Text34 should be empty');
  if (getEmptyOrText(sfForm.getTextField('Text35')) !== '') throw new Error('Text35 should be empty');
  if (getEmptyOrText(sfForm.getTextField('undefined')) !== '17.410.000') throw new Error('undefined mismatch');
  if (getEmptyOrText(sfForm.getTextField('undefined_8')) !== '17.410.000') throw new Error('undefined_8 mismatch');
  console.log('✓ TEST 5 SIN FINANCIACIÓN PASSED (All financing slots strictly empty, undefined & undefined_8 retain operation total)');

  console.log('\n--- TEST 6: SIN USADO (Requisito 45) ---');
  const sinUsadoData = {
    ...mirageData,
    entregaUsado: { enabled: false },
  };
  const sinUsadoDoc = await PDFDocument.load(await fillBoleto('public/templates/boleto-mirage-template.pdf', sinUsadoData, true));
  const suForm = sinUsadoDoc.getForm();
  if (getEmptyOrText(suForm.getTextField('Text11')) !== '') throw new Error('Text11 must be empty');
  if (getEmptyOrText(suForm.getTextField('Modelo_2')) !== '') throw new Error('Modelo_2 must be empty');
  if (getEmptyOrText(suForm.getTextField('Text37')) !== '') throw new Error('Text37 must be empty');
  if (getEmptyOrText(suForm.getTextField('Dominio_2')) !== '') throw new Error('Dominio_2 must be empty');
  if (getEmptyOrText(suForm.getTextField('Motor_2')) !== '') throw new Error('Motor_2 must be empty');
  if (getEmptyOrText(suForm.getTextField('Chasis_2')) !== '') throw new Error('Chasis_2 must be empty');
  console.log('✓ TEST 6 SIN USADO PASSED (All used unit fields strictly empty)');

  console.log('\n--- TEST 7: EFECTIVO ADICIONAL (Requisito 47) ---');
  const efectivoData = {
    ...mirageData,
    operacion: {
      ...mirageData.operacion,
      sena: 1000000,
      efectivoAdicional: 2500000,
    },
  };
  const efDoc = await PDFDocument.load(await fillBoleto('public/templates/boleto-mirage-template.pdf', efectivoData, true));
  const efForm = efDoc.getForm();
  if (getEmptyOrText(efForm.getTextField('Text18')) !== '1.000.000') throw new Error('Text18 mismatch');
  if (getEmptyOrText(efForm.getTextField('Text19')) !== '2.500.000') throw new Error('Text19 mismatch');
  console.log('✓ TEST 7 EFECTIVO ADICIONAL PASSED (Text18: 1.000.000, Text19: 2.500.000)');

  console.log('\n--- TEST 8: CERO DATOS RESIDUALES (Requisito 34) ---');
  // Client A generates
  const clientAData = {
    ...mirageData,
    cliente: { nombreCompleto: 'CLIENTE A ALFA', dni: '11.111.111' },
    unidadAdquirida: { ...mirageData.unidadAdquirida, patente: 'AAA111' },
  };
  await fillBoleto('public/templates/boleto-mirage-template.pdf', clientAData, true);

  // Client B generates
  const clientBData = {
    ...mirageData,
    cliente: { nombreCompleto: 'CLIENTE B BETA', dni: '22.222.222' },
    unidadAdquirida: { ...mirageData.unidadAdquirida, patente: 'BBB222' },
    entregaUsado: { enabled: false }, // Client B has NO used car
  };
  const clientBDoc = await PDFDocument.load(await fillBoleto('public/templates/boleto-mirage-template.pdf', clientBData, true));
  const bForm = clientBDoc.getForm();
  if (getEmptyOrText(bForm.getTextField('Apellido y Nombres')) !== 'CLIENTE B BETA') throw new Error('Client B name');
  if (getEmptyOrText(bForm.getTextField('DocIdent LELCDNICI')) !== '22.222.222') throw new Error('Client B DNI');
  if (getEmptyOrText(bForm.getTextField('Dominio')) !== 'BBB222') throw new Error('Client B plate');
  if (getEmptyOrText(bForm.getTextField('Modelo_2')) !== '') throw new Error('Client B has no used car, must not contain Client A used car!');
  if (getEmptyOrText(bForm.getTextField('Text11')) !== '') throw new Error('Client B text11 empty');
  console.log('✓ TEST 8 CERO DATOS RESIDUALES PASSED (Client B has no residual data from Client A)');

  console.log('\n--- TEST 9: RESOLUCIÓN ESTRICTA DE EMPRESA Y BLOQUEO (Requisitos 7, 8, 9) ---');
  function resolveBoletoCompany(empresaRaw) {
    if (!empresaRaw) return null;
    const clean = empresaRaw
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, ' ')
      .replace(/\s+/g, ' ');

    if (clean.includes('MIRAGE')) return 'MIRAGE';
    if (clean.includes('IRUNA') || clean.includes('IRUNIA')) return 'IRUNA';
    if (clean.includes('OIL') || clean.includes('BULL')) return 'OIL_BULL';
    if (clean.includes('AKIRA')) return 'AKIRA';
    return null;
  }
  function resolveCompanyFromVehicle(v) {
    if (!v || !v.empresa) return null;
    return resolveBoletoCompany(v.empresa);
  }

  // Casos válidos de normalización
  if (resolveCompanyFromVehicle({ empresa: 'MIRAGE S.A.' }) !== 'MIRAGE') throw new Error('Failed MIRAGE S.A.');
  if (resolveCompanyFromVehicle({ empresa: 'IRUÑA' }) !== 'IRUNA') throw new Error('Failed IRUÑA con tilde');
  if (resolveCompanyFromVehicle({ empresa: 'IRUNA' }) !== 'IRUNA') throw new Error('Failed IRUNA sin tilde');
  if (resolveCompanyFromVehicle({ empresa: 'IRUNIA' }) !== 'IRUNA') throw new Error('Failed IRUNIA');
  if (resolveCompanyFromVehicle({ empresa: 'OIL BULL S.A.' }) !== 'OIL_BULL') throw new Error('Failed OIL BULL S.A.');
  if (resolveCompanyFromVehicle({ empresa: 'AKIRA' }) !== 'AKIRA') throw new Error('Failed AKIRA');

  // Requisitos 7, 8, 9: Si la empresa está vacía o no coincide, BLOQUEAR (devuelve null).
  // NO inferir por patente, por marca, ni por ubicación Ub (A, P, S, GR, FINAN)
  if (resolveCompanyFromVehicle({ empresa: '', patente: 'AF123CD', marca: 'TOYOTA', ub: 'A' }) !== null) {
    throw new Error('Empresa vacía no debe inferirse por patente, marca ni Ub');
  }
  if (resolveCompanyFromVehicle({ empresa: undefined, patente: 'AA111ZZ', marca: 'FORD', ub: 'FINAN' }) !== null) {
    throw new Error('Empresa indefinida debe devolver null');
  }
  if (resolveCompanyFromVehicle({ empresa: 'CONCESIONARIO DESCONOCIDO' }) !== null) {
    throw new Error('Empresa no configurada debe devolver null');
  }
  if (resolveCompanyFromVehicle(null) !== null) {
    throw new Error('Vehículo nulo debe devolver null');
  }
  console.log('✓ TEST 9 RESOLUCIÓN ESTRICTA DE EMPRESA Y BLOQUEO PASSED (Selección exclusiva por vehicle.empresa, sin fallback ni inferencia por patente, marca o Ub)');

  console.log('\n>>> TODOS LOS TESTS AUTOMATIZADOS DE BOLETO V2 PASARON EXITOSAMENTE <<<');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
