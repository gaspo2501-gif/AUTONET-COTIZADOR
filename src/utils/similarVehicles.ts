import { Vehicle } from '../types/stock';
import { isActiveVehicle } from './stockSelectors';
import { normalizeMileage } from './formatters';
import { normalizePatent } from './vehicleIdentity';

/**
 * Unidades parecidas para ofrecer como alternativa:
 * mismo rango de precio (±15 %), año cercano, y bonus por mismo modelo/marca,
 * misma caja y mismo combustible. Solo stock activo.
 */
export function findSimilarVehicles(target: Vehicle, all: Vehicle[], limit = 3): Vehicle[] {
  const price = target.precio || 0;
  const self = normalizePatent(target.patente);
  const scored = all
    .filter((v) => isActiveVehicle(v) && normalizePatent(v.patente) !== self && v.estado === 'Disponible')
    .map((v) => {
      let score = 0;
      if (price > 0 && v.precio) {
        const diff = Math.abs(v.precio - price) / price;
        if (diff > 0.2) return null;
        score += (0.2 - diff) * 100; // hasta 20 pts
      } else if (v.modelo !== target.modelo) return null;
      if (v.modelo === target.modelo) score += 25;
      else if (v.marca === target.marca) score += 8;
      score += Math.max(0, 10 - Math.abs((v.anio || 0) - (target.anio || 0)) * 3);
      if (v.caja === target.caja) score += 6;
      if (v.combustible === target.combustible) score += 4;
      if (v.traccion === target.traccion) score += 3;
      const km = normalizeMileage(v.kilometraje);
      const tkm = normalizeMileage(target.kilometraje);
      if (km !== null && tkm !== null) score += Math.max(0, 5 - Math.abs(km - tkm) / 20000);
      return { v, score };
    })
    .filter((x): x is { v: Vehicle; score: number } => !!x)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.v);
}
