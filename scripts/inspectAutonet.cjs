const https = require('https');

https.get('https://cdn.deconcesionarias.com.ar/prod-9cf9b781de389646f2c47ed36708fb2378a9b702-1372/assets/main-B_uvbpuj.js', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Bundle length:', data.length);
    
    // Find axios or fetch base url or routes
    const apiMatches = data.match(/api\.deconcesionarias\.com\.ar[^"'`\s]*/g) || [];
    console.log('API mentions:', [...new Set(apiMatches)]);

    // Find routes like "/api/v1" or "/v1" or similar
    const routes = data.match(/"\/(api|v1|publicaciones|vehiculos|vehicles|tenant|dealer)[^"]*"/g) || [];
    console.log('Routes sample:', [...new Set(routes)].slice(0, 30));

    // Look for how autonet tenant is identified (subdomain, header, etc.)
    const tenantMatches = data.match(/autonet/gi) || [];
    console.log('Autonet mentions count:', tenantMatches.length);
  });
});
