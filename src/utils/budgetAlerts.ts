import { CommercialBudget } from '../services/quoteService';
import { Vehicle } from '../types/stock';
import { isSameVehicle } from './vehicleIdentity';

export type BudgetAlert =
  | { kind: 'due'; budget: CommercialBudget; overdueDays: number }
  | { kind: 'priceDrop'; budget: CommercialBudget; vehicle: Vehicle; diff: number }
  | { kind: 'sold'; budget: CommercialBudget; vehicle: Vehicle };

import { todayISO } from './dates';
export { todayISO };

const isOpen = (b: CommercialBudget) => !b.seguimiento || b.seguimiento.estado === 'enviado' || b.seguimiento.estado === 'respondio';

/**
 * Avisos de seguimiento:
 * - due: el recordatorio vence hoy o ya venció.
 * - priceDrop: la unidad presupuestada hoy está más barata → excusa para volver a escribir.
 * - sold: la unidad ya no está → ofrecer una parecida.
 * Solo para presupuestos abiertos (enviado / respondió) de los últimos 60 días.
 */
export function getBudgetAlerts(budgets: CommercialBudget[], vehicles: Vehicle[]): BudgetAlert[] {
  const out: BudgetAlert[] = [];
  const today = todayISO();
  const cutoff = Date.now() - 60 * 86_400_000;
  for (const b of budgets) {
    if (!isOpen(b)) continue;
    const r = b.seguimiento?.recordarEl;
    if (r && r <= today) {
      out.push({ kind: 'due', budget: b, overdueDays: Math.round((Date.parse(today) - Date.parse(r)) / 86_400_000) });
    }
    if (Date.parse(b.fechaEmision) < cutoff) continue;
    const v = vehicles.find((x) => isSameVehicle(x, b.vehiculo.patente));
    if (!v) continue;
    if (v.estado === 'Vendido' || v.isHistorical || v.estado === 'fuera_de_stock') {
      out.push({ kind: 'sold', budget: b, vehicle: v });
    } else if (typeof v.precio === 'number' && v.precio > 0 && v.precio < b.precioVehiculo) {
      out.push({ kind: 'priceDrop', budget: b, vehicle: v, diff: b.precioVehiculo - v.precio });
    }
  }
  return out;
}
