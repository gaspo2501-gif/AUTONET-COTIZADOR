import { BoletoCompanyKey, BoletoFieldMapping } from '../types/boleto';

export const COMMON_BOLETO_FIELDS: BoletoFieldMapping = {
  // Fecha
  fechaDia: 'Dia',
  fechaMes: 'mes',
  fechaAnio: 'año',

  // Cliente
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

  // Operación
  operacionLista: 'COD',
  operacionPrecioVehiculo: 'Text10',
  operacionColor: 'COLOR',
  operacionSena: 'Text18',
  operacionEfectivo: 'Text19',
  operacionTotalPrimario: 'undefined',
  operacionTotalSecundario: 'undefined_8',

  // Filas dinámicas para múltiples financiaciones / medios de pago (Cheque c/Bco)
  // Cada fila utiliza DOS campos AcroForm distintos:
  // - Izquierdo / detalle: entidad financiera (Text28 a Text33)
  // - Derecho / numérico: monto financiado (Text20 a Text25)
  paymentRows: [
    { detailField: 'Text28', amountField: 'Text20' }, // Cheque c/Bco Fila 1 (y: 429.1)
    { detailField: 'Text29', amountField: 'Text21' }, // Cheque c/Bco Fila 2 (y: 407.4)
    { detailField: 'Text30', amountField: 'Text22' }, // Cheque c/Bco Fila 3 (y: 388.0)
    { detailField: 'Text31', amountField: 'Text23' }, // Cheque c/Bco Fila 4 (y: 369.3)
    { detailField: 'Text32', amountField: 'Text24' }, // Cheque c/Bco Fila 5 (y: 350.6)
    { detailField: 'Text33', amountField: 'Text25' }, // Cheque c/Bco Fila 6 (y: 331.8)
  ],

  operacionEntidadFinanciera: undefined,
  operacionMontoFinanciado: undefined,
  operacionBancoFinancia: 'Banco que financia', // Debe quedar estrictamente vacío
  operacionCuotas: 'Text34', // Debe quedar estrictamente vacío
  operacionValorCuota: 'Text35', // Debe quedar estrictamente vacío

  // Gestoría
  gestoriaPatentamiento: 'undefined_9', // Patentamiento con transferencia calculada

  // Unidad adquirida
  unidadModelo: 'Modelo',
  unidadAnio: 'Text36',
  unidadDominio: 'Dominio',
  unidadColor: 'COLOR',
  unidadStock: 'STOCK',
  unidadMotor: 'Motor',
  unidadChasis: 'Chasis',
  unidadFechaEntrega: 'Fecha de Entrega',

  // Usado entregado
  usadoValorToma: 'Text11',
  usadoModelo: 'Modelo_2',
  usadoAnio: 'Text37',
  usadoDominio: 'Dominio_2',
  usadoMotor: 'Motor_2',
  usadoChasis: 'Chasis_2',
};

export const BOLETO_FIELD_MAPS: Record<BoletoCompanyKey, BoletoFieldMapping> = {
  MIRAGE: {
    ...COMMON_BOLETO_FIELDS,
    operacionNumeroComprobante: 'Text1', // Específico de Mirage
  },

  IRUNA: {
    ...COMMON_BOLETO_FIELDS,
    // Text1 no está presente en Iruña
    operacionNumeroComprobante: undefined,
  },

  OIL_BULL: {
    ...COMMON_BOLETO_FIELDS,
    // Text1 no está presente en Oil Bull
    operacionNumeroComprobante: undefined,
  },

  AKIRA: {
    ...COMMON_BOLETO_FIELDS,
  },
};
