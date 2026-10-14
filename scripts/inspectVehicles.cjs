const https = require('https');

https.get('https://cdn.deconcesionarias.com.ar/prod-9cf9b781de389646f2c47ed36708fb2378a9b702-1372/assets/main-B_uvbpuj.js', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    let idx = 0;
    while ((idx = data.indexOf('/vehicles', idx)) !== -1) {
      console.log('--- VEHICLES CONTEXT ---');
      console.log(data.slice(Math.max(0, idx - 100), Math.min(data.length, idx + 200)));
      idx += 10;
    }
  });
});
