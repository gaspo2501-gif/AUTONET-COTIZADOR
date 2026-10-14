const fs = require('fs');

const matched = JSON.parse(fs.readFileSync('src/data/autonetMatchedStock.json', 'utf8'));
const stockContent = fs.readFileSync('src/data/initialStock.ts', 'utf8');
const start = stockContent.indexOf('export const INITIAL_STOCK: Vehicle[] = ');
const jsonStr = stockContent.slice(start + 'export const INITIAL_STOCK: Vehicle[] = '.length).trim().replace(/;$/, '');
const vehicles = JSON.parse(jsonStr);

let enrichedCount = 0;
let totalPhotos = 0;
const enrichedVehicles = vehicles.map(v => {
  const cleanPlate = (v.patente || '').trim().replace(/\s+/g, '').toUpperCase();
  const web = matched[cleanPlate];
  if (web) {
    enrichedCount++;
    totalPhotos += (web.fotos || []).length;
    return {
      ...v,
      fotoPrincipal: web.fotoPrincipal || v.fotoPrincipal,
      fotos: web.fotos && web.fotos.length > 0 ? web.fotos : v.fotos,
      urlAutonetOriginal: web.urlAutonetOriginal,
      precioPublicadoWeb: web.precioPublicadoWeb,
      sincronizadoAutonetWeb: true,
      fechaSincronizacionWeb: '2026-09-04T15:00:00.000Z',
      descripcionWeb: web.description || undefined,
      autonetWebId: web.autonetId,
    };
  }
  return {
    ...v,
    sincronizadoAutonetWeb: false
  };
});

console.log('Total vehicles:', enrichedVehicles.length);
console.log('Enriched with real Autonet web data:', enrichedCount);
console.log('Total real photos attached:', totalPhotos);

const tsContent = `import { Vehicle } from '../types/stock';

/**
 * Stock real oficial extraído de la lista PDF de Autonet ('STOCK UNIDADES DISPONIBLES AUTONET AL 1-9-2026')
 * complementado con información oficial, enlaces y fotografías reales de https://autonet.com.ar/
 * Total unidades: ${enrichedVehicles.length}
 * Unidades con fotos y publicación oficial en Autonet: ${enrichedCount}
 */
export const INITIAL_STOCK: Vehicle[] = ${JSON.stringify(enrichedVehicles, null, 2)};
`;

fs.writeFileSync('src/data/initialStock.ts', tsContent, 'utf8');
console.log('Updated src/data/initialStock.ts successfully!');
