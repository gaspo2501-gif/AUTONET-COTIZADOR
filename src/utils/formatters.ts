export function formatCurrency(amount: number, currency: 'ARS' | 'USD' = 'ARS'): string {
  if (isNaN(amount)) return '$ 0';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Parsea un número entero en notación argentina donde el punto (.) separa miles.
 * Ejemplos:
 * '136.000' -> 136000
 * '26.200' -> 26200
 * '3.200' -> 3200
 * '19.300.000' -> 19300000
 * '29.000.000' -> 29000000
 * '$ 19.300.000,00' -> 19300000
 */
export function parseArgentineInteger(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return isNaN(value) || !isFinite(value) ? null : Math.round(value);
  }
  const str = String(value).trim();
  if (!str) return null;

  // Si tiene decimales tras la coma (ej: ",00"), se descartan
  const beforeComma = str.split(',')[0];
  // Retirar símbolos de moneda, letras, espacios y puntos separadores de miles
  const digits = beforeComma.replace(/[^0-9]/g, '');
  if (!digits) return null;

  const num = parseInt(digits, 10);
  return isNaN(num) ? null : num;
}

/**
 * Parsea kilometraje de vehículos garantizando que nunca se interprete como decimal
 * y reconociendo unidades como '0 km', '136.000', '-', etc.
 */
export function parseMileage(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (/^(0|0\s*km|cero|-)$/i.test(str)) return 0;
  return parseArgentineInteger(value);
}

/**
 * Parsea precios de venta de vehículos en pesos argentinos.
 */
export function parsePrice(value: string | number | null | undefined): number | null {
  return parseArgentineInteger(value);
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
