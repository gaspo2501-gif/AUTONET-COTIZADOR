export function formatCurrency(amount: number, currency: 'ARS' | 'USD' = 'ARS'): string {
  if (isNaN(amount)) return '$ 0';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Normaliza cualquier valor de kilometraje a número entero o null.
 * Reglas esenciales:
 * - Acepta: number | string | null | undefined
 * - Devuelve: number | null
 * - Los formatos argentinos usan punto (.) como separador de miles:
 *   "129.000" => 129000
 *   "49.600"  => 49600
 *   "50.000"  => 50000
 *   "50.001"  => 50001
 *   "4.800"   => 4800
 *   "0"       => 0
 *   49600     => 49600
 *   "49.600 km" => 49600
 *   "49,600"  => 49600
 *   " 49.600 " => 49600
 *   "49600"   => 49600
 * NUNCA debe interpretar "129.000" como el decimal 129 ni comparar cadenas alfabéticamente.
 */
export function normalizeMileage(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) return null;
    return Math.round(value);
  }

  const str = String(value).trim();
  if (!str) return null;

  // Remover palabras o sufijos como "km", "kms", "kilometros"
  let clean = str.replace(/km[s]?\b/gi, '').trim();

  // Si tiene formato con puntos o comas de miles ("129.000", "49,600"), remover separadores
  clean = clean.replace(/[,.]/g, '').replace(/\s+/g, '');

  const num = parseInt(clean, 10);
  if (isNaN(num) || !isFinite(num)) return null;

  return num;
}

export function formatKm(km: number | string | null | undefined): string {
  const normalized = normalizeMileage(km);
  if (normalized === null || isNaN(normalized)) return '0 km';
  return `${normalized.toLocaleString('es-AR')} km`;
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatDateShort(dateString: string): string {
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}
