import { Vehicle } from '../types/stock';
import { normalizePatent } from '../utils/vehicleIdentity';

/**
 * CATÁLOGO DE LA WEB DE AUTONET
 * Lo genera GitHub Actions varias veces por día (scripts/fetchAutonetWeb.mjs) y se publica
 * junto a la app, con la foto principal de cada unidad guardada en el mismo sitio.
 * La app lo lee al abrir y lo superpone al stock (fotos, link y precio web) sin modificar Firebase.
 */
export interface WebCatalogVehicle {
  /** Clave en el catálogo: patente, o ID-… si la web no informa la patente */
  key?: string;
  plate: string;
  autonetId?: string;
  brand?: string;
  model?: string;
  version?: string;
  year?: number;
  km?: number;
  precioPublicadoWeb?: number;
  moneda?: 'ARS' | 'USD';
  urlAutonetOriginal?: string;
  fotoPrincipal?: string;
  fotos?: string[];
  fotoLocal?: string;
  descripcion?: string;
  firstSeen?: string | null;
  precioAnteriorWeb?: number;
  cambioPrecioEl?: string;
}

export interface WebCatalog {
  generatedAt: string;
  total: number;
  conFoto: number;
  stale?: boolean;
  vehicles: Record<string, WebCatalogVehicle>;
}

const CACHE_KEY = 'autonet_web_catalog_v1';
const base = (() => {
  const b = (import.meta.env?.BASE_URL as string) || '/';
  return b.endsWith('/') ? b : `${b}/`;
})();

let catalog: WebCatalog | null = (() => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as WebCatalog) : null;
  } catch {
    return null;
  }
})();
let loading: Promise<WebCatalog | null> | null = null;
const listeners: ((c: WebCatalog | null) => void)[] = [];

export const webCatalogService = {
  get: () => catalog,
  subscribe(l: (c: WebCatalog | null) => void) {
    listeners.push(l);
    return () => {
      const i = listeners.indexOf(l);
      if (i >= 0) listeners.splice(i, 1);
    };
  },
  /** Descarga el catálogo publicado (si no existe, la app sigue con lo que tenía). */
  refresh(): Promise<WebCatalog | null> {
    if (loading) return loading;
    loading = fetch(`${base}autonet-web/catalog.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: WebCatalog | null) => {
        if (c && c.vehicles) {
          catalog = c;
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(c));
          } catch {
            /* sin espacio: queda en memoria */
          }
          listeners.forEach((l) => l(c));
        }
        return catalog;
      })
      .catch(() => catalog)
      .finally(() => {
        loading = null;
      });
    return loading;
  },
  /** URL de foto utilizable en las historias (misma dirección que la app cuando existe). */
  photoUrl(w: WebCatalogVehicle): string | undefined {
    if (w.fotoLocal) return `${base}${w.fotoLocal}`;
    return w.fotoPrincipal || w.fotos?.[0];
  },
};

/** Patente a mostrar para una unidad web (si la web no la informa, un código interno). */
export const webPatente = (w: WebCatalogVehicle) => w.plate || `WEB ${String(w.autonetId || w.key || '').replace(/^ID-/, '').slice(0, 6).toUpperCase()}`;

const normTxt = (x: unknown) =>
  String(x ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Relaciona cada unidad de la web con una unidad del stock:
 * 1) por patente; 2) si la web no informa patente, por marca + modelo + año
 *    y el kilometraje / precio más parecidos (cada unidad se usa una sola vez).
 * Devuelve: patente del stock → unidad web, y la lista de unidades web sin pareja.
 */
export function matchWebCatalog(vehicles: Vehicle[], c: WebCatalog | null): { byPlate: Map<string, WebCatalogVehicle>; unmatched: WebCatalogVehicle[] } {
  const byPlate = new Map<string, WebCatalogVehicle>();
  if (!c) return { byPlate, unmatched: [] };
  const web = Object.values(c.vehicles) as WebCatalogVehicle[];
  const stockByPlate = new Map(vehicles.map((v) => [normalizePatent(v.patente), v]));
  const pending: WebCatalogVehicle[] = [];

  for (const w of web) {
    const p = normalizePatent(w.plate);
    if (p && stockByPlate.has(p) && !byPlate.has(p)) byPlate.set(p, w);
    else pending.push(w);
  }

  // Candidatos por similitud
  type Cand = { w: WebCatalogVehicle; v: Vehicle; score: number };
  const cands: Cand[] = [];
  for (const w of pending) {
    if (w.plate) continue; // tiene patente pero no está en el stock: es "solo web"
    const wb = normTxt(w.brand);
    const wm = normTxt(w.model);
    for (const v of vehicles) {
      const p = normalizePatent(v.patente);
      if (byPlate.has(p)) continue;
      if (normTxt(v.marca) !== wb) continue;
      const vm = normTxt(v.modelo);
      if (!(vm === wm || vm.startsWith(`${wm} `) || wm.startsWith(`${vm} `) || vm.includes(wm) || wm.includes(vm))) continue;
      if (w.year && v.anio && Number(w.year) !== Number(v.anio)) continue;
      let score = (vm === wm ? 10 : 5) + (v.estado === 'Disponible' || v.estado === 'Reservado' ? 15 : 0);
      const vkm = typeof v.kilometraje === 'number' ? v.kilometraje : null;
      if (vkm !== null && typeof w.km === 'number' && w.km > 0) {
        const diff = Math.abs(vkm - w.km);
        if (diff > Math.max(5000, vkm * 0.08)) continue;
        score += 20 - Math.min(20, diff / 500);
      }
      if (v.precio && w.precioPublicadoWeb) {
        const rel = Math.abs(v.precio - w.precioPublicadoWeb) / v.precio;
        if (rel > 0.25) continue;
        score += 10 - Math.min(10, rel * 100);
      }
      const words = normTxt(w.version).split(' ').filter((x) => x.length > 1);
      const vver = normTxt(v.version);
      score += words.filter((x) => vver.includes(x)).length;
      cands.push({ w, v, score });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const usedWeb = new Set<WebCatalogVehicle>();
  for (const cnd of cands) {
    const p = normalizePatent(cnd.v.patente);
    if (byPlate.has(p) || usedWeb.has(cnd.w)) continue;
    byPlate.set(p, cnd.w);
    usedWeb.add(cnd.w);
  }
  const matched = new Set(byPlate.values());
  return { byPlate, unmatched: web.filter((w) => !matched.has(w)) };
}

/** Superpone los datos de la web (fotos, link, precio publicado) al stock, sin persistir. */
export function mergeWebCatalog(vehicles: Vehicle[], c: WebCatalog | null): Vehicle[] {
  if (!c) return vehicles;
  const { byPlate } = matchWebCatalog(vehicles, c);
  return vehicles.map((v) => {
    const w = byPlate.get(normalizePatent(v.patente));
    if (!w) return v;
    const local = w.fotoLocal ? `${base}${w.fotoLocal}` : undefined;
    const remote = w.fotos && w.fotos.length ? w.fotos : v.fotos || [];
    return {
      ...v,
      fotoPrincipal: local || w.fotoPrincipal || v.fotoPrincipal,
      fotos: local ? [local, ...remote.slice(1)] : remote,
      urlAutonetOriginal: w.urlAutonetOriginal || v.urlAutonetOriginal,
      precioPublicadoWeb: w.precioPublicadoWeb || v.precioPublicadoWeb,
      sincronizadoAutonetWeb: true,
      fechaSincronizacionWeb: c.generatedAt,
      descripcionWeb: w.descripcion || v.descripcionWeb,
      autonetWebId: w.autonetId || v.autonetWebId,
    };
  });
}

/** Unidades publicadas en la web que todavía no están en el stock de la app (falta importar el PDF). */
export function webOnlyVehicles(vehicles: Vehicle[], c: WebCatalog | null): Vehicle[] {
  if (!c) return [];
  return matchWebCatalog(vehicles, c)
    .unmatched.filter((w) => w.brand || w.model)
    .map((w) => {
      const local = w.fotoLocal ? `${base}${w.fotoLocal}` : undefined;
      return {
        id: `WEB-${w.plate || w.key || w.autonetId}`,
        marca: w.brand || '',
        modelo: (w.model || '').toUpperCase(),
        version: (w.version || '').toUpperCase(),
        anio: w.year || 0,
        color: null,
        kilometraje: w.km ?? null,
        precio: w.precioPublicadoWeb ?? null,
        moneda: w.moneda || 'ARS',
        patente: webPatente(w),
        combustible: /DIESEL|DIÉSEL|TDI|HDI|CRDI|DCI|D-4D|\bTD\b/i.test(`${w.version} ${w.model}`) ? 'Diésel' : 'Nafta',
        caja: /\b(AT|CVT|AUTOM)/i.test(w.version || '') ? 'Automática' : 'Manual',
        traccion: /4X4|AWD/i.test(w.version || '') ? '4x4' : '4x2',
        estado: 'Disponible',
        observaciones: 'Publicada en la web de Autonet; todavía no figura en el PDF de stock.',
        fotos: local ? [local, ...(w.fotos || []).slice(1)] : w.fotos || [],
        fotoPrincipal: local || w.fotoPrincipal || '',
        urlAutonetOriginal: w.urlAutonetOriginal,
        fechaActualizacion: c.generatedAt,
        fechaIncorporacion: w.firstSeen || c.generatedAt,
        origenDato: 'autonet_web',
        sincronizadoAutonetWeb: true,
      } as Vehicle;
    });
}
