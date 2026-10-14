const https = require('https');

https.get('https://cdn.deconcesionarias.com.ar/prod-9cf9b781de389646f2c47ed36708fb2378a9b702-1372/assets/AppPageBuilder-B72KgTVh.js', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('AppPageBuilder bundle length:', data.length);
    
    // Look for api calls or routes
    const routes = data.match(/['"]\/(api|pageBuilderSetting|public|vehicles|website)[^'"]*['"]/g) || [];
    console.log('Routes in AppPageBuilder:', [...new Set(routes)]);

    // Check how it loads the page or vehicles
    const apiCalls = data.match(/\.get\([^\)]*\)|\.post\([^\)]*\)/g) || [];
    console.log('get/post calls sample:', apiCalls.slice(0, 15));
  });
});
