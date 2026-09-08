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

console.log('TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO.');
