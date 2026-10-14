/** Validaciones de documentos argentinos usados en el boleto. */

export const onlyDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** DNI: 7 u 8 dígitos (acepta puntos/espacios). */
export function isValidDni(dni: string | undefined): boolean {
  const d = onlyDigits(dni);
  return d.length >= 7 && d.length <= 8 && Number(d) > 1_000_000;
}

/** CUIT/CUIL: 11 dígitos, prefijo válido y dígito verificador (módulo 11). */
export function isValidCuit(cuit: string | undefined): boolean {
  const d = onlyDigits(cuit);
  if (d.length !== 11) return false;
  if (!['20', '23', '24', '25', '26', '27', '30', '33', '34'].includes(d.slice(0, 2))) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) check = 9; // caso especial (prefijos 23/33)
  return check === Number(d[10]);
}

/** El CUIT/CUIL de persona humana contiene el DNI en las posiciones 3 a 10. */
export function cuitMatchesDni(cuit: string | undefined, dni: string | undefined): boolean {
  const c = onlyDigits(cuit);
  const d = onlyDigits(dni);
  if (c.length !== 11 || !d) return true;
  if (c.startsWith('30') || c.startsWith('33') || c.startsWith('34')) return true; // persona jurídica
  return c.slice(2, 10) === d.padStart(8, '0');
}

/** Calcula el CUIL más probable a partir de DNI y sexo (para sugerir). */
export function suggestCuil(dni: string, sexo: 'M' | 'F'): string | null {
  const d = onlyDigits(dni).padStart(8, '0');
  if (d.length !== 8) return null;
  for (const prefix of sexo === 'M' ? ['20', '23'] : ['27', '23']) {
    for (let v = 0; v <= 9; v++) {
      const c = `${prefix}${d}${v}`;
      if (isValidCuit(c)) return formatCuit(c);
    }
  }
  return null;
}

export function formatCuit(cuit: string): string {
  const d = onlyDigits(cuit);
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : cuit;
}

export function formatDni(dni: string): string {
  const d = onlyDigits(dni);
  return d ? Number(d).toLocaleString('es-AR') : dni;
}

/** Patente argentina: Mercosur (AA123BB), anterior (ABC123) o moto (A123BCD / 123ABC). */
export function isValidPlate(p: string | undefined): boolean {
  const c = String(p ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(c) || /^[A-Z]{3}\d{3}$/.test(c) || /^[A-Z]\d{3}[A-Z]{3}$/.test(c) || /^\d{3}[A-Z]{3}$/.test(c);
}

/** Número de chasis (VIN): 17 caracteres, sin I, O ni Q. */
export function isValidVin(v: string | undefined): boolean {
  const c = String(v ?? '').toUpperCase().replace(/[\s-]/g, '');
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(c);
}
