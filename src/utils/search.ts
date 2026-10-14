import { Vehicle } from '../types/stock';
import { normalizePatent } from './vehicleIdentity';

/**
 * BÚSQUEDA INTELIGENTE DE STOCK
 * - Ignora mayúsculas y acentos ("diesel" encuentra "Diésel").
 * - Multi-palabra: todas las palabras deben coincidir ("hilux 2022 diesel").
 * - Patentes con o sin espacios ("AF 458 AG" = "af458ag").
 * - Números de 4 dígitos entre 1980 y 2035 se interpretan como año exacto
 *   si no coinciden como texto.
 */

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

const indexCache = new WeakMap<Vehicle, string>();

export function getVehicleSearchIndex(v: Vehicle): string {
  const cached = indexCache.get(v);
  if (cached) return cached;
  const idx = normalizeText(
    [
      v.patente,
      normalizePatent(v.patente),
      v.marca,
      v.modelo,
      v.version,
      v.anio,
      v.color,
      v.combustible,
      v.caja,
      v.traccion,
      v.empresa,
      v.ubLabel,
      v.id,
    ]
      .filter(Boolean)
      .join(' ')
  );
  indexCache.set(v, idx);
  return idx;
}

export function tokenizeQuery(query: string): string[] {
  return normalizeText(query)
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9.ñ/-]/g, ''))
    .filter(Boolean);
}

export function matchesSearch(v: Vehicle, query: string): boolean {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return true;

  // Patente completa o parcial escrita con/sin espacios
  const cleanQuery = normalizePatent(query);
  const cleanPlate = normalizePatent(v.patente);
  if (cleanQuery.length >= 3 && cleanPlate && cleanPlate.includes(cleanQuery)) return true;

  const index = getVehicleSearchIndex(v);
  return tokens.every((t) => {
    if (index.includes(t)) return true;
    if (/^\d{4}$/.test(t)) {
      const year = Number(t);
      if (year >= 1980 && year <= 2035) return v.anio === year;
    }
    return false;
  });
}

/** Devuelve fragmentos para resaltar coincidencias en un texto. */
export function splitHighlight(text: string, query: string): { text: string; hit: boolean }[] {
  const tokens = tokenizeQuery(query).filter((t) => t.length >= 2);
  if (!text || tokens.length === 0) return [{ text, hit: false }];
  const norm = normalizeText(text);
  const marks = new Array(text.length).fill(false);
  for (const t of tokens) {
    let from = 0;
    while (from < norm.length) {
      const i = norm.indexOf(t, from);
      if (i === -1) break;
      for (let k = i; k < i + t.length && k < marks.length; k++) marks[k] = true;
      from = i + t.length;
    }
  }
  const out: { text: string; hit: boolean }[] = [];
  let buf = '';
  let cur = marks[0];
  for (let i = 0; i < text.length; i++) {
    if (marks[i] !== cur) {
      out.push({ text: buf, hit: cur });
      buf = '';
      cur = marks[i];
    }
    buf += text[i];
  }
  if (buf) out.push({ text: buf, hit: cur });
  return out;
}
