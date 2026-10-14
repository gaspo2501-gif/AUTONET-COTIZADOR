const fs = require('fs');
const https = require('https');

const apiKey = '9a169d80-e446-4b45-b1d3-6fd0003d810c';

function queryByPlate(plate) {
  return new Promise(resolve => {
    https.get(`https://api.deconcesionarias.com.ar/api/pageBuilderSetting/search/vehicles?filter[plate]=${encodeURIComponent(plate)}&pagination[limit]=1&pagination[offset]=0`, {
      headers: {
        'api-key': apiKey,
        'Origin': 'https://autonet.com.ar',
        'Referer': 'https://autonet.com.ar/'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data && json.data.length > 0) {
            resolve(json.data[0]);
          } else {
            resolve(null);
          }
        } catch(e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function fetchPictures(vehicleId) {
  return new Promise(resolve => {
    https.get(`https://api.deconcesionarias.com.ar/api/vehicles/${vehicleId}/pictures/whiteList`, {
      headers: {
        'api-key': apiKey,
        'Origin': 'https://autonet.com.ar',
        'Referer': 'https://autonet.com.ar/'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.data || []);
        } catch(e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

// Concurrency limiter
async function runPool(items, fn, concurrency = 5) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      try {
        results[currentIndex] = await fn(items[currentIndex]);
      } catch(e) {
        results[currentIndex] = null;
      }
    }
  }
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const stockContent = fs.readFileSync('src/data/initialStock.ts', 'utf8');
  const start = stockContent.indexOf('export const INITIAL_STOCK: Vehicle[] = ');
  const jsonStr = stockContent.slice(start + 'export const INITIAL_STOCK: Vehicle[] = '.length).trim().replace(/;$/, '');
  const vehicles = JSON.parse(jsonStr);

  console.log(`Starting enrichment for ${vehicles.length} stock vehicles...`);

  const matchedMap = {};
  let count = 0;

  await runPool(vehicles, async (v) => {
    const cleanPlate = (v.patente || '').trim().replace(/\s+/g, '').toUpperCase();
    if (!cleanPlate || cleanPlate.length < 5) return;

    const webData = await queryByPlate(cleanPlate);
    if (webData) {
      count++;
      let pictures = [];
      if (webData.mainPicture && webData.mainPicture.url) {
        pictures.push(webData.mainPicture.url);
      }
      
      const gallery = await fetchPictures(webData.id);
      if (gallery && gallery.length > 0) {
        const gUrls = gallery.map(item => item.picture && item.picture.url).filter(Boolean);
        pictures = [...new Set([...pictures, ...gUrls])];
      }

      matchedMap[cleanPlate] = {
        autonetId: webData.id,
        plate: cleanPlate,
        brand: webData.brand,
        model: webData.model,
        version: webData.version,
        year: Number(webData.year) || v.anio,
        km: webData.km || v.kilometraje,
        precioPublicadoWeb: webData.advertisedPrice || undefined,
        urlAutonetOriginal: `https://autonet.com.ar/vehicle/${webData.id}`,
        fotoPrincipal: pictures[0] || (webData.mainPicture ? webData.mainPicture.url : ''),
        fotos: pictures,
        hasPhotos: pictures.length > 0,
        description: webData.description || '',
        statusWeb: webData.status,
        subStatusWeb: webData.subStatus
      };
      console.log(`[${count}] Matched ${cleanPlate} (${webData.brand} ${webData.model}) - Photos: ${pictures.length}`);
    }
  }, 6);

  console.log(`Total matched from PDF stock: ${count} out of ${vehicles.length}`);
  fs.writeFileSync('src/data/autonetMatchedStock.json', JSON.stringify(matchedMap, null, 2), 'utf8');
  console.log('Saved to src/data/autonetMatchedStock.json');
}

main();
