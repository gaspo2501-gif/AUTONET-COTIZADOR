const https = require('https');

https.get('https://cdn.deconcesionarias.com.ar/prod-9cf9b781de389646f2c47ed36708fb2378a9b702-1372/assets/PageBuilderApp-DEdwPcwk.js', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('PageBuilderApp length:', data.length);
    
    // Find all URL or endpoint patterns
    const endpoints = data.match(/['"`]\/[a-zA-Z0-9_\-\/]+['"`]/g) || [];
    console.log('Endpoints sample:', [...new Set(endpoints)].slice(0, 30));

    // Find any mentions of autonet or tenant or domain
    const domainMatches = data.match(/.{0,40}(domain|tenant|apiKey|search\/vehicles).{0,40}/gi) || [];
    console.log('Domain / Tenant occurrences:', domainMatches.slice(0, 10));
  });
});
