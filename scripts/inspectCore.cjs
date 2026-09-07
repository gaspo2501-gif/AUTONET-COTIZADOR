const https = require('https');

https.get('https://cdn.deconcesionarias.com.ar/prod-9cf9b781de389646f2c47ed36708fb2378a9b702-1372/assets/core-CSdOKajm.js', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('core bundle length:', data.length);
    const urls = data.match(/https?:\/\/[^\s"'`\)]+/g) || [];
    console.log('URLs in core:', [...new Set(urls)].slice(0, 20));

    // Look for routes
    const routes = data.match(/['"]\/(api|pageBuilderSetting|public|vehicles|website)[^'"]*['"]/g) || [];
    console.log('Routes in core:', [...new Set(routes)].slice(0, 30));

    // Look for how it fetches website/tenant data on public sites
    const keywords = ['pageBuilder', 'website', 'domain', 'apiKey', 'api-key', 'tenant'];
    for (const kw of keywords) {
      let idx = 0;
      let count = 0;
      while ((idx = data.indexOf(kw, idx)) !== -1 && count < 3) {
        console.log(`[${kw}]`, data.slice(Math.max(0, idx - 60), Math.min(data.length, idx + 120)));
        idx += kw.length + 20;
        count++;
      }
    }
  });
});
