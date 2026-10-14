import { BoletoData } from '../types/boleto';
import { isValidDni, isValidCuit, cuitMatchesDni, isValidPlate, isValidVin, onlyDigits } from './argentinaIds';

export interface BoletoIssue {
  level: 'error' | 'warning';
  message: string;
}

export function computeBoletoCuadre(data: BoletoData) {
  const sena = Number(data.operacion.sena) || 0;
  const efectivo = Number(data.operacion.efectivoAdicional) || 0;
  const usado = data.entregaUsado.enabled ? Number(data.entregaUsado.valorToma) || 0 : 0;
  const financiado = (data.operacion.financiaciones || [])
    .filter((f) => f.activo)
    .reduce((acc, f) => acc + (Number(f.montoFinanciado) || 0), 0);
  const medios = sena + efectivo + usado + financiado;
  const total = Number(data.operacion.totalOperacion || data.operacion.precioVehiculo) || 0;
  return { medios, total, diferencia: medios - total };
}

/**
 * Revisión del boleto antes de generar el PDF.
 * "error" = dato que casi seguro está mal (bloquea, salvo "generar igual").
 * "warning" = dato que conviene completar pero puede faltar.
 */
export function validateBoleto(data: BoletoData): BoletoIssue[] {
  const issues: BoletoIssue[] = [];
  const c = data.cliente;
  const err = (message: string) => issues.push({ level: 'error', message });
  const warn = (message: string) => issues.push({ level: 'warning', message });

  if (!c.nombreCompleto?.trim()) err('Falta el nombre y apellido del comprador.');
  if (!c.dni?.trim()) err('Falta el DNI del comprador.');
  else if (!isValidDni(c.dni)) err(`El DNI "${c.dni}" no tiene 7 u 8 dígitos.`);

  if (c.cuitCuil?.trim()) {
    if (!isValidCuit(c.cuitCuil)) err(`El CUIT/CUIL "${c.cuitCuil}" no es válido (dígito verificador incorrecto).`);
    else if (c.dni && isValidDni(c.dni) && !cuitMatchesDni(c.cuitCuil, c.dni)) err('El CUIT/CUIL no corresponde al DNI cargado.');
  } else {
    warn('Falta el CUIT/CUIL del comprador.');
  }

  if (!c.direccion?.trim()) warn('Falta el domicilio del comprador.');
  if (c.estadoCivil === 'CASADO/A') {
    if (!c.conyugeNombre?.trim()) warn('Comprador casado: falta el nombre del cónyuge.');
    if (c.conyugeDni?.trim() && !isValidDni(c.conyugeDni)) err(`El DNI del cónyuge "${c.conyugeDni}" no es válido.`);
  }
  if (c.telefono && onlyDigits(c.telefono).length < 8) warn('El teléfono parece incompleto.');

  const u = data.unidadAdquirida;
  if (u.patente && !isValidPlate(u.patente)) warn(`"${u.patente}" no tiene formato de patente (normal si la unidad es 0 km y aún no está patentada).`);
  if (!u.chasis?.trim()) warn('Falta el número de chasis de la unidad.');
  else if (!isValidVin(u.chasis)) err(`El chasis "${u.chasis}" debería tener 17 caracteres (sin I, O ni Q).`);
  if (!u.motor?.trim()) warn('Falta el número de motor de la unidad.');

  const usado = data.entregaUsado;
  if (usado.enabled) {
    if (!(Number(usado.valorToma) > 0)) err('Entrega usado: falta el valor de toma.');
    if (!usado.patente?.trim()) warn('Entrega usado: falta la patente del usado.');
    else if (!isValidPlate(usado.patente)) err(`La patente del usado "${usado.patente}" no tiene un formato válido.`);
    if (usado.chasis?.trim() && !isValidVin(usado.chasis)) err(`El chasis del usado "${usado.chasis}" debería tener 17 caracteres.`);
  }

  if (!(Number(data.operacion.precioVehiculo) > 0)) err('Falta el precio de la unidad.');
  const { total, diferencia } = computeBoletoCuadre(data);
  if (total > 0 && diferencia !== 0) {
    const monto = Math.abs(diferencia).toLocaleString('es-AR');
    err(diferencia < 0 ? `Los medios de pago no cubren el total: faltan $${monto}.` : `Los medios de pago superan el total en $${monto}.`);
  }
  return issues;
}
