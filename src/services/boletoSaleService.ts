import { BoletoData } from '../types/boleto';
import { Vehicle } from '../types/stock';
import { stockService } from './stockService';
import { calculateBaseCommission, calculateTradeInCommission } from './commissionService';
import { normalizePatent } from '../utils/vehicleIdentity';
import { isCriticalVehicle } from '../utils/critical';
import { todayISO } from '../utils/budgetAlerts';

/**
 * VENTA AUTOMÁTICA DESDE EL BOLETO
 * Al generar el boleto, la unidad queda registrada como venta propia con:
 * precio, IVA, crítico (de la unidad), Credinet (de las financiaciones) y toma de usado (del boleto).
 */

export const boletoUsesCredinet = (d: BoletoData) =>
  (d.operacion.financiaciones || []).some((f) => f.activo && /credinet|wunder/i.test(f.entidad || ''));

export const boletoCritico = (d: BoletoData, v: Vehicle) =>
  typeof d.venta?.esCritico === 'boolean' ? d.venta.esCritico : isCriticalVehicle(v);

export function saleOptionsFromBoleto(d: BoletoData, v: Vehicle) {
  const precio = Math.max(0, Number(d.operacion.precioVehiculo) || v.precio || 0);
  const ivaVenta = d.venta?.ivaVenta ?? v.ivaVenta ?? 21;
  const toma = d.entregaUsado.enabled ? Math.max(0, Number(d.entregaUsado.valorToma) || 0) : 0;
  const tieneToma = d.entregaUsado.enabled && toma > 0;
  const ivaToma = d.venta?.ivaTomaUsado ?? 21;
  return {
    saleOwner: 'self' as const,
    soldAt: todayISO(),
    soldPrice: precio,
    precioRealVenta: precio,
    ivaVenta,
    comisionBaseCalculada: calculateBaseCommission(precio, ivaVenta),
    esCritico: boletoCritico(d, v),
    usaCredinet: boletoUsesCredinet(d),
    tieneTomaUsado: tieneToma,
    valorTomaUsado: tieneToma ? toma : undefined,
    ivaTomaUsado: tieneToma ? ivaToma : undefined,
    comisionTomaCalculada: tieneToma ? calculateTradeInCommission(toma, ivaToma) : undefined,
    marcaModeloTomaUsado: tieneToma ? [d.entregaUsado.modelo, d.entregaUsado.anio].filter(Boolean).join(' ').trim() || undefined : undefined,
    patenteTomaUsado: tieneToma ? (d.entregaUsado.patente || '').trim().toUpperCase() || undefined : undefined,
  };
}

export const boletoSaleService = {
  /** Registra (o actualiza) la venta propia con los datos del boleto. Devuelve la unidad actualizada. */
  register(d: BoletoData, v: Vehicle): Vehicle | null {
    if (d.venta?.registrar === false) return null;
    const key = normalizePatent(v.patente) || v.id;
    const current = stockService.getAllVehicles().find((x) => (normalizePatent(x.patente) || x.id) === key);
    const opts = saleOptionsFromBoleto(d, v);
    // Si ya estaba registrada como venta propia, se conserva la fecha original de la venta
    if (current?.estado === 'Vendido' && current.saleOwner === 'self' && current.soldAt) opts.soldAt = current.soldAt.slice(0, 10);
    return stockService.markVehicleAsSold(key, opts);
  },
  undo(v: Vehicle): Vehicle | null {
    return stockService.revertVehicleToAvailable(normalizePatent(v.patente) || v.id);
  },
};
