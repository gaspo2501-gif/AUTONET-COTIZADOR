const https = require('https');
const apiKey = '9a169d80-e446-4b45-b1d3-6fd0003d810c';
const vehicleId = '00b3ea21-b721-4ff3-bd44-a8a53f152456';

const endpoints = [
  `pageBuilderSetting/vehicles/${vehicleId}`,
  `pageBuilderSetting/vehicles/${vehicleId}/multimedia`,
  `pageBuilderSetting/vehicles/${vehicleId}/pictures`,
  `pageBuilderSetting/vehicles/${vehicleId}/files`,
  `pageBuilderSetting/vehicles/multimedia/${vehicleId}`,
  `pageBuilderSetting/vehicles/files/${vehicleId}`,
  `vehicles/${vehicleId}/whiteList`,
  `vehicles/${vehicleId}/external`,
  `pageBuilderSetting/vehicles/${vehicleId}/whiteList`,
  `multimedia/vehicles/${vehicleId}`
];

function test(ep) {
  return new Promise(resolve => {
    https.get(`https://api.deconcesionarias.com.ar/api/${ep}`, {
      headers: {
        'api-key': apiKey,
        'Origin': 'https://autonet.com.ar',
        'Referer': 'https://autonet.com.ar/'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({ ep, status: res.statusCode, length: data.length, sample: data.slice(0, 150) });
      });
    }).on('error', e => resolve({ ep, error: e.message }));
  });
}

async function run() {
  for (const ep of endpoints) {
    const res = await test(ep);
    console.log(res.status, res.ep, res.sample);
  }
}
run();
