export type BoletoCompanyKey = 'MIRAGE' | 'IRUNA' | 'OIL_BULL' | 'AKIRA';

/**
 * Normaliza cualquier texto para el boleto oficial:
 * - Convierte a string
 * - trim()
 * - Colapsa espacios múltiples internos
 * - Transforma a MAYÚSCULAS
 */
export function toBoletoText(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim().replace(/\s+/g, ' ');
  return str.toUpperCase();
}

export interface BoletoFinancingEntry {
  id: string;
  entidad: string; // ej: BNA, CREDINET, Santander, etc.
  montoFinanciado: number;
  cuotas?: number;
  valorCuota?: number;
  observacion?: string;
  activo: boolean;
}

export interface BoletoCliente {
  nombreCompleto: string;
  fechaNacimiento?: string; // YYYY-MM-DD o DD/MM/AAAA
  nacimientoDia?: string;
  nacimientoMes?: string;
  nacimientoAnio?: string;
  actividad?: string;
  dni?: string;
  direccion?: string;
  telefono?: string;
  localidad?: string;
  provincia?: string;
  codigoPostal?: string;
  estadoCivil?: string;
  condicionIVA?: string;
  cuitCuil?: string;
  email?: string;
}

export interface BoletoOperacion {
  referenciaLista?: string; // COD
  precioVehiculo: number; // Text10
  color?: string; // COLOR
  numeroComprobante?: string; // Eliminado en V2 (queda vacío)

  sena?: number; // Text18
  efectivoAdicional?: number; // Text19

  totalOperacion?: number; // undefined / undefined_8
  patentamiento?: number; // GESTORÍA -> PATENTAMIENTO (valor de transferencia calculada)

  // Colección de financiaciones en V2
  financiaciones: BoletoFinancingEntry[];

  // Campos legacy mantenidos por compatibilidad
  llevaFinanciacion?: boolean;
  entidadFinanciera?: string; // Text28
  montoFinanciado?: number; // Text20
  cuotas?: number; // Text34
  valorCuota?: number; // Text35
  bancoFinancia?: string; // Banco que financia
}

export interface BoletoUnidadAdquirida {
  descripcion: string; // Modelo
  anio?: number; // Text36
  patente?: string; // Dominio
  color?: string; // COLOR
  stockInterno?: string; // STOCK
  motor?: string; // Motor
  chasis?: string; // Chasis
  fechaEntrega?: string; // Fecha de Entrega
}

export interface BoletoEntregaUsado {
  enabled: boolean;
  valorToma?: number; // Text11
  modelo?: string; // Modelo_2
  anio?: number; // Text37
  patente?: string; // Dominio_2
  motor?: string; // Motor_2
  chasis?: string; // Chasis_2
}

export interface BoletoData {
  fechaOperacion: string; // YYYY-MM-DD
  fechaDia?: string; // Dia
  fechaMes?: string; // mes
  fechaAnio?: string; // año
  lugarConcrecion?: string;

  cliente: BoletoCliente;
  operacion: BoletoOperacion;
  unidadAdquirida: BoletoUnidadAdquirida;
  entregaUsado: BoletoEntregaUsado;
  observaciones?: string;
}

export interface BoletoPaymentRowMap {
  detailField?: string;
  amountField: string;
}

export interface BoletoFieldMapping {
  // Fecha
  fechaDia?: string;
  fechaMes?: string;
  fechaAnio?: string;

  // Cliente
  clienteNombre?: string;
  clienteDni?: string;
  clienteCuit?: string;
  clienteNacimientoDia?: string;
  clienteNacimientoMes?: string;
  clienteNacimientoAnio?: string;
  clienteEstadoCivil?: string;
  clienteActividad?: string;
  clienteCondicionIva?: string;
  clienteDireccion?: string;
  clienteLocalidad?: string;
  clienteProvincia?: string;
  clienteCodigoPostal?: string;
  clienteTelefono?: string;
  clienteEmail?: string;

  // Operación
  operacionLista?: string;
  operacionPrecioVehiculo?: string;
  operacionColor?: string;
  operacionNumeroComprobante?: string; // Text1 en Mirage (no usado en V2)
  operacionSena?: string;
  operacionEfectivo?: string;
  operacionTotalPrimario?: string; // undefined
  operacionTotalSecundario?: string; // undefined_8

  // Filas dinámicas de pago / cheques / financiaciones
  paymentRows?: BoletoPaymentRowMap[];

  operacionEntidadFinanciera?: string; // Text28
  operacionMontoFinanciado?: string; // Text20
  operacionBancoFinancia?: string; // Banco que financia
  operacionCuotas?: string; // Text34
  operacionValorCuota?: string; // Text35

  // Gestoría
  gestoriaPatentamiento?: string; // undefined_9

  // Unidad adquirida
  unidadModelo?: string;
  unidadAnio?: string; // Text36
  unidadDominio?: string;
  unidadColor?: string;
  unidadStock?: string;
  unidadMotor?: string;
  unidadChasis?: string;
  unidadFechaEntrega?: string;

  // Usado entregado
  usadoValorToma?: string;
  usadoModelo?: string;
  usadoAnio?: string;
  usadoDominio?: string;
  usadoMotor?: string;
  usadoChasis?: string;
}

export interface BoletoTemplateConfig {
  key: BoletoCompanyKey;
  displayName: string;
  templateFileName: string;
  templateUrl: string;
  available: boolean;
  unavailableReason?: string;
  fieldMap: BoletoFieldMapping;
}

export interface BoletoDiagnosticField {
  pdfFieldName: string;
  mappedConcept: string;
  valueToApply: string;
  fieldFoundInPdf: boolean;
  fieldType?: string;
}

export interface BoletoDiagnosticReport {
  company: BoletoCompanyKey;
  templateName: string;
  totalFieldsInPdf: number;
  mappedFieldsCount: number;
  matchedFieldsCount: number;
  missingFieldsCount: number;
  fields: BoletoDiagnosticField[];
}
