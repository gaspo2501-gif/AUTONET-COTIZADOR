/**
 * SINCRONIZACIÓN AUTOMÁTICA CON LA WEB DE AUTONET (se ejecuta en GitHub Actions)
 *
 * 1. Lee todas las unidades publicadas en autonet.com.ar (API de DeConcesionarias).
 * 2. Descarga la foto principal de cada unidad, achicada a 1080 px, dentro del sitio
 *    publicado (misma dirección que la app → se puede usar en las historias sin bloqueos).
 * 3. Escribe public/autonet-web/catalog.json, que la app lee al abrir.
 * 4. Compara con el catálogo publicado anteriormente para marcar unidades nuevas
 *    en la web y cambios de precio.
 *
 * Si algo falla (sin conexión, la API cambió, etc.) NO corta la publicación:
 * la app sigue funcionando con el último catálogo que tenga.
 *
 * Uso: node scripts/fetchAutonetWeb.mjs
 * Variables opcionales: AUTONET_API_KEY, PREVIOUS_CATALOG_URL
 */
import fs from 'node:fs';
import path from 'node:path';

const API = process.env.AUTONET_API_BASE || 'https://api.deconcesionarias.com.ar/api';
// Clave pública que usa la propia web de autonet.com.ar. Se puede reemplazar con el secreto AUTONET_API_KEY.
const API_KEY = process.env.AUTONET_API_KEY || '9a169d80-e446-4b45-b1d3-6fd0003d810c';
const HEADERS = { 'api-key': API_KEY, Origin: 'https://autonet.com.ar', Referer: 'https://autonet.com.ar/', Accept: 'application/json' };
const OUT_DIR = path.join(process.cwd(), 'public', 'autonet-web');
const PHOTO_DIR = path.join(OUT_DIR, 'fotos');
const PAGE = 50;

const log = (...a) => console.log('[autonet-web]', ...a);
const normPlate = (p) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function getJson(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          out[i] = await fn(items[i], i);
        } catch (e) {
          out[i] = undefined;
        }
      }
    })
  );
  return out;
}

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    log('sharp no disponible: las fotos se guardan sin achicar.');
    return null;
  }
}

async function main() {
  // ---------- 1. Unidades publicadas ----------
  const vehicles = [];
  for (let offset = 0; offset < 2000; offset += PAGE) {
    const json = await getJson(`${API}/pageBuilderSetting/search/vehicles?filter[status]=available&pagination[limit]=${PAGE}&pagination[offset]=${offset}`);
    const data = Array.isArray(json?.data) ? json.data : [];
    vehicles.push(...data);
    if (data.length < PAGE) break;
  }
  log(`Unidades publicadas en la web: ${vehicles.length}`);
  if (vehicles.length === 0) throw new Error('La web no devolvió unidades (se conserva el catálogo anterior).');

  // ---------- 2. Catálogo anterior (para novedades y precios) ----------
  let previous = {};
  if (process.env.PREVIOUS_CATALOG_URL) {
    try {
      const res = await fetch(process.env.PREVIOUS_CATALOG_URL, { signal: AbortSignal.timeout(15000) });
      if (res.ok) previous = (await res.json())?.vehicles || {};
      log(`Catálogo anterior: ${Object.keys(previous).length} unidades`);
    } catch {
      log('No se pudo leer el catálogo anterior (primera ejecución o sitio sin publicar).');
    }
  }

  // ---------- 3. Galerías + foto principal local ----------
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  const sharp = await loadSharp();
  const now = new Date().toISOString();
  const hasPrevious = Object.keys(previous).length > 0;

  const items = await pool(vehicles, 6, async (v) => {
    const plate = normPlate(v.plate);
    let fotos = [];
    if (v.mainPicture?.url) fotos.push(v.mainPicture.url);
    try {
      const g = await getJson(`${API}/vehicles/${v.id}/pictures/whiteList`, 2);
      const urls = (g?.data || []).map((p) => p?.picture?.url).filter(Boolean);
      fotos = [...new Set([...fotos, ...urls])];
    } catch {
      /* sin galería: queda la principal */
    }

    let fotoLocal;
    if (plate && fotos[0]) {
      try {
        const res = await fetch(fotos[0], { headers: { Referer: 'https://autonet.com.ar/' }, signal: AbortSignal.timeout(25000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const file = path.join(PHOTO_DIR, `${plate}.jpg`);
          if (sharp) {
            await sharp(buf).rotate().resize({ width: 1080, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(file);
          } else {
            fs.writeFileSync(file, buf);
          }
          fotoLocal = `autonet-web/fotos/${plate}.jpg`;
        }
      } catch {
        /* se usa la URL remota */
      }
    }

    const prev = plate ? previous[plate] : undefined;
    const precio = Number(v.advertisedPrice) || undefined;
    return {
      plate,
      autonetId: v.id,
      brand: v.brand,
      model: v.model,
      version: v.version,
      year: Number(v.year) || undefined,
      km: Number(v.km) || 0,
      precioPublicadoWeb: precio,
      moneda: v.currencyAdvertisedPrice?.isocode || 'ARS',
      urlAutonetOriginal: `https://autonet.com.ar/vehicle/${v.id}`,
      fotoPrincipal: fotos[0] || '',
      fotos,
      fotoLocal,
      descripcion: v.description || '',
      // En la primera ejecución no hay con qué comparar: nada se marca como nuevo
      firstSeen: prev?.firstSeen || (hasPrevious ? now : null),
      precioAnteriorWeb: prev && prev.precioPublicadoWeb && precio && precio !== prev.precioPublicadoWeb ? prev.precioPublicadoWeb : prev?.precioAnteriorWeb,
      cambioPrecioEl: prev && prev.precioPublicadoWeb && precio && precio !== prev.precioPublicadoWeb ? now : prev?.cambioPrecioEl,
    };
  });

  const map = {};
  for (const it of items) if (it?.plate) map[it.plate] = it;

  const catalog = {
    generatedAt: now,
    total: Object.keys(map).length,
    conFoto: Object.values(map).filter((v) => v.fotoLocal || v.fotoPrincipal).length,
    vehicles: map,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog));
  log(`Catálogo escrito: ${catalog.total} unidades, ${catalog.conFoto} con foto.`);
}

main().catch(async (e) => {
  log('Sincronización omitida:', e?.message || e);
  // Conservar el último catálogo publicado (con fotos remotas) para no perder información
  if (process.env.PREVIOUS_CATALOG_URL) {
    try {
      const res = await fetch(process.env.PREVIOUS_CATALOG_URL, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const prev = await res.json();
        Object.values(prev.vehicles || {}).forEach((v) => delete v.fotoLocal);
        fs.mkdirSync(OUT_DIR, { recursive: true });
        fs.writeFileSync(path.join(OUT_DIR, 'catalog.json'), JSON.stringify({ ...prev, stale: true }));
        log('Se republica el catálogo anterior.');
      }
    } catch {
      /* sin catálogo */
    }
  }
  process.exit(0); // nunca frena la publicación
});
