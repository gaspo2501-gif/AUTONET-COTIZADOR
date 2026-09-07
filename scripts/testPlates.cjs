const https = require('https');
const apiKey = '9a169d80-e446-4b45-b1d3-6fd0003d810c';

function searchByPlate(plate) {
  return new Promise(resolve => {
    https.get('https://api.deconcesionarias.com.ar/api/pageBuilderSetting/search/vehicles?filter[plate]=' + encodeURIComponent(plate) + '&pagination[limit]=5&pagination[offset]=0', {
      headers: {
        'api-key': apiKey,
        'Origin': 'https://autonet.com.ar'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data && json.data.length > 0) {
            const v = json.data[0];
            resolve({
              found: true,
              plate: v.plate,
              brand: v.brand,
              model: v.model,
              version: v.version,
              year: v.year,
              km: v.km,
              advertisedPrice: v.advertisedPrice,
              mainPic: v.mainPicture ? v.mainPicture.url : null,
              description: v.description,
              id: v.id
            });
          } else {
            resolve({ found: false, plate });
          }
        } catch(e) {
          resolve({ found: false, error: e.message });
        }
      });
    });
  });
}

const testPlates = ['AE563OV', 'AG305DT', 'AG769TR', 'AD098IK', 'AF991NM', 'AE698RR', 'AG466LR', 'AF458AG', 'AF340TG', 'AA123BB'];

async function run() {
  for (const p of testPlates) {
    const res = await searchByPlate(p);
    console.log(p, res.found ? `FOUND: ${res.brand} ${res.model} (${res.year}) - ID: ${res.id} - Pic: ${!!res.mainPic}` : 'NOT FOUND IN WEB');
  }
}
run();
