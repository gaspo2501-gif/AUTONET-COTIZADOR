import { Vehicle } from '../types/stock';

/**
 * Normaliza una patente automotriz asegurando identidad unívoca y determinística.
 * - Convierte a mayúsculas
 * - Elimina espacios, guiones y cualquier carácter no alfanumérico
 * - Aplica trim
 */
export const normalizePatent = (patente?: string | null): string => {
  if (!patente) return '';
  return patente.toString().toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
};

/**
 * Compara dos vehículos o patentes para verificar si corresponden a la misma unidad.
 */
export const isSameVehicle = (
  a: Vehicle | string | null | undefined,
  b: Vehicle | string | null | undefined
): boolean => {
  const plateA: string = typeof a === 'string' ? a : (a && typeof a === 'object' ? a.patente : '');
  const plateB: string = typeof b === 'string' ? b : (b && typeof b === 'object' ? b.patente : '');
  const normA = normalizePatent(plateA);
  const normB = normalizePatent(plateB);
  return Boolean(normA && normB && normA === normB);
};

/**
 * Comprobación no invasiva de diagnóstico para desarrollo:
 * Detecta si existen IDs AUT-XXX compartidos entre distintas patentes.
 * No interrumpe ni bloquea la aplicación, solo emite reporte en consola si hay colisiones.
 */
export const checkDuplicateIds = (vehicles: Vehicle[]): { id: string; patentes: string[] }[] => {
  const idMap = new Map<string, Set<string>>();
  for (const v of vehicles) {
    if (!v.id) continue;
    const norm = normalizePatent(v.patente);
    if (!norm) continue;
    if (!idMap.has(v.id)) {
      idMap.set(v.id, new Set());
    }
    idMap.get(v.id)!.add(norm);
  }

  const duplicates: { id: string; patentes: string[] }[] = [];
  idMap.forEach((patentesSet, id) => {
    if (patentesSet.size > 1) {
      duplicates.push({ id, patentes: Array.from(patentesSet) });
    }
  });

  if (duplicates.length > 0 && typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    console.info(
      '[Autonet Diagnóstico] Detección no invasiva de IDs AUT-XXX compartidos por patentes distintas:',
      duplicates
    );
  }

  return duplicates;
};
