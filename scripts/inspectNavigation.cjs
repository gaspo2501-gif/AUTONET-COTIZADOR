const https = require('https');

https.get('https://cdn.deconcesionarias.com.ar/prod-9cf9b781de389646f2c47ed36708fb2378a9b702-1372/assets/main-B_uvbpuj.js', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    // Look for routes or url constructions
    const matches = data.match(/navigate\([^)]*\)/g) || [];
    console.log('Navigate calls count:', matches.length);
    console.log('Navigate samples:', matches.slice(0, 10));

    // Look for vehicle link constructions
    const linkMatches = data.match(/(\/[a-zA-Z0-9_\-]+\/\$\{[^}]+\})/g) || [];
    console.log('Dynamic routes:', [...new Set(linkMatches)]);
  });
});
