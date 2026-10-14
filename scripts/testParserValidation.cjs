// Test suite verifying coordinate logic, plate validation, and sanitization
const assert = require('assert');

// BANNED_PLATE_WORDS
const BANNED_PLATE_WORDS = new Set([
  'PEUGEOT', 'CHEVROLET', 'CITROEN', 'CITROËN', 'CHERY', 'FIAT', 'FORD', 'HONDA',
  'HYUNDAI', 'JEEP', 'KIA', 'NISSAN', 'RENAULT', 'TOYOTA', 'VOLKSWAGEN', 'VW',
  'AUDI', 'BMW', 'MERCEDES', 'MITSUBISHI', 'RAM', 'DS', 'BAIC', 'HAVAL', 'GEELY',
  'BYD', 'DFSK', 'LIFAN', 'VOLVO', 'MINI', 'ALFA', 'ROMEO', 'SEAT', 'DODGE', 'CHRYSLER',
  'LEXUS', 'ISUZU', 'IVECO',
  'AUTONET', 'MIRAGE', 'IRUNA', 'IRUÑA', 'PENDIENTE', 'SOLALIQUE', 'AKIRA', 'OILBULL',
  'ESTANDAR', 'ESTÁNDAR', 'MODELO', 'VERSION', 'VERSIÓN', 'UNIDAD',
  'BLANCO', 'NEGRO', 'GRIS', 'ROJO', 'AZUL', 'PLATA', 'VERDE', 'BORDO', 'MARRON',
  'NAFTA', 'DIESEL', 'MANUAL', 'AUTOMATICA', 'AUTOMÁTICA',
  'DISPONIBLE', 'RESERVADO', 'VENDIDO', 'USADO', 'NUEVO', 'STOCK', 'ORDEN',
  'TIPO', 'PATENTE', 'DOMINIO', 'ANO', 'AÑO', 'PRECIO', 'VENTA', 'TOMA', 'FECHA'
]);

function normalizePlate(plate) {
  if (!plate) return '';
  return plate.toString().toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}

function isValidPlate(plate) {
  if (!plate) return false;
  const p = normalizePlate(plate);
  if (!p) return false;

  if (p.length < 6 || p.length > 8) return false;
  if (BANNED_PLATE_WORDS.has(p)) return false;

  const hasLetters = /[A-Z]/.test(p);
  const hasDigits = /[0-9]/.test(p);
  if (!hasLetters || !hasDigits) return false;

  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(p)) return true;
  if (/^[A-Z]{3}\d{3}$/.test(p)) return true;
  if (/^[A-Z]{2}\d{5}$/.test(p)) return true;
  if (/^\d{3}[A-Z]{3}$/.test(p) || /^[A-Z]{3}\d{2}$/.test(p)) return true;
  if (/^[A-Z]\d{6,7}$/.test(p)) return true;

  const letterCount = (p.match(/[A-Z]/g) || []).length;
  const digitCount = (p.match(/[0-9]/g) || []).length;
  if (letterCount >= 2 && digitCount >= 2) return true;

  return false;
}

function normalizeMileage(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') {
    if (isNaN(val)) return null;
    return Math.round(Math.abs(val));
  }
  const clean = String(val).replace(/km|kilometros|kms/gi, '').trim();
  if (!clean) return null;
  const digitsOnly = clean.replace(/[^0-9]/g, '');
  if (!digitsOnly) return null;
  const parsed = parseInt(digitsOnly, 10);
  return isNaN(parsed) ? null : Math.abs(parsed);
}

function isCorruptStoredVehicle(v) {
  const rawPlate = v.patente || '';
  const cleanPlate = normalizePlate(rawPlate);

  if (!cleanPlate || !isValidPlate(cleanPlate)) {
    return { isCorrupt: true, reason: `Patente inválida o inexistente ('${rawPlate}')` };
  }
  if (BANNED_PLATE_WORDS.has(cleanPlate)) {
    return { isCorrupt: true, reason: `Patente coincide con marca o palabra prohibida ('${cleanPlate}')` };
  }
  if ((v.marca || '').toLowerCase() === 'autonet') {
    return { isCorrupt: true, reason: `Marca 'Autonet' inválida` };
  }
  if ((v.modelo || '').toLowerCase() === 'modelo') {
    return { isCorrupt: true, reason: `Modelo placeholder 'Modelo'` };
  }
  if (v.kilometraje === 2 && (v.anio || 0) <= 2024) {
    return { isCorrupt: true, reason: `Kilometraje 2 km derivado erróneamente de columna Tipo` };
  }
  return { isCorrupt: false, reason: '' };
}

console.log('=== TEST 1: VALIDACIÓN DE PATENTES (SECCIÓN 21) ===');
const testCases = [
  { plate: 'PEUGEOT', expected: false },
  { plate: 'AD835UE', expected: true },
  { plate: 'PQJ334', expected: true },
  { plate: 'RA28489', expected: true },
  { plate: 'HF13759', expected: true },
  { plate: 'AF458AG', expected: true },
  { plate: 'AG560PC', expected: true },
  { plate: 'AUTONET', expected: false },
  { plate: '2008', expected: false },
  { plate: 'MIRAGE', expected: false },
  { plate: '2', expected: false },
  { plate: 'P - C', expected: false },
  { plate: 'AD 835 UE', expected: true },
  { plate: 'ad835ue', expected: true }
];

let passCount = 0;
for (const tc of testCases) {
  const actual = isValidPlate(tc.plate);
  const status = actual === tc.expected ? 'PASS' : 'FAIL';
  if (status === 'PASS') passCount++;
  console.log(`[${status}] PATENTE: "${tc.plate}" -> Resultado: ${actual ? 'VALID' : 'INVALID'} (Esperado: ${tc.expected ? 'VALID' : 'INVALID'})`);
  assert.strictEqual(actual, tc.expected, `Fallo en prueba para ${tc.plate}`);
}
console.log(`Pasan ${passCount} de ${testCases.length} pruebas de patentes.\n`);

console.log('=== TEST 2: FILTRO ESTRICTO DE KILOMETRAJE (PROBLEMA 1) ===');
const sampleKms = [
  { raw: '50.000', expectedPass: true },
  { raw: '35.000 km', expectedPass: true },
  { raw: '0', expectedPass: true },
  { raw: '50.000 km', expectedPass: true },
  { raw: '50.001', expectedPass: false },
  { raw: '60.000 km', expectedPass: false },
  { raw: '95.000 km', expectedPass: false },
  { raw: '107.000', expectedPass: false },
  { raw: '124.000 km', expectedPass: false },
  { raw: '129.000 km', expectedPass: false },
  { raw: '133.000', expectedPass: false }
];

const MAX_FILTER = 50000;
for (const item of sampleKms) {
  const norm = normalizeMileage(item.raw);
  const passesFilter = norm !== null && norm <= MAX_FILTER;
  assert.strictEqual(passesFilter, item.expectedPass, `Filtro de KM falló para ${item.raw}`);
  console.log(`[PASS] KM: "${item.raw}" -> ${norm} km -> Cumple <= ${MAX_FILTER}: ${passesFilter}`);
}
console.log('Filtro de kilometraje verificado exitosamente.\n');

console.log('=== TEST 3: DETECCIÓN DE REGISTROS CORRUPTOS EXISTENTES (SECCIÓN 19) ===');
const corruptedRecord = {
  patente: 'PEUGEOT',
  marca: 'Autonet',
  modelo: 'Modelo',
  version: 'Estándar',
  anio: 2008,
  kilometraje: 2,
  precio: 29900000
};
const checkCorrupt = isCorruptStoredVehicle(corruptedRecord);
assert.strictEqual(checkCorrupt.isCorrupt, true);
console.log(`[PASS] Registro corrupto 'PEUGEOT / Autonet Modelo' detectado: ${checkCorrupt.reason}`);

const legitimateRecord = {
  patente: 'AF458AG',
  marca: 'Peugeot',
  modelo: '2008',
  version: '1.6 Allure PK AT',
  anio: 2021,
  kilometraje: 35000,
  precio: 29900000
};
const checkLegit = isCorruptStoredVehicle(legitimateRecord);
assert.strictEqual(checkLegit.isCorrupt, false);
console.log(`[PASS] Registro legítimo 'Peugeot 2008 (AF458AG)' aceptado correctamente.\n`);

console.log('=== TEST 4: DESCOMPOSICIÓN DE DESCRIPCIÓN (SECCIONES 3, 4, 6, 7, 8, 9) ===');

const CONTROLLED_BRANDS = [
  { code: 'CHEVROLET', regex: /\b(CHEVROLET|CHEVY)\b/i, standard: 'CHEVROLET' },
  { code: 'CITROEN', regex: /\b(CITROEN|CITROËN)\b/i, standard: 'CITROEN' },
  { code: 'VW', regex: /\b(VOLKSWAGEN|VW)\b/i, standard: 'VW' },
  { code: 'TOYOTA', regex: /\bTOYOTA\b/i, standard: 'TOYOTA' },
  { code: 'FORD', regex: /\bFORD\b/i, standard: 'FORD' },
  { code: 'FIAT', regex: /\bFIAT\b/i, standard: 'FIAT' },
  { code: 'RENAULT', regex: /\bRENAULT\b/i, standard: 'RENAULT' },
  { code: 'PEUGEOT', regex: /\bPEUGEOT\b/i, standard: 'PEUGEOT' },
  { code: 'JEEP', regex: /\bJEEP\b/i, standard: 'JEEP' },
  { code: 'NISSAN', regex: /\bNISSAN\b/i, standard: 'NISSAN' },
  { code: 'HONDA', regex: /\bHONDA\b/i, standard: 'HONDA' },
  { code: 'HYUNDAI', regex: /\bHYUNDAI\b/i, standard: 'HYUNDAI' },
  { code: 'KIA', regex: /\bKIA\b/i, standard: 'KIA' },
];

const MODELS_BY_BRAND = {
  CHEVROLET: ['S 10', 'ONIX PLUS', 'CRUZE', 'ONIX', 'PRISMA', 'SPIN', 'TRACKER'],
  CITROEN: ['C3 AIRCROSS', 'C4 CACTUS', 'BERLINGO', 'C3', 'C4'],
  FIAT: ['STRADA ADVENTURE', 'CRONOS', 'PULSE', 'TORO', 'ARGO', 'MOBI', 'STRADA', 'PALIO'],
  FORD: ['ECOSPORT', 'RANGER', 'MAVERICK', 'TERRITORY', 'FOCUS', 'FIESTA', 'KA'],
  HYUNDAI: ['SANTA FE', 'TUCSON', 'CRETA', 'I10', 'HB20'],
  RENAULT: ['SANDERO STEPWAY', 'DUSTER OROCH', 'KANGOO STEPWAY', 'DUSTER', 'SANDERO', 'LOGAN', 'KWID', 'ALASKAN'],
  TOYOTA: ['COROLLA CROSS', 'HILUX SW4', 'COROLLA', 'ETIOS', 'HILUX', 'YARIS', 'SW4', 'RAV4'],
  VW: ['GOL TREND', 'T CROSS', 'T-CROSS', 'AMAROK', 'NIVUS', 'TAOS', 'POLO', 'VENTO', 'SURAN', 'FOX', 'SAVEIRO']
};

const KNOWN_MODELS = Array.from(new Set(Object.values(MODELS_BY_BRAND).flat())).sort((a, b) => b.length - a.length);

const BANNED_VERSION_PREFIX_REGEX = /^(?:P\s*-\s*(?:C|T|TS|PA|AK|A)|P\s*-\s*|0\s*KM|0KM|FLOTA|TS|PA|AK|T|C|A)\b\s*/i;

function cleanVersion(rawVersion) {
  if (!rawVersion) return '';
  let v = rawVersion.trim().replace(/^[-_\s/|:]+/, '').trim();
  let prev = '';
  while (v !== prev && BANNED_VERSION_PREFIX_REGEX.test(v)) {
    prev = v;
    v = v.replace(BANNED_VERSION_PREFIX_REGEX, '').trim().replace(/^[-_\s/|:]+/, '').trim();
  }
  return v;
}

function parseVehicleDescription(rawDescription) {
  const rawClean = (rawDescription || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  let cleanInput = rawClean.replace(/^(?:P\s*-\s*(?:C|T|TS|PA|AK|A)|P\s*-\s*|0\s*KM|0KM|FLOTA|TS|PA|AK|T|C|A)\b\s*/i, '').trim();

  let earliestBrand = null;
  for (const b of CONTROLLED_BRANDS) {
    const m = cleanInput.match(b.regex);
    if (m && m.index !== undefined) {
      if (!earliestBrand || m.index < earliestBrand.index) {
        earliestBrand = {
          code: b.code,
          standard: b.standard,
          index: m.index,
          length: m[0].length,
        };
      }
    }
  }

  if (!earliestBrand) {
    for (const b of CONTROLLED_BRANDS) {
      const m = rawClean.match(b.regex);
      if (m && m.index !== undefined) {
        if (!earliestBrand || m.index < earliestBrand.index) {
          earliestBrand = {
            code: b.code,
            standard: b.standard,
            index: m.index,
            length: m[0].length,
          };
        }
      }
    }
    if (earliestBrand) {
      cleanInput = rawClean.slice(earliestBrand.index);
      earliestBrand.index = 0;
    }
  }

  if (!earliestBrand) {
    return {
      marca: 'DESCONOCIDA',
      modelo: 'DESCONOCIDO',
      version: cleanVersion(cleanInput),
      rawDescription,
    };
  }

  const marca = earliestBrand.standard;

  const afterBrand = cleanInput
    .slice(earliestBrand.index + earliestBrand.length)
    .trim()
    .replace(/^[-_\s/|:]+/, '')
    .trim();

  const brandKey = earliestBrand.code in MODELS_BY_BRAND ? earliestBrand.code : marca;
  const brandModels = (MODELS_BY_BRAND[brandKey] || []).slice().sort((a, b) => b.length - a.length);

  let modelo = '';
  let restAfterModel = '';

  for (const candidate of brandModels) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-\\s]+/g, '[-\\s]+');
    const regexStart = new RegExp('^' + escaped + '(\\b|(?=[^A-Z0-9]))', 'i');
    const matchStart = afterBrand.match(regexStart);
    if (matchStart) {
      modelo = candidate.toUpperCase();
      restAfterModel = afterBrand.slice(matchStart[0].length).trim();
      break;
    }
  }

  if (!modelo) {
    for (const candidate of brandModels) {
      const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-\\s]+/g, '[-\\s]+');
      const regexAny = new RegExp('\\b' + escaped + '(\\b|(?=[^A-Z0-9]))', 'i');
      const matchAny = afterBrand.match(regexAny);
      if (matchAny && matchAny.index !== undefined) {
        modelo = candidate.toUpperCase();
        restAfterModel = (afterBrand.slice(0, matchAny.index) + ' ' + afterBrand.slice(matchAny.index + matchAny[0].length)).trim();
        break;
      }
    }
  }

  if (!modelo) {
    for (const candidate of KNOWN_MODELS) {
      const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-\\s]+/g, '[-\\s]+');
      const regexStart = new RegExp('^' + escaped + '(\\b|(?=[^A-Z0-9]))', 'i');
      const matchStart = afterBrand.match(regexStart);
      if (matchStart) {
        modelo = candidate.toUpperCase();
        restAfterModel = afterBrand.slice(matchStart[0].length).trim();
        break;
      }
    }
  }

  if (!modelo) {
    const parts = afterBrand.split(/\s+/);
    modelo = (parts[0] || 'UNIDAD').toUpperCase();
    restAfterModel = parts.slice(1).join(' ').trim();
  }

  if (modelo === 'T-CROSS') modelo = 'T CROSS';
  if (modelo === 'S-10' || modelo === 'S10') modelo = 'S 10';

  let version = cleanVersion(restAfterModel);
  if (!version) {
    version = 'ESTANDAR';
  }

  return { marca, modelo, version, rawDescription };
}

const descriptionTests = [
  {
    raw: 'CHEVROLET CRUZE 1.4 4 P LT MT',
    expected: { marca: 'CHEVROLET', modelo: 'CRUZE', version: '1.4 4 P LT MT' }
  },
  {
    raw: 'CHEVROLET ONIX 1.0 4 P LTZ PLUS AT',
    expected: { marca: 'CHEVROLET', modelo: 'ONIX', version: '1.0 4 P LTZ PLUS AT' }
  },
  {
    raw: 'FORD ECOSPORT FREESTYLE 1.5 MT',
    expected: { marca: 'FORD', modelo: 'ECOSPORT', version: 'FREESTYLE 1.5 MT' }
  },
  {
    raw: 'RENAULT SANDERO STEPWAY PRIVILEGE 1.6',
    expected: { marca: 'RENAULT', modelo: 'SANDERO STEPWAY', version: 'PRIVILEGE 1.6' }
  },
  {
    raw: 'TOYOTA COROLLA CROSS 2.0 XEI CVT',
    expected: { marca: 'TOYOTA', modelo: 'COROLLA CROSS', version: '2.0 XEI CVT' }
  },
  {
    raw: 'VW AMAROK DC HIGHLINE 4X4 AT 258 CV',
    expected: { marca: 'VW', modelo: 'AMAROK', version: 'DC HIGHLINE 4X4 AT 258 CV' }
  },
  // Casos con prefijos internos de la columna anterior desplazados
  {
    raw: 'T CHEVROLET CRUZE 1.4 4 P LT MT',
    expected: { marca: 'CHEVROLET', modelo: 'CRUZE', version: '1.4 4 P LT MT' }
  },
  {
    raw: 'P - C CITROEN C3 1.6 FEEL',
    expected: { marca: 'CITROEN', modelo: 'C3', version: '1.6 FEEL' }
  },
  {
    raw: 'TS HYUNDAI TUCSON 2.0 CRDI 4WD AT',
    expected: { marca: 'HYUNDAI', modelo: 'TUCSON', version: '2.0 CRDI 4WD AT' }
  },
  {
    raw: 'PA VW POLO HIGHLINE',
    expected: { marca: 'VW', modelo: 'POLO', version: 'HIGHLINE' }
  }
];

for (const dt of descriptionTests) {
  const parsed = parseVehicleDescription(dt.raw);
  assert.strictEqual(parsed.marca, dt.expected.marca, `Marca incorrecta para ${dt.raw}`);
  assert.strictEqual(parsed.modelo, dt.expected.modelo, `Modelo incorrecto para ${dt.raw}`);
  assert.strictEqual(parsed.version, dt.expected.version, `Versión incorrecta para ${dt.raw}`);
  console.log(`[PASS] parseVehicleDescription: "${dt.raw}" -> MARCA=${parsed.marca}, MODELO=${parsed.modelo}, VERSION=${parsed.version}`);
}

// Probar cleanVersion directamente sobre versiones contaminadas de la base de datos
const cleanVersionTests = [
  { raw: 'T 1.4 4 P LT MT', expected: '1.4 4 P LT MT' },
  { raw: 'C 1.0 4 P LTZ PLUS AT', expected: '1.0 4 P LTZ PLUS AT' },
  { raw: 'P - C 1.0 4 P LTZ PLUS AT', expected: '1.0 4 P LTZ PLUS AT' },
  { raw: '0 KM HIGHLINE', expected: 'HIGHLINE' },
  { raw: 'FLOTA PRIVILEGE 1.6', expected: 'PRIVILEGE 1.6' }
];

for (const cv of cleanVersionTests) {
  const cleaned = cleanVersion(cv.raw);
  assert.strictEqual(cleaned, cv.expected, `cleanVersion falló para ${cv.raw}`);
  console.log(`[PASS] cleanVersion: "${cv.raw}" -> "${cleaned}"`);
}

console.log('\n=== TEST 5: PARSERS NUMÉRICOS ARGENTINOS (SECCIÓN 8 Y 9) ===');
function parseArgentineInteger(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return isNaN(val) ? null : Math.round(Math.abs(val));
  let clean = String(val).trim();
  if (!clean) return null;
  clean = clean.replace(/^[^\d\-+]+|[^\d]+$/g, '').trim();
  if (clean.includes(',')) {
    const commaParts = clean.split(',');
    clean = commaParts[0];
  }
  const cleanDot = clean.replace(/\./g, '');
  const digitsOnly = cleanDot.replace(/[^\d]/g, '');
  if (!digitsOnly) return null;
  const parsed = parseInt(digitsOnly, 10);
  return isNaN(parsed) ? null : parsed;
}

function parsePrice(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return isNaN(val) ? null : Math.round(Math.abs(val));
  const clean = String(val).replace(/[\$u\$sARSUSD]/gi, '').trim();
  return parseArgentineInteger(clean);
}

const numTests = [
  { input: '136.000', expected: 136000 },
  { input: '50.000', expected: 50000 },
  { input: '$29.900.000', expected: 29900000 },
  { input: '29.900.000,00', expected: 29900000 },
  { input: '0', expected: 0 },
  { input: '107.000 km', expected: 107000 }
];

for (const nt of numTests) {
  const res = parseArgentineInteger(nt.input);
  assert.strictEqual(res, nt.expected, `parseArgentineInteger falló para ${nt.input}`);
  console.log(`[PASS] parseArgentineInteger: "${nt.input}" -> ${res}`);
}

const priceTests = [
  { input: '$ 29.900.000', expected: 29900000 },
  { input: '$18.500.000,00', expected: 18500000 },
  { input: '25.000.000', expected: 25000000 }
];

for (const pt of priceTests) {
  const res = price(pt.input);
  assert.strictEqual(res, pt.expected, `parsePrice falló para ${pt.input}`);
  console.log(`[PASS] parsePrice: "${pt.input}" -> ${res}`);
}

function price(val) { return parsePrice(val); }

console.log('\nTODAS LAS PRUEBAS DE PARSING Y NORMALIZACIÓN COMPLETADAS CON ÉXITO.');
