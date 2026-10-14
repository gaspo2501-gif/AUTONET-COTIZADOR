import { UpdateHistoryRecord, Vehicle } from '../types/stock';
import { normalizePatent } from './vehicleIdentity';
import { parseArgentineInteger } from './formatters';

export interface PriceDrop {
  oldPrice: number;
  newPrice: number;
  fecha: string;
}

/**
 * Lee el historial de importaciones de PDF y detecta:
 * - bajas de precio (últimos `days` días; se queda con el precio más alto anterior)
 * - unidades nuevas (aparecieron como "nuevo" en los últimos `days` días)
 */
export function getStockInsights(history: UpdateHistoryRecord[], days = 30) {
  const cutoff = Date.now() - days * 86_400_000;
  const drops = new Map<string, PriceDrop>();
  const nuevos = new Map<string, string>();
  [...history]
    .filter((h) => Date.parse(h.fecha) >= cutoff)
    .sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha))
    .forEach((h) => {
      (h.cambiosDetectados || []).forEach((item) => {
        const pat = normalizePatent(item.patente);
        if (!pat) return;
        if (item.tipo === 'nuevo') nuevos.set(pat, h.fecha);
        const ch = (item.cambios || []).find((c) => c.campo === 'precio');
        if (!ch) return;
        const oldP = parseArgentineInteger(ch.valorAnterior as any);
        const newP = parseArgentineInteger(ch.valorNuevo as any);
        if (!oldP || !newP) return;
        const prev = drops.get(pat);
        if (newP < oldP) drops.set(pat, { oldPrice: Math.max(oldP, prev?.oldPrice || 0), newPrice: newP, fecha: h.fecha });
        else if (prev && newP >= prev.oldPrice) drops.delete(pat); // volvió a subir
      });
    });
  return { drops, nuevos };
}

/** Confirma la baja contra el precio actual de la unidad. */
export function currentDrop(v: Vehicle, drops: Map<string, PriceDrop>): PriceDrop | null {
  const d = drops.get(normalizePatent(v.patente));
  if (!d || !v.precio || v.precio >= d.oldPrice) return null;
  return { ...d, newPrice: v.precio };
}
