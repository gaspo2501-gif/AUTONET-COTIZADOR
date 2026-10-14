import { Vehicle } from '../types/stock';
import { normalizeMileage } from './formatters';
import { normalizeCommercialStatus } from './stockSelectors';

export type StockSortKey =
  | 'disponibles_primero'
  | 'precio_asc'
  | 'precio_desc'
  | 'km_asc'
  | 'km_desc'
  | 'anio_desc'
  | 'anio_asc'
  | 'marca_asc'
  | 'recientes';

export const SORT_OPTIONS: { value: StockSortKey; label: string }[] = [
  { value: 'disponibles_primero', label: 'Disponibles primero' },
  { value: 'recientes', label: 'Ingresos más recientes' },
  { value: 'precio_asc', label: 'Menor precio' },
  { value: 'precio_desc', label: 'Mayor precio' },
  { value: 'km_asc', label: 'Menor kilometraje' },
  { value: 'km_desc', label: 'Mayor kilometraje' },
  { value: 'anio_desc', label: 'Año más nuevo' },
  { value: 'anio_asc', label: 'Año más antiguo' },
  { value: 'marca_asc', label: 'Marca y modelo (A-Z)' },
];

export const isSortKey = (v: unknown): v is StockSortKey => SORT_OPTIONS.some((o) => o.value === v);

const STATUS_ORDER: Record<string, number> = { Disponible: 1, Reservado: 2, Vendido: 3, fuera_de_stock: 4 };
const price = (v: Vehicle, empty: number) => (v.precio === null || v.precio === undefined ? empty : v.precio);
const km = (v: Vehicle, empty: number) => normalizeMileage(v.kilometraje) ?? empty;
const time = (s?: string) => {
  const t = s ? Date.parse(s) : NaN;
  return isNaN(t) ? 0 : t;
};

export function sortVehicles(list: Vehicle[], sortBy: StockSortKey): Vehicle[] {
  const arr = [...list];
  arr.sort((a, b) => {
    switch (sortBy) {
      case 'precio_asc':
        return price(a, Infinity) - price(b, Infinity);
      case 'precio_desc':
        return price(b, -Infinity) - price(a, -Infinity);
      case 'km_asc':
        return km(a, Infinity) - km(b, Infinity);
      case 'km_desc':
        return km(b, -Infinity) - km(a, -Infinity);
      case 'anio_desc':
        return b.anio - a.anio;
      case 'anio_asc':
        return a.anio - b.anio;
      case 'marca_asc':
        return `${a.marca} ${a.modelo} ${a.version}`.localeCompare(`${b.marca} ${b.modelo} ${b.version}`, 'es');
      case 'recientes':
        return time(b.fechaIncorporacion) - time(a.fechaIncorporacion) || (b.numeroOrden ?? 0) - (a.numeroOrden ?? 0);
      case 'disponibles_primero':
      default: {
        const sa = STATUS_ORDER[normalizeCommercialStatus(a.estado)] || 99;
        const sb = STATUS_ORDER[normalizeCommercialStatus(b.estado)] || 99;
        if (sa !== sb) return sa - sb;
        return b.anio - a.anio;
      }
    }
  });
  return arr;
}
