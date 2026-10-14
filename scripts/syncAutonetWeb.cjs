const https = require('https');
const fs = require('fs');

const apiKey = '9a169d80-e446-4b45-b1d3-6fd0003d810c';

function fetchPage(offset = 0) {
  return new Promise(resolve => {
    https.get(`https://api.deconcesionarias.com.ar/api/pageBuilderSetting/search/vehicles?filter[status]=available&pagination[limit]=50&pagination[offset]=${offset}`, {
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
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: e.message, data: [] });
        }
      });
    }).on('error', e => resolve({ error: e.message, data: [] }));
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
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

async function main() {
  console.log('Fetching all vehicles from Autonet API...');
  const [p1, p2, p3] = await Promise.all([fetchPage(0), fetchPage(50), fetchPage(100)]);
  const allVehicles = [...p1.data, ...p2.data, ...(p3.data || [])];
  console.log(`Retrieved ${allVehicles.length} vehicles from Autonet.`);

  const webStockMap = {};

  for (let i = 0; i < allVehicles.length; i++) {
    const v = allVehicles[i];
    const plate = (v.plate || '').trim().toUpperCase();
    
    // Pictures
    let pictures = [];
    if (v.mainPicture && v.mainPicture.url) {
      pictures.push(v.mainPicture.url);
    }
    
    // Also fetch gallery for vehicles
    const gallery = await fetchPictures(v.id);
    if (gallery && gallery.length > 0) {
      const gUrls = gallery.map(item => item.picture && item.picture.url).filter(Boolean);
      pictures = [...new Set([...pictures, ...gUrls])];
    }

    const item = {
      id: v.id,
      plate: plate,
      brand: v.brand,
      model: v.model,
      version: v.version,
      year: Number(v.year) || undefined,
      km: v.km,
      advertisedPrice: v.advertisedPrice,
      currency: v.currencyAdvertisedPrice?.isocode || 'ARS',
      urlAutonetOriginal: `https://autonet.com.ar/vehicle/${v.id}`,
      fotoPrincipal: pictures[0] || (v.mainPicture ? v.mainPicture.url : ''),
      fotos: pictures,
      description: v.description || '',
      vehicleType: v.vehicleType,
      originType: v.originType,
      acceptsFinancing: v.acceptsFinancing,
      physicalLocation: v.physicalLocation,
      virtualLocation: v.virtualLocation,
      hasPhotos: pictures.length > 0
    };

    if (plate) {
      webStockMap[plate] = item;
    }
    // Also store by brand-model-year
    const fallbackKey = `${(v.brand || '').toLowerCase()}_${(v.model || '').toLowerCase()}_${v.year}`;
    if (!webStockMap[fallbackKey]) {
      webStockMap[fallbackKey] = item;
    }
  }

  const outPath = 'src/data/autonetWebStock.json';
  fs.writeFileSync(outPath, JSON.stringify(webStockMap, null, 2), 'utf8');
  console.log(`Saved ${Object.keys(webStockMap).length} mapped items to ${outPath}`);
}

main();
