const fs = require('fs');
const matched = JSON.parse(fs.readFileSync('src/data/autonetMatchedStock.json', 'utf8'));
const webStock = JSON.parse(fs.readFileSync('src/data/autonetWebStock.json', 'utf8'));
const stockContent = fs.readFileSync('src/data/initialStock.ts', 'utf8');
const start = stockContent.indexOf('export const INITIAL_STOCK: Vehicle[] = ');
const jsonStr = stockContent.slice(start + 'export const INITIAL_STOCK: Vehicle[] = '.length).trim().replace(/;$/, '');
const vehicles = JSON.parse(jsonStr);

let fallbackMatches = 0;
vehicles.forEach(v => {
  const plate = (v.patente || '').trim().replace(/\s+/g, '').toUpperCase();
  if (matched[plate]) return;

  const mBrand = (v.marca || '').toLowerCase().trim();
  const mModel = (v.modelo || '').toLowerCase().trim();
  const key = mBrand + '_' + mModel + '_' + v.anio;
  if (webStock[key]) {
    // Only accept if web vehicle doesn't have a conflicting different plate already assigned
    const webItem = webStock[key];
    console.log(`Potential fallback for ${v.patente} (${v.marca} ${v.modelo} ${v.anio}) -> Web ${webItem.plate} (${webItem.brand} ${webItem.model})`);
    fallbackMatches++;
  }
});
console.log('Total potential fallback matches:', fallbackMatches);
