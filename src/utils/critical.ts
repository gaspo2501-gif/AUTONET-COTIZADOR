import { Vehicle } from '../types/stock';

/** ¿La unidad es crítica? La marca manual del asesor manda; si no hay, la del PDF de stock. */
export function isCriticalVehicle(v?: Partial<Vehicle> | null): boolean {
  if (!v) return false;
  if (typeof v.criticoManual === 'boolean') return v.criticoManual;
  return Boolean(v.criticoPdf);
}
