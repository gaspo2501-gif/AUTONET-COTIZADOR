const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PDFDocument, PDFTextField } = require('pdf-lib');

const SAMPLE_CLIENT = {
  nombreCompleto: 'JUAN MANUEL PÉREZ',
  dni: '32.145.890',
  cuitCuil: '20-32145890-4',
  nacimientoDia: '14',
  nacimientoMes: '05',
  nacimientoAnio: '1986',
  estadoCivil: 'CASADO',
  actividad: 'EMPLEADO DE COMERCIO',
  condicionIVA: 'CONSUMIDOR FINAL',
  direccion: 'AV. ARGENTINA 1250',
  localidad: 'NEUQUÉN',
  provincia: 'NEUQUÉN',
  codigoPostal: '8300',
  telefono: '2994123456',
  email: 'juan.perez@email.com',
};

const SAMPLE_VEHICLE = {
  descripcion: 'VOLKSWAGEN TAOS HIGHLINE 250 TSI AT',
  anio: 2023,
  patente: 'AF123CD',
  color: 'GRIS PLATINO',
  stockInterno: 'STK-99882',
  motor: 'EA211-558812',
  chasis: '8AWZZZ9NZP123456',
  precio: 25000000,
};

function formatMoney(n) {
  if (!n) return '';
  return new Intl.NumberFormat('es-AR').format(Math.round(n));
}

async function generateCompanyBoleto(templatePath, companyName, financings = []) {
  const bytes = fs.readFileSync(templatePath);
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();

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
  setT('Dia', '11');
  setT('mes', '09');
  setT('año', '2026');

  // Cliente
  setT('Apellido y Nombres', SAMPLE_CLIENT.nombreCompleto);
  setT('DocIdent LELCDNICI', SAMPLE_CLIENT.dni);
  setT('CUIT', SAMPLE_CLIENT.cuitCuil);
  setT('Text4', SAMPLE_CLIENT.nacimientoDia);
  setT('Text5', SAMPLE_CLIENT.nacimientoMes);
  setT('Text6', SAMPLE_CLIENT.nacimientoAnio);
  setT('EstCivil', SAMPLE_CLIENT.estadoCivil);
  setT('Actividad o profesión', SAMPLE_CLIENT.actividad);
  setT('Condición ante el IVA', SAMPLE_CLIENT.condicionIVA);
  setT('Dirección', SAMPLE_CLIENT.direccion);
  setT('Localidad', SAMPLE_CLIENT.localidad);
  setT('Text7', SAMPLE_CLIENT.provincia);
  setT('Text8', SAMPLE_CLIENT.codigoPostal);
  setT('Teléfono', SAMPLE_CLIENT.telefono);
  setT('Email', SAMPLE_CLIENT.email);

  // Operación
  setT('COD', 'VTA-2026-001');
  setT('Text10', formatMoney(SAMPLE_VEHICLE.precio));
  setT('COLOR', SAMPLE_VEHICLE.color);
  setT('Text18', formatMoney(1000000)); // Seña
  setT('Text19', formatMoney(4000000)); // Efectivo

  // Total operacion
  setT('undefined', formatMoney(SAMPLE_VEHICLE.precio));
  setT('undefined_8', formatMoney(SAMPLE_VEHICLE.precio));

  // Cheque c/Bco (Fila 1: Text21, Fila 2: Text22)
  const chequeFields = ['Text21', 'Text22', 'Text23', 'Text24', 'Text25', 'Text26'];
  chequeFields.forEach((cf, idx) => {
    if (idx < financings.length) {
      const fin = financings[idx];
      setT(cf, `${fin.entidad}  ${formatMoney(fin.monto)}`);
    } else {
      clearT(cf);
    }
  });

  // Campos que deben quedar estrictamente vacíos
  clearT('Text1');
  clearT('Text28');
  clearT('Text20');
  clearT('Banco que financia');
  clearT('Text34');
  clearT('Text35');

  // Unidad adquirida
  setT('Modelo', SAMPLE_VEHICLE.descripcion);
  setT('Text36', String(SAMPLE_VEHICLE.anio));
  setT('Dominio', SAMPLE_VEHICLE.patente);
  setT('STOCK', SAMPLE_VEHICLE.stockInterno);
  setT('Motor', SAMPLE_VEHICLE.motor);
  setT('Chasis', SAMPLE_VEHICLE.chasis);
  setT('Fecha de Entrega', '18/09/2026');

  // Usado entregado
  setT('Text11', formatMoney(8000000));
  setT('Modelo_2', 'FORD FOCUS SE 2.0 AT');
  setT('Text37', '2018');
  setT('Dominio_2', 'AC456XY');
  setT('Motor_2', 'DURATEC-8899');
  setT('Chasis_2', '8AF11223344');

  return await doc.save();
}

async function run() {
  const outDir = path.join('/tmp', 'generated_boletos');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const companies = [
    {
      name: 'MIRAGE',
      template: path.join(__dirname, '..', 'public', 'templates', 'boleto-mirage-template.pdf'),
      financings: [
        { entidad: 'BNA', monto: 12000000 },
      ],
    },
    {
      name: 'IRUNA',
      template: path.join(__dirname, '..', 'public', 'templates', 'boleto-iruna-template.pdf'),
      financings: [
        { entidad: 'SANTANDER', monto: 7000000 },
        { entidad: 'CREDINET', monto: 5000000 },
      ],
    },
    {
      name: 'OIL_BULL',
      template: path.join(__dirname, '..', 'public', 'templates', 'boleto-oil-bull-template.pdf'),
      financings: [
        { entidad: 'CREDINET', monto: 12000000 },
      ],
    },
  ];

  console.log('--- GENERANDO BOLETOS REALES Y RENDERIZANDO PARA VERIFICACIÓN VISUAL ---');

  for (const c of companies) {
    const pdfBytes = await generateCompanyBoleto(c.template, c.name, c.financings);
    const pdfPath = path.join(outDir, `boleto_${c.name.toLowerCase()}_real.pdf`);
    fs.writeFileSync(pdfPath, pdfBytes);

    const doc = await PDFDocument.load(pdfBytes);
    console.log(`\n✓ ${c.name}:`);
    console.log(`   PDF generado: ${pdfPath} (${pdfBytes.length} bytes, ${doc.getPageCount()} páginas)`);

    // Renderizar ambas páginas
    const p1Png = path.join(outDir, `boleto_${c.name.toLowerCase()}_p1.png`);
    const p2Png = path.join(outDir, `boleto_${c.name.toLowerCase()}_p2.png`);

    execSync(`gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -dFirstPage=1 -dLastPage=1 -sOutputFile="${p1Png}" "${pdfPath}"`, { stdio: 'pipe' });
    execSync(`gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -dFirstPage=2 -dLastPage=2 -sOutputFile="${p2Png}" "${pdfPath}"`, { stdio: 'pipe' });

    console.log(`   Página 1 renderizada: ${p1Png} (${fs.statSync(p1Png).size} bytes)`);
    console.log(`   Página 2 renderizada: ${p2Png} (${fs.statSync(p2Png).size} bytes)`);
  }

  console.log('\n--- VERIFICACIÓN DE RENDERIZADO COMPLETADA CON ÉXITO ---');
}

run().catch(console.error);
