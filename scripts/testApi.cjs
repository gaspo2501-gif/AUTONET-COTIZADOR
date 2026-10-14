const https = require('https');

const apiKey = '9a169d80-e446-4b45-b1d3-6fd0003d810c';

function testEndpoint(path, headers = {}) {
  return new Promise((resolve) => {
    const url = 'https://api.deconcesionarias.com.ar/api/' + path;
    const req = https.get(url, {
      headers: {
        'Origin': 'https://autonet.com.ar',
        'Referer': 'https://autonet.com.ar/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data.slice(0, 300) });
      });
    });
    req.on('error', e => resolve({ error: e.message }));
  });
}

async function run() {
  console.log('Test 1: with api-key & Origin');
  console.log(await testEndpoint('pageBuilderSetting/search/vehicles?pagination[limit]=10&pagination[offset]=0', { 'api-key': apiKey }));

  console.log('Test 2: vehicles endpoint with Origin');
  console.log(await testEndpoint('vehicles?pagination[limit]=10&pagination[offset]=0', { 'api-key': apiKey }));

  console.log('Test 3: pageBuilderSetting/vehicles?pagination[limit]=10');
  console.log(await testEndpoint('pageBuilderSetting/vehicles?pagination[limit]=10', { 'api-key': apiKey }));

  console.log('Test 4: search by filter');
  console.log(await testEndpoint('pageBuilderSetting/search/vehicles?filter[status]=available&pagination[limit]=10&pagination[offset]=0', { 'api-key': apiKey }));
}

run();
