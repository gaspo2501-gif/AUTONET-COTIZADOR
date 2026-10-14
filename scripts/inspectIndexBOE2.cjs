const https = require('https');

https.get('https://cdn.deconcesionarias.com.ar/prod-9cf9b781de389646f2c47ed36708fb2378a9b702-1372/assets/index-BOE2-4pa.js', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('index-BOE2 length:', data.length);
    
    // Look for where domain prop is used
    let idx = 0;
    while ((idx = data.indexOf('domain', idx)) !== -1) {
      console.log('--- DOMAIN USAGE ---');
      console.log(data.slice(Math.max(0, idx - 80), Math.min(data.length, idx + 150)));
      idx += 20;
    }
  });
});
