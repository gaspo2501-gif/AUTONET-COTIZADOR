/**
 * Sanitización recursiva de objetos antes de enviarlos a Cloud Firestore.
 * Firestore rechaza campos con valor 'undefined'.
 * 
 * Reglas:
 * - Elimina propiedades cuyo valor sea 'undefined'.
 * - Preserva valores válidos: 0, false, '', null, arrays y sub-objetos.
 * - Procesa recursivamente arrays y objetos anidados.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }

  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }

  return data;
}

/**
 * Normaliza una patente automotriz para usarla como Document ID seguro en Firestore.
 * - Uppercase
 * - Sin espacios en blanco
 * - Sin guiones ni símbolos no alfanuméricos
 * 
 * Ejemplo: " af-123 cd " -> "AF123CD"
 */
export function normalizePatenteDocId(patente: string | null | undefined): string {
  if (!patente) return '';
  return String(patente)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}
