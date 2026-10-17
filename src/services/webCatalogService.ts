import { Vehicle } from '../types/stock';
import { normalizePatent } from '../utils/vehicleIdentity';

/**
 * CATÁLOGO DE LA WEB DE AUTONET
 * Lo genera GitHub Actions varias veces por día (scripts/fetchAutonetWeb.mjs) y se publica
 * junto a la app, con la foto principal de cada unidad guardada en el mismo sitio.
 * La app lo lee al abrir y lo superpone al stock (fotos, link y precio web) sin modificar Firebase.
 */
export interface WebCatalogVehicle {
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

/** Superpone los datos de la web (fotos, link, precio publicado) al stock, sin persistir. */
export function mergeWebCatalog(vehicles: Vehicle[], c: WebCatalog | null): Vehicle[] {
  if (!c) return vehicles;
  return vehicles.map((v) => {
    const w = c.vehicles[normalizePatent(v.patente)];
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
  const inStock = new Set(vehicles.map((v) => normalizePatent(v.patente)));
  return (Object.values(c.vehicles) as WebCatalogVehicle[])
    .filter((w) => w.plate && !inStock.has(w.plate))
    .map((w) => {
      const local = w.fotoLocal ? `${base}${w.fotoLocal}` : undefined;
      return {
        id: `WEB-${w.plate}`,
        marca: w.brand || '',
        modelo: (w.model || '').toUpperCase(),
        version: (w.version || '').toUpperCase(),
        anio: w.year || 0,
        color: null,
        kilometraje: w.km ?? null,
        precio: w.precioPublicadoWeb ?? null,
        moneda: w.moneda || 'ARS',
        patente: w.plate,
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
