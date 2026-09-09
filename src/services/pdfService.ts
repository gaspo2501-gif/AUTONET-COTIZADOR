import * as pdfjsLib from 'pdfjs-dist';
import { 
  DiffResult, 
  FieldChange, 
  Vehicle, 
  VehicleDiffItem,
  VehicleFuel,
  VehicleTransmission,
  VehicleTraction,
  VehicleStatus,
  ParsingDiagnostics,
  DiscardedRecordDetail,
  DiscardedSummary,
  SafetyValidation,
  PdfStageInfo
} from '../types/stock';
import { autonetService } from './autonetService';
import { normalizeMileage, parseArgentineInteger, parseMileage, parsePrice } from '../utils/formatters';
import { getSituacionOperativaInfo } from '../utils/autonetHelpers';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure pdfjs worker if in browser
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  } catch (e) {
    console.warn('pdfjs worker initialization error:', e);
  }
}

export { normalizeMileage, parseArgentineInteger, parseMileage, parsePrice };

export interface ExtractedVehicleDraft {
  patente?: string;
  marca?: string;
  modelo?: string;
  version?: string;
  anio?: number;
  kilometraje?: number;
  precio?: number;
  color?: string;
  combustible?: string;
  caja?: string;
  traccion?: string;
  rawLine?: string;
}

export interface ParsePdfResult {
  fileName: string;
  fileSize: number;
  pageCount: number;
  rawText: string;
  extractedVehicles: Partial<Vehicle>[];
  parseWarnings: string[];
  diagnostics: ParsingDiagnostics;
}

/**
 * Palabras reservadas, marcas, concesionarias y términos que NUNCA pueden ser una patente automotriz.
 */
export const BANNED_PLATE_WORDS = new Set([
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

/**
 * Normaliza una patente argentina eliminando espacios, guiones y caracteres no alfanuméricos,
 * convirtiendo a mayúsculas y aplicando trim.
 */
export function normalizePlate(plate?: string): string {
  if (!plate) return '';
  return plate.toString().toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}

/**
 * Alias de compatibilidad hacia atrás
 */
export const normalizePatente = normalizePlate;

/**
 * Validación ESTRICTA de patente automotriz en Argentina.
 * Reglas fundamentales:
 * 1. Longitud entre 6 y 8 caracteres.
 * 2. NO pertenecer a la lista de marcas o palabras prohibidas (ej: PEUGEOT, AUTONET, MIRAGE).
 * 3. Contener OBLIGATORIAMENTE tanto letras como números.
 * 4. Ajustarse a formatos oficiales argentinos:
 *    - Mercosur autos: AA123BB (7 caracteres)
 *    - Tradicional: AAA123 (6 caracteres)
 *    - Motos / flotas / especiales / internos: AA12345 (7 caracteres), 123ABC (6 caracteres)
 *    - Provincial histórica: A123456 (7 caracteres)
 */
export function isValidPlate(plate?: string): boolean {
  if (!plate) return false;
  const p = normalizePlate(plate);
  if (!p) return false;

  // 1. Longitud válida
  if (p.length < 6 || p.length > 8) {
    return false;
  }

  // 2. Rechazar marcas, términos comerciales o palabras reservadas
  if (BANNED_PLATE_WORDS.has(p)) {
    return false;
  }

  // 3. Debe tener al menos una letra y al menos un dígito
  const hasLetters = /[A-Z]/.test(p);
  const hasDigits = /[0-9]/.test(p);
  if (!hasLetters || !hasDigits) {
    return false;
  }

  // 4. Formatos oficiales argentinos
  // Mercosur autos: 2 letras + 3 dígitos + 2 letras (ej: AD835UE, AG560PC, AF458AG)
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(p)) return true;

  // Tradicional argentina: 3 letras + 3 dígitos (ej: PQJ334, NPN010, OUB919)
  if (/^[A-Z]{3}\d{3}$/.test(p)) return true;

  // Flotas / Motos Mercosur / Internos: 2 letras + 5 dígitos (ej: RA28489, HF13759)
  if (/^[A-Z]{2}\d{5}$/.test(p)) return true;

  // Motos tradicional: 3 dígitos + 3 letras (ej: 123ABC) o 3 letras + 2 dígitos
  if (/^\d{3}[A-Z]{3}$/.test(p) || /^[A-Z]{3}\d{2}$/.test(p)) return true;

  // Formato provincial histórico: 1 letra + 6 o 7 dígitos (ej: B123456)
  if (/^[A-Z]\d{6,7}$/.test(p)) return true;

  // Alfanumérico genérico argentino: al menos 2 letras y al menos 2 dígitos
  const letterCount = (p.match(/[A-Z]/g) || []).length;
  const digitCount = (p.match(/[0-9]/g) || []).length;
  if (letterCount >= 2 && digitCount >= 2) {
    return true;
  }

  return false;
}

/**
 * Batería de pruebas de validación de patente requerida por las directivas de seguridad.
 */
export function testPlateValidationCases(): {
  cases: { plate: string; expected: boolean; actual: boolean; passed: boolean }[];
  allPassed: boolean;
} {
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
  ];

  const results = testCases.map((tc) => {
    const actual = isValidPlate(tc.plate);
    return {
      plate: tc.plate,
      expected: tc.expected,
      actual,
      passed: actual === tc.expected,
    };
  });

  return {
    cases: results,
    allPassed: results.every((r) => r.passed),
  };
}

/**
 * Determina si un vehículo almacenado previamente contiene datos corruptos
 * (ej: patente "PEUGEOT", marca "Autonet", modelo "Modelo", kilometraje 2 por colisión con columna Tipo).
 */
export function isCorruptStoredVehicle(v: Partial<Vehicle>): { isCorrupt: boolean; reason: string } {
  const rawPlate = v.patente || '';
  const cleanPlate = normalizePlate(rawPlate);

  if (!cleanPlate || !isValidPlate(cleanPlate)) {
    return { isCorrupt: true, reason: `Patente inválida o inexistente ('${rawPlate}')` };
  }

  if (BANNED_PLATE_WORDS.has(cleanPlate)) {
    return { isCorrupt: true, reason: `Patente coincide con marca o palabra prohibida ('${cleanPlate}')` };
  }

  if ((v.marca || '').toLowerCase() === 'autonet') {
    return { isCorrupt: true, reason: `Marca 'Autonet' inválida (no es fabricante automotriz)` };
  }

  if ((v.modelo || '').toLowerCase() === 'modelo') {
    return { isCorrupt: true, reason: `Modelo placeholder 'Modelo'` };
  }

  if (v.kilometraje === 2 && (v.anio || 0) <= 2024) {
    return { isCorrupt: true, reason: `Kilometraje 2 km derivado erróneamente de columna Tipo` };
  }

  return { isCorrupt: false, reason: '' };
}

/**
 * Clave única para vehículos: PATENTE normalizada obligatoria.
 * Si no hay patente válida, devuelve string vacío (no permite fallback ciego).
 */
export function generateVehicleKey(v: Partial<Vehicle>): string {
  const plate = normalizePlate(v.patente);
  if (plate && isValidPlate(plate)) {
    return plate;
  }
  return '';
}

export interface BrandDefinition {
  regex: RegExp;
  standard: string;
}

/**
 * Lista controlada de marcas automotrices según requerimiento oficial (Sección 4).
 * La marca se normaliza en mayúsculas estándar.
 */
export const CONTROLLED_BRANDS: { code: string; regex: RegExp; standard: string }[] = [
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
  { code: 'CHERY', regex: /\bCHERY\b/i, standard: 'CHERY' },
  { code: 'AUDI', regex: /\bAUDI\b/i, standard: 'AUDI' },
  { code: 'BMW', regex: /\bBMW\b/i, standard: 'BMW' },
  { code: 'MERCEDES-BENZ', regex: /\b(MERCEDES[-\s]?BENZ|MERCEDES)\b/i, standard: 'MERCEDES-BENZ' },
  { code: 'RAM', regex: /\bRAM\b/i, standard: 'RAM' },
  { code: 'MITSUBISHI', regex: /\bMITSUBISHI\b/i, standard: 'MITSUBISHI' },
  { code: 'DS', regex: /\bDS\b/i, standard: 'DS' },
  { code: 'BAIC', regex: /\bBAIC\b/i, standard: 'BAIC' },
  { code: 'HAVAL', regex: /\bHAVAL\b/i, standard: 'HAVAL' },
  { code: 'GREAT WALL', regex: /\bGREAT\s+WALL\b/i, standard: 'GREAT WALL' },
  { code: 'JAC', regex: /\bJAC\b/i, standard: 'JAC' },
  { code: 'GEELY', regex: /\bGEELY\b/i, standard: 'GEELY' },
  { code: 'BYD', regex: /\bBYD\b/i, standard: 'BYD' },
  { code: 'DFSK', regex: /\bDFSK\b/i, standard: 'DFSK' },
  { code: 'LIFAN', regex: /\bLIFAN\b/i, standard: 'LIFAN' },
  { code: 'VOLVO', regex: /\bVOLVO\b/i, standard: 'VOLVO' },
  { code: 'MINI', regex: /\bMINI\b/i, standard: 'MINI' },
  { code: 'ALFA ROMEO', regex: /\b(ALFA\s+ROMEO|ALFA)\b/i, standard: 'ALFA ROMEO' },
  { code: 'SEAT', regex: /\bSEAT\b/i, standard: 'SEAT' },
  { code: 'DODGE', regex: /\bDODGE\b/i, standard: 'DODGE' },
  { code: 'CHRYSLER', regex: /\bCHRYSLER\b/i, standard: 'CHRYSLER' },
  { code: 'LEXUS', regex: /\bLEXUS\b/i, standard: 'LEXUS' },
  { code: 'ISUZU', regex: /\bISUZU\b/i, standard: 'ISUZU' },
  { code: 'IVECO', regex: /\bIVECO\b/i, standard: 'IVECO' },
];

export const KNOWN_BRANDS: BrandDefinition[] = CONTROLLED_BRANDS.map(b => ({
  regex: b.regex,
  standard: b.standard
}));

/**
 * Catálogo de modelos conocidos agrupados por marca automotriz (Sección 6).
 * Incluye modelos compuestos (ej: COROLLA CROSS, SANDERO STEPWAY, DUSTER OROCH, C3 AIRCROSS, C4 CACTUS, T CROSS, S 10).
 */
export const MODELS_BY_BRAND: Record<string, string[]> = {
  CHEVROLET: [
    'S 10', 'S-10', 'S10', 'ONIX PLUS', 'CORVETTE', 'CAMARO', 'TRAILBLAZER',
    'EQUINOX', 'TRACKER', 'SPIN', 'PRISMA', 'ONIX', 'CRUZE', 'COBALT',
    'AVALANCHE', 'SONIC', 'AGILE', 'CAPTIVA', 'MERIVA', 'ZAFIRA', 'CORSA', 'ASTRA', 'VECTRA'
  ],
  CITROEN: [
    'C3 AIRCROSS', 'C4 CACTUS', 'C4 LOUNGE', 'C4 PICASSO', 'C3 PICASSO',
    'GRAND C4 PICASSO', 'BERLINGO MULTISPACE', 'BERLINGO', 'BASALT', 'C3', 'C4', 'C5 AIRCROSS', 'C5'
  ],
  FIAT: [
    'STRADA ADVENTURE', 'PALIO WEEKEND', 'GRAND SIENA', 'PULSE ABARTH', 'FASTBACK ABARTH',
    'FASTBACK', 'CRONOS', 'PULSE', 'TORO', 'ARGO', 'MOBI', 'STRADA', 'FIORINO', 'SIENA',
    'PALIO', 'UNO WAY', 'UNO', 'PUNTO', 'LINEA', 'IDEA', 'DOBLO', '500', 'QUBO'
  ],
  FORD: [
    'ECOSPORT', 'RANGER RAPTOR', 'RANGER', 'F-150', 'F150', 'MAVERICK', 'TERRITORY',
    'KUGA HYBRID', 'KUGA', 'MONDEO', 'FOCUS', 'FIESTA KINETIC', 'FIESTA', 'KA FREESTYLE', 'KA+', 'KA', 'MUSTANG', 'TRANSIT'
  ],
  HONDA: [
    'HRV', 'HR-V', 'WRV', 'WR-V', 'CRV', 'CR-V', 'CIVIC', 'FIT', 'CITY', 'ACCORD'
  ],
  HYUNDAI: [
    'GRAND I10', 'SANTA FE', 'TUCSON', 'CRETA', 'I10', 'I30', 'HB20', 'H1', 'IONIQ'
  ],
  JEEP: [
    'GRAND CHEROKEE', 'CHEROKEE', 'COMMANDER', 'COMPASS', 'RENEGADE', 'WRANGLER', 'GLADIATOR', 'PATRIOT'
  ],
  KIA: [
    'GRAND CARNIVAL', 'SPORTAGE', 'SELTOS', 'SORENTO', 'SOUL', 'CARNIVAL', 'CERATO', 'RIO', 'PICANTO'
  ],
  NISSAN: [
    'FRONTIER', 'X-TRAIL', 'XTRAIL', 'KICKS', 'NOTE', 'SENTRA', 'VERSA', 'MARCH', 'TIIDA', 'MURANO', 'LEAF'
  ],
  PEUGEOT: [
    'PARTNER PATAGONICA', '2008', '3008', '5008', '208 GT', '208', '308', '408', 'PARTNER', 'BOXER', 'EXPERT', '207', '206'
  ],
  RENAULT: [
    'SANDERO STEPWAY', 'DUSTER OROCH', 'KANGOO STEPWAY', 'MASTER', 'ALASKAN', 'KARDIAN',
    'ARKANA', 'CAPTUR', 'DUSTER', 'OROCH', 'FLUENCE', 'KANGOO', 'KWID', 'LOGAN',
    'SANDERO', 'MEGANE', 'CLIO MIO', 'CLIO', 'SYMBOL', 'KOLEOS', 'TWINGO'
  ],
  TOYOTA: [
    'COROLLA CROSS', 'HILUX SW4', 'RAV4', 'COROLLA', 'ETIOS', 'HILUX', 'YARIS', 'SW4',
    'PRIUS', 'LAND CRUISER', 'INNOVA', 'CAMRY'
  ],
  VW: [
    'GOL TREND', 'T-CROSS', 'T CROSS', 'FOX CROSSFOX', 'CROSS FOX', 'CROSSFOX',
    'SURAN CROSS', 'SAVEIRO CROSS', 'AMAROK', 'NIVUS', 'TAOS', 'TERA', 'VIRTUS',
    'POLO TRACK', 'POLO', 'GOLF GTI', 'GOLF', 'VENTO GLI', 'VENTO', 'TIGUAN ALLSPACE', 'TIGUAN',
    'PASSAT', 'UP!', 'UP', 'VOYAGE', 'SURAN', 'FOX', 'SAVEIRO', 'SCIROCCO', 'BEETLE', 'BORA'
  ],
  VOLKSWAGEN: [
    'GOL TREND', 'T-CROSS', 'T CROSS', 'FOX CROSSFOX', 'CROSS FOX', 'CROSSFOX',
    'SURAN CROSS', 'SAVEIRO CROSS', 'AMAROK', 'NIVUS', 'TAOS', 'TERA', 'VIRTUS',
    'POLO TRACK', 'POLO', 'GOLF GTI', 'GOLF', 'VENTO GLI', 'VENTO', 'TIGUAN ALLSPACE', 'TIGUAN',
    'PASSAT', 'UP!', 'UP', 'VOYAGE', 'SURAN', 'FOX', 'SAVEIRO', 'SCIROCCO', 'BEETLE', 'BORA'
  ],
  CHERY: [
    'TIGGO 4 PRO', 'TIGGO 2 PRO', 'TIGGO 8 PRO', 'TIGGO 2', 'TIGGO 3', 'TIGGO 4', 'TIGGO 5', 'TIGGO', 'QQ', 'ARRIZO 5', 'FULWIN', 'SKIN'
  ],
  AUDI: [
    'A1', 'A3', 'A4', 'A5', 'A6', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'TT', 'E-TRON'
  ],
  BMW: [
    'SERIE 1', 'SERIE 2', 'SERIE 3', 'SERIE 4', 'SERIE 5', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'M2', 'M3', 'M4'
  ],
  MERCEDES: [
    'CLASE A', 'CLASE B', 'CLASE C', 'CLASE E', 'GLA', 'GLB', 'GLC', 'GLE', 'SPRINTER', 'VITO'
  ],
  'MERCEDES-BENZ': [
    'CLASE A', 'CLASE B', 'CLASE C', 'CLASE E', 'GLA', 'GLB', 'GLC', 'GLE', 'SPRINTER', 'VITO'
  ],
  RAM: [
    'RAMPAGE', '1500', '2500'
  ],
  DS: [
    'DS 3 CROSSBACK', 'DS 7 CROSSBACK', 'DS 3', 'DS 4', 'DS 7'
  ],
  BAIC: [
    'X25', 'X35', 'X55'
  ],
  HAVAL: [
    'H1', 'H2', 'H6', 'JOLION'
  ],
  GEELY: [
    'EMGRAND', 'COOLRAY', 'AZKARRA'
  ],
  DFSK: [
    'GLORY 560', 'GLORY 580', 'C31', 'C32', 'C35'
  ],
  LIFAN: [
    'X50', 'X60', 'MYWAY', 'FOISON'
  ]
};

export const KNOWN_MODELS = Array.from(
  new Set(Object.values(MODELS_BY_BRAND).flat())
).sort((a, b) => b.length - a.length);

/**
 * Prefijos de la primera columna interna de Autonet que NUNCA deben formar parte
 * de marca, modelo ni version (Sección 1, 8, 9).
 */
export const BANNED_VERSION_PREFIX_REGEX = /^(?:P\s*-\s*(?:C|T|TS|PA|AK|A)|P\s*-\s*|0\s*KM|0KM|FLOTA|TS|PA|AK|T|C|A)\b\s*/i;

/**
 * Limpia cualquier prefijo residual de la primera columna que haya podido quedar en version.
 */
export function cleanVersion(rawVersion: string): string {
  if (!rawVersion) return '';
  let v = rawVersion.trim().replace(/^[-_\s/|:]+/, '').trim();
  let prev = '';
  while (v !== prev && BANNED_VERSION_PREFIX_REGEX.test(v)) {
    prev = v;
    v = v.replace(BANNED_VERSION_PREFIX_REGEX, '').trim().replace(/^[-_\s/|:]+/, '').trim();
  }
  return v;
}

/**
 * Limpia el texto de la columna UNIDAD - MODELO - VERSION retirando espacios múltiples,
 * saltos de línea y cualquier token de clasificación interna desplazado (Sección 6, 8).
 */
export function cleanVehicleColumnText(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  // Si comienza con un prefijo interno seguido de una marca automotriz, descartar el prefijo
  cleaned = cleaned.replace(/^(?:P\s*-\s*(?:C|T|TS|PA|AK|A)|P\s*-\s*|0\s*KM|0KM|FLOTA|TS|PA|AK|T|C|A)\b\s*(?=(?:CHEVROLET|CITROEN|CITROËN|VW|VOLKSWAGEN|TOYOTA|FORD|FIAT|RENAULT|PEUGEOT|JEEP|NISSAN|HONDA|HYUNDAI|KIA|CHERY|AUDI|BMW|MERCEDES|RAM|MITSUBISHI|DS|BAIC|HAVAL|GEELY|BYD|DFSK|LIFAN|VOLVO|MINI|ALFA|SEAT|DODGE|CHRYSLER|LEXUS|ISUZU|IVECO)\b)/i, '').trim();
  return cleaned;
}

export interface ParsedVehicleDescription {
  marca: string;
  modelo: string;
  version: string;
  rawDescription?: string;
  requiereRevisionModelo?: boolean;
}

/**
 * Función central requerida (Sección 6) para descomponer la descripción del vehículo
 * en marca, modelo y versión con coincidencia de modelo más largo primero.
 */
export function parseVehicleDescription(rawDescription: string): ParsedVehicleDescription {
  // 1. Limpiar caracteres y espacios duplicados
  const rawClean = (rawDescription || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 2. Descartar prefijos de clasificación interna si quedaron al inicio
  let cleanInput = rawClean.replace(/^(?:P\s*-\s*(?:C|T|TS|PA|AK|A)|P\s*-\s*|0\s*KM|0KM|FLOTA|TS|PA|AK|T|C|A)\b\s*/i, '').trim();

  // 3. Detectar la marca automotriz a partir de la lista controlada
  let earliestBrand: { code: string; standard: string; index: number; length: number } | null = null;
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
    // Intento con rawClean completo
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

  // 4. Todo lo que estuviera antes de la marca es columna interna previa y se descarta
  const afterBrand = cleanInput
    .slice(earliestBrand.index + earliestBrand.length)
    .trim()
    .replace(/^[-_\s/|:]+/, '')
    .trim();

  // 5. Detectar el modelo utilizando catálogo de modelos de la marca ordenado de mayor a menor longitud
  const brandKey = earliestBrand.code in MODELS_BY_BRAND ? earliestBrand.code : marca;
  const brandModels = (MODELS_BY_BRAND[brandKey] || []).slice().sort((a, b) => b.length - a.length);

  let modelo = '';
  let restAfterModel = '';

  // Coincidencia estricta al inicio de afterBrand
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

  // Si no coincidió al inicio, buscar en cualquier posición de afterBrand
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

  // Fallback a catálogo global si no se halló en la marca
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

  let requiereRevisionModelo = false;
  // Si aún no hay modelo, tomar el primer token de afterBrand (modelo no catalogado pero válido)
  if (!modelo) {
    const parts = afterBrand.split(/\s+/);
    modelo = (parts[0] || 'UNIDAD').toUpperCase();
    restAfterModel = parts.slice(1).join(' ').trim();
    requiereRevisionModelo = true;
  }

  // Normalizar variaciones de modelo compuesto
  if (modelo === 'T-CROSS') modelo = 'T CROSS';
  if (modelo === 'S-10' || modelo === 'S10') modelo = 'S 10';

  // 6. VERSION: Todo lo que reste en la cadena debe ser version (Sección 7)
  let version = cleanVersion(restAfterModel);
  if (!version) {
    version = 'ESTANDAR';
  }

  // Diagnóstico obligatorio (Sección 12)
  console.log(`[PARSE-VEHICLE-DESC]\n  rawDescription: ${rawDescription}\n  marca: ${marca}\n  modelo: ${modelo}\n  version: ${version}`);

  return {
    marca,
    modelo,
    version,
    rawDescription,
    requiereRevisionModelo,
  };
}

/**
 * Estructuras para la extracción por coordenadas (PDF.js transform x/y)
 */
export interface PdfToken {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface VisualRow {
  y: number;
  page: number;
  tokens: PdfToken[];
  rawLine: string;
}

export type TableColumnKey =
  | 'orden'
  | 'prefijo'
  | 'vehiculo'
  | 'ub'
  | 'tipo'
  | 'patente'
  | 'anio'
  | 'color'
  | 'km'
  | 'empresa'
  | 'precio'
  | 'fechaToma';

export interface ColumnRange {
  min: number;
  max: number;
}

export class PdfService {
  /**
   * Extrae todos los tokens con coordenadas de una página PDF.
   */
  private extractTokensFromPage(textContent: any, pageNumber: number): PdfToken[] {
    if (!textContent || !Array.isArray(textContent.items)) {
      return [];
    }

    const tokens: PdfToken[] = [];
    for (const item of textContent.items) {
      if (!item || typeof item.str !== 'string') continue;
      const text = item.str.trim();
      if (!text) continue;

      const transform = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
      const x = typeof transform[4] === 'number' ? transform[4] : 0;
      const y = typeof transform[5] === 'number' ? transform[5] : 0;
      const width = typeof item.width === 'number' && item.width > 0 ? item.width : text.length * 6;
      const height = typeof item.height === 'number' && item.height > 0 ? item.height : 10;

      tokens.push({
        text,
        x,
        y,
        width,
        height,
        page: pageNumber,
      });
    }

    return tokens;
  }

  /**
   * Agrupa tokens en filas visuales según la coordenada Y (tolerancia vertical de 4.0 pt).
   * Dentro de cada fila, ordena los tokens de izquierda a derecha (coordenada X ascendente).
   */
  private groupTokensIntoVisualRows(tokens: PdfToken[]): VisualRow[] {
    if (tokens.length === 0) return [];

    // En PDF.js: mayor Y = parte superior de la página
    const sorted = [...tokens].sort((a, b) => b.y - a.y);

    const rows: VisualRow[] = [];
    let currentRow: VisualRow | null = null;
    const Y_TOLERANCE = 4.0;

    for (const token of sorted) {
      if (!currentRow) {
        currentRow = {
          y: token.y,
          page: token.page,
          tokens: [token],
          rawLine: '',
        };
      } else if (Math.abs(token.y - currentRow.y) <= Y_TOLERANCE) {
        currentRow.tokens.push(token);
      } else {
        currentRow.tokens.sort((a, b) => a.x - b.x);
        currentRow.rawLine = currentRow.tokens.map((t) => t.text).join(' ').trim();
        rows.push(currentRow);

        currentRow = {
          y: token.y,
          page: token.page,
          tokens: [token],
          rawLine: '',
        };
      }
    }

    if (currentRow) {
      currentRow.tokens.sort((a, b) => a.x - b.x);
      currentRow.rawLine = currentRow.tokens.map((t) => t.text).join(' ').trim();
      rows.push(currentRow);
    }

    return rows;
  }

  /**
   * Genera un detalle completo de diagnóstico para una fila descartada.
   */
  private createDiscardedRecord(params: {
    page?: number;
    rowNumber?: number;
    raw: string;
    tokens?: PdfToken[];
    cols?: Record<TableColumnKey, string>;
    plate?: string;
    reason: string;
    category: DiscardedRecordDetail['category'];
  }): DiscardedRecordDetail {
    const tokensWithX = params.tokens && params.tokens.length > 0
      ? params.tokens.map((t) => `${t.text} (x:${Math.round(t.x)})`).join(' | ')
      : undefined;

    return {
      page: params.page,
      rowNumber: params.rowNumber,
      raw: params.raw,
      tokensWithX,
      descripcionDetectada: params.cols?.vehiculo,
      ubDetectado: params.cols?.ub,
      tipoDetectado: params.cols?.tipo,
      patenteDetectada: params.plate || params.cols?.patente,
      anioDetectado: params.cols?.anio,
      colorDetectado: params.cols?.color,
      kmDetectado: params.cols?.km,
      empresaDetectada: params.cols?.empresa,
      precioDetectado: params.cols?.precio,
      fechaDetectada: params.cols?.fechaToma,
      reason: params.reason,
      category: params.category,
    };
  }

  /**
   * Detecta si una fila visual corresponde a los encabezados de la tabla de stock
   * y calcula los rangos de coordenadas X de cada columna.
   */
  private detectHeaderBounds(
    rows: VisualRow[],
    pageWidth: number = 842
  ): Record<TableColumnKey, ColumnRange> {
    // Límites calibrados por defecto para el formato apaisado estándar de Autonet (~842 pt de ancho)
    const scale = pageWidth > 0 ? pageWidth / 842 : 1;
    const defaultBounds: Record<TableColumnKey, ColumnRange> = {
      orden: { min: 0 * scale, max: 40 * scale },
      prefijo: { min: 40 * scale, max: 72 * scale },
      vehiculo: { min: 72 * scale, max: 360 * scale },
      ub: { min: 360 * scale, max: 400 * scale },
      tipo: { min: 400 * scale, max: 430 * scale },
      patente: { min: 430 * scale, max: 500 * scale },
      anio: { min: 500 * scale, max: 545 * scale },
      color: { min: 545 * scale, max: 605 * scale },
      km: { min: 605 * scale, max: 675 * scale },
      empresa: { min: 675 * scale, max: 745 * scale },
      precio: { min: 745 * scale, max: 815 * scale },
      fechaToma: { min: 815 * scale, max: 2000 * scale },
    };

    // Buscar si alguna fila contiene los encabezados reales
    for (const row of rows) {
      const lineUpper = row.rawLine.toUpperCase();
      const hasPatenteHdr = /\b(PATENTE|DOMINIO)\b/.test(lineUpper);
      const hasUnidadHdr = /\b(UNIDAD|MODELO|VERSION)\b/.test(lineUpper);
      const hasKmHdr = /\b(KM|KILOMETRAJE)\b/.test(lineUpper);
      const hasPrecioHdr = /\b(VR\.?|VENTA|PRECIO)\b/.test(lineUpper);
      const hasAnioHdr = /\b(AÑO|ANO)\b/.test(lineUpper);

      const headerMatches = [hasPatenteHdr, hasUnidadHdr, hasKmHdr, hasPrecioHdr, hasAnioHdr].filter(Boolean).length;
      if (headerMatches >= 3) {
        // Encontramos la fila de encabezados: medir posiciones reales de tokens clave
        let vehiculoLeft = 72 * scale;
        let vehiculoRight = 360 * scale;
        let ubCenter = 380 * scale;
        let tipoCenter = 415 * scale;
        let patenteCenter = 465 * scale;
        let anioCenter = 522 * scale;
        let colorCenter = 575 * scale;
        let kmCenter = 640 * scale;
        let empresaCenter = 710 * scale;
        let precioCenter = 780 * scale;
        let fechaTomaCenter = 835 * scale;

        for (const token of row.tokens) {
          const tText = token.text.toUpperCase();
          const tCenter = token.x + token.width / 2;

          if (tText.includes('UNIDAD')) {
            vehiculoLeft = Math.min(75 * scale, Math.max(65 * scale, token.x - 30));
          }
          if (tText.includes('VERSION') || tText.includes('MODELO')) {
            vehiculoRight = Math.max(vehiculoRight, token.x + token.width);
          }
          if (tText === 'UB' || tText.includes('UB')) ubCenter = tCenter;
          if (tText === 'TIPO' || tText.includes('TIPO')) tipoCenter = tCenter;
          if (tText.includes('PATENTE') || tText.includes('DOMINIO')) patenteCenter = tCenter;
          if (tText.includes('AÑO') || tText.includes('ANO')) anioCenter = tCenter;
          if (tText.includes('COLOR')) colorCenter = tCenter;
          if (tText.includes('KM')) kmCenter = tCenter;
          if (tText.includes('EMPRESA')) empresaCenter = tCenter;
          if (tText.includes('VR') || tText.includes('VENTA') || tText.includes('PRECIO')) precioCenter = tCenter;
          if (tText.includes('TOMA') || tText.includes('FECHA')) fechaTomaCenter = tCenter;
        }

        const ordenMax = Math.min(40 * scale, vehiculoLeft * 0.55);
        return {
          orden: { min: 0, max: ordenMax },
          prefijo: { min: ordenMax, max: vehiculoLeft },
          vehiculo: { min: vehiculoLeft, max: (vehiculoRight + ubCenter) / 2 },
          ub: { min: (vehiculoRight + ubCenter) / 2, max: (ubCenter + tipoCenter) / 2 },
          tipo: { min: (ubCenter + tipoCenter) / 2, max: (tipoCenter + patenteCenter) / 2 },
          patente: { min: (tipoCenter + patenteCenter) / 2, max: (patenteCenter + anioCenter) / 2 },
          anio: { min: (patenteCenter + anioCenter) / 2, max: (anioCenter + colorCenter) / 2 },
          color: { min: (anioCenter + colorCenter) / 2, max: (colorCenter + kmCenter) / 2 },
          km: { min: (colorCenter + kmCenter) / 2, max: (kmCenter + empresaCenter) / 2 },
          empresa: { min: (kmCenter + empresaCenter) / 2, max: (empresaCenter + precioCenter) / 2 },
          precio: { min: (empresaCenter + precioCenter) / 2, max: (precioCenter + fechaTomaCenter) / 2 },
          fechaToma: { min: (precioCenter + fechaTomaCenter) / 2, max: 2000 * scale },
        };
      }
    }

    return defaultBounds;
  }

  /**
   * Asigna los tokens de una fila visual a las columnas según sus coordenadas X.
   */
  private assignRowTokensToColumns(
    row: VisualRow,
    bounds: Record<TableColumnKey, ColumnRange>
  ): {
    strings: Record<TableColumnKey, string>;
    tokens: Record<TableColumnKey, PdfToken[]>;
  } {
    const colTokens: Record<TableColumnKey, PdfToken[]> = {
      orden: [],
      prefijo: [],
      vehiculo: [],
      ub: [],
      tipo: [],
      patente: [],
      anio: [],
      color: [],
      km: [],
      empresa: [],
      precio: [],
      fechaToma: [],
    };

    for (const token of row.tokens) {
      const tokenCenter = token.x + token.width / 2;
      let assigned = false;
      for (const [colKey, range] of Object.entries(bounds) as [TableColumnKey, ColumnRange][]) {
        if (tokenCenter >= range.min && tokenCenter < range.max) {
          // Protección: si cae en columna 'vehiculo' pero es un prefijo interno en x < 75 pt,
          // pertenece a la primera columna ('prefijo').
          if (colKey === 'vehiculo' && token.x < 75 && BANNED_VERSION_PREFIX_REGEX.test(token.text.trim())) {
            colTokens.prefijo.push(token);
            assigned = true;
            break;
          }
          colTokens[colKey].push(token);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        if (tokenCenter >= bounds.fechaToma.min) {
          colTokens.fechaToma.push(token);
        } else {
          colTokens.orden.push(token);
        }
      }
    }

    const strings: Record<TableColumnKey, string> = {
      orden: colTokens.orden.map((t) => t.text).join(' ').trim(),
      prefijo: colTokens.prefijo.map((t) => t.text).join(' ').trim(),
      vehiculo: colTokens.vehiculo.map((t) => t.text).join(' ').trim(),
      ub: colTokens.ub.map((t) => t.text).join(' ').trim(),
      tipo: colTokens.tipo.map((t) => t.text).join(' ').trim(),
      patente: colTokens.patente.map((t) => t.text).join(' ').trim(),
      anio: colTokens.anio.map((t) => t.text).join(' ').trim(),
      color: colTokens.color.map((t) => t.text).join(' ').trim(),
      km: colTokens.km.map((t) => t.text).join(' ').trim(),
      empresa: colTokens.empresa.map((t) => t.text).join(' ').trim(),
      precio: colTokens.precio.map((t) => t.text).join(' ').trim(),
      fechaToma: colTokens.fechaToma.map((t) => t.text).join(' ').trim(),
    };

    return { strings, tokens: colTokens };
  }

  /**
   * Determina si una fila visual es un encabezado, título general o pie de página.
   */
  private isHeaderOrTitleRow(row: VisualRow): boolean {
    const raw = row.rawLine.trim();
    if (!raw) return true;
    if (/^---\s*P[AÁ]GINA\s+\d+/i.test(raw)) return true;
    if (/^P[AÁ]GINA\s+\d+(\s+DE\s+\d+)?$/i.test(raw)) return true;
    if (/^AUTONET(\s+USADOS)?$/i.test(raw)) return true;
    if (/^STOCK(\s+DE)?\s+(UNIDADES\s+)?(DISPONIBLES|USADOS)/i.test(raw)) return true;
    if (/^LISTADO?\s+DE\s+(STOCK|PRECIOS|UNIDADES)/i.test(raw)) return true;

    // Fila de encabezados de columnas
    if (
      /\b(PATENTE|DOMINIO)\b/i.test(raw) &&
      /\b(UNIDAD|MODELO|VERSION|UB|KM|PRECIO|VENTA)\b/i.test(raw)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Extrae texto y detecta vehículos de cualquier archivo PDF utilizando
   * EXCLUSIVAMENTE coordenadas X / Y de PDF.js para interpretar la estructura tabular.
   */
  public async extractFromPdfFile(
    file: File,
    onStageUpdate?: (stage: PdfStageInfo) => void
  ): Promise<ParsePdfResult> {
    try {
      // 1. Etapa: Archivo recibido
      onStageUpdate?.({
        key: 'archivo_recibido',
        label: 'Archivo recibido',
        status: 'ok',
        detail: `${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      });

      // 2. Etapa: ArrayBuffer creado
      const buffer = await file.arrayBuffer();
      console.log('[AUTONET PDF] PDF bytes:', buffer.byteLength);
      if (buffer.byteLength === 0) {
        throw new Error('El archivo PDF recibido está vacío (0 bytes).');
      }
      onStageUpdate?.({
        key: 'arraybuffer_creado',
        label: 'ArrayBuffer creado',
        status: 'ok',
        detail: `${buffer.byteLength.toLocaleString('es-AR')} bytes`,
      });

      // 3. Etapa: PDF cargado con PDF.js (Prueba mínima de inicialización, Sección 6)
      onStageUpdate?.({
        key: 'pdf_cargado',
        label: 'Cargando motor PDF.js',
        status: 'in_progress',
      });
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
      });
      const pdf = await loadingTask.promise;
      console.log('[AUTONET PDF] PDF pages:', pdf.numPages);
      onStageUpdate?.({
        key: 'pdf_cargado',
        label: 'PDF cargado',
        status: 'ok',
        detail: `PDF.js v${pdfjsLib.version}`,
      });

      // 4. Etapa: Páginas detectadas
      if (!pdf.numPages || pdf.numPages === 0) {
        throw new Error('El documento no contiene páginas legibles (numPages: 0).');
      }
      onStageUpdate?.({
        key: 'paginas_detectadas',
        label: 'Páginas detectadas',
        status: 'ok',
        detail: `${pdf.numPages} páginas`,
      });

      // 5. Etapa: Texto extraído (Prueba de primera página y extracción total, Sección 7)
      onStageUpdate?.({
        key: 'texto_extraido',
        label: 'Extrayendo texto de páginas',
        status: 'in_progress',
      });

      const firstPage = await pdf.getPage(1);
      const firstContent = await firstPage.getTextContent();
      console.log('[AUTONET PDF] Page 1 text items:', firstContent.items?.length ?? 0);
      if (!firstContent.items || firstContent.items.length === 0) {
        throw new Error('La página 1 del PDF no contiene texto legible (posible archivo escaneado o protegido).');
      }

      let allPageVisualRows: VisualRow[] = [];
      let fullText = '';
      const warnings: string[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = pageNum === 1 ? firstPage : await pdf.getPage(pageNum);
          const textContent = pageNum === 1 ? firstContent : await page.getTextContent();
          const pageTokens = this.extractTokensFromPage(textContent, pageNum);
          const pageRows = this.groupTokensIntoVisualRows(pageTokens);

          allPageVisualRows = allPageVisualRows.concat(pageRows);
          fullText += `\n--- PÁGINA ${pageNum} ---\n` + pageRows.map((r) => r.rawLine).join('\n');
        } catch (pageErr: any) {
          console.warn(`[AUTONET PDF] Advertencia leyendo página ${pageNum}:`, pageErr);
          warnings.push(`No se pudo leer la página ${pageNum}: ${pageErr?.message || ''}`);
        }
      }

      console.log('[AUTONET PDF] Total filas visuales extraídas:', allPageVisualRows.length);
      if (allPageVisualRows.length === 0) {
        throw new Error('No se pudo extraer ninguna fila visual del documento PDF.');
      }
      onStageUpdate?.({
        key: 'texto_extraido',
        label: 'Texto extraído',
        status: 'ok',
        detail: `${allPageVisualRows.length} líneas analizadas`,
      });

      // 6. Etapa: Reconstrucción de filas
      onStageUpdate?.({
        key: 'filas_reconstruidas',
        label: 'Reconstruyendo filas',
        status: 'in_progress',
      });

      // 2. Detectar límites de columnas a partir de los encabezados de la tabla
      const columnBounds = this.detectHeaderBounds(allPageVisualRows);

      // 3. Procesar las filas visuales identificando vehículos por patente válida y columnas fijas
      const validVehicles: Partial<Vehicle>[] = [];
      const discardedRecords: DiscardedRecordDetail[] = [];
      const seenPlates = new Set<string>();

      let rowIdx = 0;
      let recordsReconstructed = 0;

      while (rowIdx < allPageVisualRows.length) {
        const row = allPageVisualRows[rowIdx];

        // Ignorar encabezados, títulos y pies de página
        if (this.isHeaderOrTitleRow(row)) {
          rowIdx++;
          continue;
        }

        const cols = this.assignRowTokensToColumns(row, columnBounds);

        // A) Búsqueda de la patente como ANCLA DE CONTROL (Sección 5)
        let identifiedPlate = '';
        let plateTokenIdx = -1;

        // 1. Buscar en tokens individuales de la fila
        for (let i = 0; i < row.tokens.length; i++) {
          const t = row.tokens[i];
          if (isValidPlate(t.text)) {
            plateTokenIdx = i;
            identifiedPlate = normalizePlate(t.text);
            break;
          }
        }

        // 2. Buscar en pares de tokens adyacentes si la patente quedó partida (ej: "AD" y "835UE")
        if (!identifiedPlate) {
          for (let i = 0; i < row.tokens.length - 1; i++) {
            const combined = row.tokens[i].text + row.tokens[i + 1].text;
            if (isValidPlate(combined)) {
              plateTokenIdx = i;
              identifiedPlate = normalizePlate(combined);
              break;
            }
          }
        }

        // 3. Revisar tokens en la columna patente asignada
        if (!identifiedPlate && cols.strings.patente) {
          const plateTokens = cols.strings.patente.split(/\s+/).filter(Boolean);
          for (const token of plateTokens) {
            if (isValidPlate(token)) {
              identifiedPlate = normalizePlate(token);
              break;
            }
          }
        }

        // Si la fila no tiene patente válida:
        if (!identifiedPlate) {
          if (row.rawLine.length > 8) {
            discardedRecords.push(
              this.createDiscardedRecord({
                page: row.page,
                rowNumber: rowIdx + 1,
                raw: row.rawLine,
                tokens: row.tokens,
                cols: cols.strings,
                reason: 'Registro descartado: no se pudo identificar una patente válida en la fila.',
                category: 'patente_no_detectada',
              })
            );
            console.warn(`[PDF-PARSER] PÁGINA ${row.page} FILA ${rowIdx + 1} DESCARTADA: No hay patente válida -> "${row.rawLine}"`);
          }
          rowIdx++;
          continue;
        }

        // B) Si tiene patente válida: ensamblar el registro (con soporte para líneas multilínea envueltas)
        recordsReconstructed++;

        let assembledVehiculo = cols.strings.vehiculo;
        let assembledUb = cols.strings.ub;
        let assembledTipo = cols.strings.tipo;
        let assembledAnio = cols.strings.anio;
        let assembledColor = cols.strings.color;
        let assembledKm = cols.strings.km;
        let assembledEmpresa = cols.strings.empresa;
        let assembledPrecio = cols.strings.precio;
        let assembledFechaToma = cols.strings.fechaToma;
        let combinedRaw = row.rawLine;
        const combinedTokens = [...row.tokens];

        // Revisar si la siguiente fila es una continuación de esta unidad (ej: segunda línea de versión)
        let nextIdx = rowIdx + 1;
        while (nextIdx < allPageVisualRows.length) {
          const nextRow = allPageVisualRows[nextIdx];
          if (this.isHeaderOrTitleRow(nextRow)) break;

          const nextCols = this.assignRowTokensToColumns(nextRow, columnBounds);

          // Si la siguiente fila contiene su propia patente válida, es OTRA unidad
          const nextHasPlate = nextRow.tokens.some((t) => isValidPlate(t.text));
          // Si la siguiente fila tiene número de orden inicial, es OTRA unidad
          const nextHasOrderNum = /^\d{1,3}$/.test(nextCols.strings.orden.trim());
          // Distancia vertical pequeña (<= 18 pt)
          const isCloseY = Math.abs(allPageVisualRows[nextIdx - 1].y - nextRow.y) <= 18;

          if (!nextHasPlate && !nextHasOrderNum && isCloseY && nextCols.strings.vehiculo) {
            // Es una línea secundaria de descripción
            assembledVehiculo += ' ' + nextCols.strings.vehiculo;
            if (!assembledColor && nextCols.strings.color) assembledColor = nextCols.strings.color;
            if (!assembledKm && nextCols.strings.km) assembledKm = nextCols.strings.km;
            if (!assembledPrecio && nextCols.strings.precio) assembledPrecio = nextCols.strings.precio;
            combinedRaw += ' ' + nextRow.rawLine;
            combinedTokens.push(...nextRow.tokens);
            nextIdx++;
          } else {
            break;
          }
        }

        rowIdx = nextIdx; // Avanzar el cursor de filas

        // C) AUTORRECUPERACIÓN Y NORMALIZACIÓN CON EL ANCLA DE PATENTE (Sección 5 y 9)

        // 1. MARCA, MODELO y VERSION (exclusivamente de columna UNIDAD - MODELO - VERSION)
        let cleanDesc = cleanVehicleColumnText(assembledVehiculo);
        let parsedDesc = parseVehicleDescription(cleanDesc);

        // Si la marca no fue detectada, buscar si quedó un fragmento en el prefijo o antes de UB
        if (parsedDesc.marca === 'DESCONOCIDA') {
          if (cols.strings.prefijo) {
            const tryPrefijo = cleanVehicleColumnText(cols.strings.prefijo + ' ' + assembledVehiculo);
            const parsedPrefijo = parseVehicleDescription(tryPrefijo);
            if (parsedPrefijo.marca !== 'DESCONOCIDA') {
              cleanDesc = tryPrefijo;
              parsedDesc = parsedPrefijo;
            }
          }
        }

        // Si aún no se detectó marca, buscar marcas controladas en la fila cruda completa
        if (parsedDesc.marca === 'DESCONOCIDA') {
          for (const b of CONTROLLED_BRANDS) {
            const m = combinedRaw.match(b.regex);
            if (m && m.index !== undefined) {
              const fromBrand = combinedRaw.slice(m.index);
              const tryLine = parseVehicleDescription(fromBrand);
              if (tryLine.marca !== 'DESCONOCIDA') {
                cleanDesc = fromBrand;
                parsedDesc = tryLine;
                break;
              }
            }
          }
        }

        if (parsedDesc.marca === 'DESCONOCIDA' || parsedDesc.marca.toLowerCase() === 'autonet') {
          discardedRecords.push(
            this.createDiscardedRecord({
              page: row.page,
              rowNumber: recordsReconstructed,
              raw: combinedRaw,
              tokens: combinedTokens,
              cols: cols.strings,
              plate: identifiedPlate,
              reason: `Registro descartado: marca automotriz no válida o no identificada en '${cleanDesc}'.`,
              category: 'marca_no_detectada',
            })
          );
          console.warn(`[PDF-PARSER] Registro descartado: marca automotriz inválida en "${cleanDesc}"`);
          continue;
        }

        const marca = parsedDesc.marca;
        const modelo = parsedDesc.modelo;
        const version = parsedDesc.version;

        // 2. AÑO (columna Año con autorrecuperación en tokens adyacentes a la patente)
        let yearMatch = assembledAnio.match(/\b(199\d|20[0-2]\d|2030)\b/);
        if (!yearMatch) {
          const tokensAfterPlate = plateTokenIdx >= 0 ? combinedTokens.slice(plateTokenIdx + 1) : combinedTokens;
          for (const t of tokensAfterPlate) {
            const m = t.text.match(/\b(199\d|20[0-2]\d|2030)\b/);
            if (m) {
              yearMatch = m;
              assembledAnio = m[1];
              break;
            }
          }
          if (!yearMatch) {
            for (const t of combinedTokens) {
              const m = t.text.match(/\b(199\d|20[0-2]\d|2030)\b/);
              if (m) {
                yearMatch = m;
                assembledAnio = m[1];
                break;
              }
            }
          }
        }

        if (!yearMatch) {
          discardedRecords.push(
            this.createDiscardedRecord({
              page: row.page,
              rowNumber: recordsReconstructed,
              raw: combinedRaw,
              tokens: combinedTokens,
              cols: cols.strings,
              plate: identifiedPlate,
              reason: `Registro descartado: año no válido o fuera de rango (valor recibido: '${assembledAnio}').`,
              category: 'anio_invalido',
            })
          );
          console.warn(`[PDF-PARSER] Registro descartado: año no válido (${assembledAnio}) para patente ${identifiedPlate}`);
          continue;
        }
        const anio = parseInt(yearMatch[1], 10);

        // 3. KILOMETRAJE (columna KM normalizada numéricamente, nunca bloqueante si está ausente/0)
        let kmNum = parseMileage(assembledKm);
        if (kmNum === null) {
          const tokensAfterPlate = plateTokenIdx >= 0 ? combinedTokens.slice(plateTokenIdx + 1) : combinedTokens;
          for (const t of tokensAfterPlate) {
            if (t.text.match(/\b\d{1,3}(?:\.\d{3})+\b/) || t.text === '0' || /^\d{1,6}$/.test(t.text)) {
              const val = parseMileage(t.text);
              if (val !== null && val < 500000) {
                kmNum = val;
                assembledKm = t.text;
                break;
              }
            }
          }
        }
        if (kmNum === null || isNaN(kmNum) || kmNum < 0) {
          kmNum = 0; // Default a 0 km para unidades nuevas o sin kilometraje consignado
        }
        const kilometraje = kmNum;

        // 4. PRECIO (columna VR VENTA normalizada con parsePrice)
        let precioNum = parsePrice(assembledPrecio);
        if (precioNum === null || precioNum <= 100000) {
          const tokensAfterPlate = plateTokenIdx >= 0 ? combinedTokens.slice(plateTokenIdx + 1) : combinedTokens;
          for (const t of tokensAfterPlate) {
            const p = parsePrice(t.text);
            if (p && p >= 500000) {
              precioNum = p;
              assembledPrecio = t.text;
              break;
            }
          }
        }

        if (precioNum === null || precioNum <= 0) {
          discardedRecords.push(
            this.createDiscardedRecord({
              page: row.page,
              rowNumber: recordsReconstructed,
              raw: combinedRaw,
              tokens: combinedTokens,
              cols: cols.strings,
              plate: identifiedPlate,
              reason: `Registro descartado: precio no numérico o inválido en columna VR VENTA (valor recibido: '${assembledPrecio}').`,
              category: 'precio_invalido',
            })
          );
          console.warn(`[PDF-PARSER] Registro descartado: Precio inválido (${assembledPrecio}) para patente ${identifiedPlate}`);
          continue;
        }
        const precio = precioNum;

        // 5. UBICACIÓN (Ub) y TIPO
        const ubCode = assembledUb.trim().toUpperCase() || 'P';
        const ubInfo = getSituacionOperativaInfo(ubCode);
        const tipoVehiculo = assembledTipo.replace(/[^0-9]/g, '') || '1';

        // 6. EMPRESA, COLOR, FECHA TOMA
        const empresa = assembledEmpresa.trim() || 'AUTONET';
        const color = assembledColor.trim() || 'Consultar';
        const fechaToma = assembledFechaToma.trim() || '-';

        // 7. Deduplicación por patente
        if (seenPlates.has(identifiedPlate)) {
          discardedRecords.push(
            this.createDiscardedRecord({
              page: row.page,
              rowNumber: recordsReconstructed,
              raw: combinedRaw,
              tokens: combinedTokens,
              cols: cols.strings,
              plate: identifiedPlate,
              reason: `Registro descartado: patente duplicada en el archivo (${identifiedPlate}).`,
              category: 'otros',
            })
          );
          continue;
        }
        seenPlates.add(identifiedPlate);

        // 8. Crear el objeto Vehicle validado
        const numOrden = validVehicles.length + 1;
        const observacionesRevision = parsedDesc.requiereRevisionModelo ? ' | Requiere revisión de modelo' : '';
        const vehicle: Partial<Vehicle> = {
          id: `AUT-${String(numOrden).padStart(3, '0')}`,
          numeroOrden: numOrden,
          marca,
          modelo,
          version,
          anio,
          color,
          kilometraje,
          precio,
          moneda: 'ARS',
          patente: identifiedPlate,
          combustible: 'Nafta',
          caja: 'Manual',
          traccion: '4x2',
          estado: 'Disponible',
          observaciones: `Ubicación: ${ubInfo.label} | Empresa: ${empresa} | Toma: ${fechaToma}${observacionesRevision}`,
          ubicacion: ubCode,
          ubCode,
          ubLabel: ubInfo.shortLabel,
          tipoVehiculo,
          empresa,
          fechaToma,
          fotoPrincipal: '',
          fotos: [],
          sincronizadoAutonetWeb: false,
          origenDato: 'autonet_pdf',
        };

        validVehicles.push(vehicle);

        console.log(
          `[PDF-PARSER] VALID VEHICLE #${numOrden}: ${marca} ${modelo} (${anio}) | Patente: ${identifiedPlate} | KM: ${kilometraje} | Precio: ${precio.toLocaleString('es-AR')} | Ub: ${ubCode} | Tipo: ${tipoVehiculo}`
        );
      }

      // 4. Construir resumen de motivos de descarte agrupados (Sección 3 y 4)
      const discardedSummary: DiscardedSummary = {
        patenteNoDetectada: 0,
        patenteInvalida: 0,
        marcaNoDetectada: 0,
        modeloNoDetectado: 0,
        anioInvalido: 0,
        kmInvalido: 0,
        precioInvalido: 0,
        columnasIncompletas: 0,
        otros: 0,
      };

      for (const d of discardedRecords) {
        switch (d.category) {
          case 'patente_no_detectada':
            discardedSummary.patenteNoDetectada++;
            break;
          case 'patente_invalida':
            discardedSummary.patenteInvalida++;
            break;
          case 'marca_no_detectada':
            discardedSummary.marcaNoDetectada++;
            break;
          case 'modelo_no_detectado':
            discardedSummary.modeloNoDetectado++;
            break;
          case 'anio_invalido':
            discardedSummary.anioInvalido++;
            break;
          case 'km_invalido':
            discardedSummary.kmInvalido++;
            break;
          case 'precio_invalido':
            discardedSummary.precioInvalido++;
            break;
          case 'columnas_incompletas':
            discardedSummary.columnasIncompletas++;
            break;
          default:
            discardedSummary.otros++;
            break;
        }
      }

      onStageUpdate?.({
        key: 'filas_reconstruidas',
        label: 'Filas reconstruidas',
        status: 'ok',
        detail: `${recordsReconstructed} filas detectadas`,
      });

      onStageUpdate?.({
        key: 'vehiculos_validados',
        label: 'Vehículos validados',
        status: 'ok',
        detail: `${validVehicles.length} unidades válidas`,
      });

      const diagnostics: ParsingDiagnostics = {
        pageCount: pdf.numPages,
        linesExtracted: allPageVisualRows.length,
        recordsReconstructed: recordsReconstructed,
        validRecords: validVehicles.length,
        discardedRecords: discardedRecords.length,
        discardedDetails: discardedRecords,
        discardedSummary,
      };

      console.log(`[PDF-PARSER-RESUMEN] Total páginas: ${pdf.numPages} | Filas visuales: ${allPageVisualRows.length} | Filas reconstruidas: ${recordsReconstructed} | Vehículos válidos: ${validVehicles.length} | Descartados: ${discardedRecords.length}`);

      return {
        fileName: file.name,
        fileSize: file.size,
        pageCount: pdf.numPages,
        rawText: fullText,
        extractedVehicles: validVehicles,
        parseWarnings: warnings,
        diagnostics,
      };
    } catch (error: any) {
      console.error('[AUTONET PDF IMPORT ERROR]', error);
      throw error;
    }
  }

  /**
   * Fallback para procesar texto pegado manualmente, aplicando las mismas
   * reglas estrictas de validación de patente y columnas.
   */
  public extractFromText(rawText: string, fileName: string = 'Texto_PDF.txt'): ParsePdfResult {
    const rawLines = rawText.split(/[\r\n]+/).filter((l) => l.trim().length > 0);
    const validVehicles: Partial<Vehicle>[] = [];
    const discardedRecords: DiscardedRecordDetail[] = [];
    const seenPlates = new Set<string>();

    let numOrden = 0;
    for (const line of rawLines) {
      // Buscar patente válida con regex
      const words = line.split(/\s+/);
      let foundPlate = '';
      for (const w of words) {
        if (isValidPlate(w)) {
          foundPlate = normalizePlate(w);
          break;
        }
      }

      if (!foundPlate) {
        discardedRecords.push({
          raw: line,
          reason: 'Registro descartado: no se pudo identificar una patente válida.',
        });
        continue;
      }

      // Buscar marca automotriz válida
      const brandDef = KNOWN_BRANDS.find((b) => b.regex.test(line));
      if (!brandDef || brandDef.standard.toLowerCase() === 'autonet') {
        discardedRecords.push({
          raw: line,
          reason: `Registro descartado: marca automotriz no válida en '${line.slice(0, 50)}'.`,
        });
        continue;
      }

      // Buscar año
      const yMatch = line.match(/\b(199\d|20[0-2]\d|2030)\b/);
      if (!yMatch) {
        discardedRecords.push({
          raw: line,
          reason: 'Registro descartado: año no válido o no encontrado.',
        });
        continue;
      }

      // Buscar precio
      const priceMatches = [...line.matchAll(/\b(\d{1,3}(?:\.\d{3}){2,3}|\d{7,9})\b/g)];
      let precio = 0;
      if (priceMatches.length > 0) {
        const lastMatch = priceMatches[priceMatches.length - 1];
        precio = parseInt(lastMatch[1].replace(/\./g, ''), 10);
      }
      if (precio <= 0) {
        discardedRecords.push({
          raw: line,
          reason: 'Registro descartado: precio de venta no encontrado.',
        });
        continue;
      }

      // Buscar km (número anterior al precio)
      const kmMatch = line.match(/\b(\d{1,3}(?:\.\d{3})?)\s*(?:km)?\b/i);
      const km = kmMatch ? normalizeMileage(kmMatch[1]) ?? 0 : 0;

      if (seenPlates.has(foundPlate)) {
        discardedRecords.push({
          raw: line,
          reason: `Registro descartado: patente duplicada (${foundPlate}).`,
        });
        continue;
      }
      seenPlates.add(foundPlate);

      numOrden++;
      validVehicles.push({
        id: `AUT-${String(numOrden).padStart(3, '0')}`,
        numeroOrden: numOrden,
        marca: brandDef.standard,
        modelo: 'Unidad',
        version: 'Estándar',
        anio: parseInt(yMatch[1], 10),
        kilometraje: km,
        precio,
        patente: foundPlate,
        moneda: 'ARS',
        estado: 'Disponible',
        ubicacion: 'P',
        ubCode: 'P',
        ubLabel: 'Parque',
        tipoVehiculo: '1',
        empresa: 'AUTONET',
        color: 'Consultar',
        origenDato: 'autonet_pdf',
      });
    }

    const diagnostics: ParsingDiagnostics = {
      pageCount: 1,
      linesExtracted: rawLines.length,
      recordsReconstructed: rawLines.length,
      validRecords: validVehicles.length,
      discardedRecords: discardedRecords.length,
      discardedDetails: discardedRecords,
    };

    return {
      fileName,
      fileSize: rawText.length,
      pageCount: 1,
      rawText,
      extractedVehicles: validVehicles,
      parseWarnings: [],
      diagnostics,
    };
  }

  /**
   * Compara los vehículos extraídos de una nueva lista contra el stock actual.
   * Utiliza de forma ESTRICTA la PATENTE normalizada como identificador principal.
   * Implementa las validaciones de seguridad de bloqueo si el volumen de registros extraídos
   * es sospechosamente bajo (< 60% del stock anterior) para prevenir eliminaciones masivas por error.
   */
  public compareWithStock(
    extractedList: Partial<Vehicle>[],
    currentStock: Vehicle[],
    fileName: string = 'Lista_Stock.pdf',
    diagnostics?: ParsingDiagnostics
  ): DiffResult {
    const currentMap = new Map<string, Vehicle>();
    currentStock.forEach((v) => {
      const key = generateVehicleKey(v);
      if (key) {
        currentMap.set(key, v);
      }
    });

    const incomingKeys = new Set<string>();
    const diffItems: VehicleDiffItem[] = [];

    let nuevosCount = 0;
    let modificadosCount = 0;
    let sinCambiosCount = 0;
    let cambiosPrecioCount = 0;
    let corregidosCount = 0;

    // 1. Analizar los vehículos entrantes
    extractedList.forEach((incoming) => {
      const key = generateVehicleKey(incoming);
      if (!key) return; // Omitir registros sin clave válida

      incomingKeys.add(key);
      const existing = currentMap.get(key);

      if (!existing) {
        // Nuevo ingreso detectado
        nuevosCount++;
        diffItems.push({
          patente: incoming.patente || 'S/P',
          marcaModelo: `${incoming.marca || ''} ${incoming.modelo || ''} ${incoming.version || ''}`.trim(),
          tipo: 'nuevo',
          vehiculoNuevo: incoming,
        });
      } else {
        // Vehículo existente en stock actual: comparar campos
        const changes: FieldChange[] = [];

        // Precio
        if (incoming.precio !== undefined && incoming.precio !== existing.precio) {
          cambiosPrecioCount++;
          changes.push({
            campo: 'precio',
            etiqueta: 'Precio de venta',
            valorAnterior: existing.precio,
            valorNuevo: incoming.precio,
          });
        }

        // Kilometraje (con normalización numérica estricta)
        const incKm = normalizeMileage(incoming.kilometraje) ?? 0;
        const existKm = normalizeMileage(existing.kilometraje) ?? 0;
        if (incoming.kilometraje !== undefined && incKm !== existKm) {
          changes.push({
            campo: 'kilometraje',
            etiqueta: 'Kilometraje',
            valorAnterior: existKm,
            valorNuevo: incKm,
          });
        }

        // Marca (corrige registros previos con "Autonet")
        if (incoming.marca && (incoming.marca !== existing.marca || existing.marca.toLowerCase() === 'autonet')) {
          changes.push({
            campo: 'marca',
            etiqueta: 'Marca',
            valorAnterior: existing.marca,
            valorNuevo: incoming.marca,
          });
        }

        // Modelo (corrige registros previos con "P" o prefijos desplazados)
        if (incoming.modelo && (incoming.modelo !== existing.modelo || existing.modelo === 'P' || existing.modelo.startsWith('-'))) {
          changes.push({
            campo: 'modelo',
            etiqueta: 'Modelo',
            valorAnterior: existing.modelo,
            valorNuevo: incoming.modelo,
          });
        }

        // Versión (corrige prefijos residuales)
        if (incoming.version && (incoming.version !== existing.version || existing.version.startsWith('-'))) {
          changes.push({
            campo: 'version',
            etiqueta: 'Versión',
            valorAnterior: existing.version,
            valorNuevo: incoming.version,
          });
        }

        // Color
        if (incoming.color && incoming.color !== existing.color && incoming.color !== 'Consultar') {
          changes.push({
            campo: 'color',
            etiqueta: 'Color',
            valorAnterior: existing.color,
            valorNuevo: incoming.color,
          });
        }

        // Ubicación / Situación operativa (Ub)
        if (incoming.ubCode && incoming.ubCode !== (existing.ubCode || existing.ubicacion)) {
          changes.push({
            campo: 'ubCode',
            etiqueta: 'Ubicación (Ub)',
            valorAnterior: existing.ubCode || existing.ubicacion,
            valorNuevo: incoming.ubCode,
          });
        }

        // Empresa / Sociedad comercial
        if (incoming.empresa && incoming.empresa !== existing.empresa) {
          changes.push({
            campo: 'empresa',
            etiqueta: 'Empresa',
            valorAnterior: existing.empresa,
            valorNuevo: incoming.empresa,
          });
        }

        // Detección de registro previo corregido
        const isCorregido = changes.some(
          (c) =>
            (c.campo === 'marca' && String(c.valorAnterior).toLowerCase() === 'autonet') ||
            (c.campo === 'modelo' && (c.valorAnterior === 'P' || String(c.valorAnterior).startsWith('-') || c.valorAnterior === 'Modelo')) ||
            (c.campo === 'version' && (String(c.valorAnterior).startsWith('-') || c.valorAnterior === 'Estándar'))
        );
        if (isCorregido) {
          corregidosCount++;
        }

        // Estado (Verificar protección de "Vendido" o "Reservado" manual)
        let advertenciaEstado: string | undefined;
        if (existing.estado === 'Vendido' && existing.estadoModificadoManualmente) {
          advertenciaEstado = 'Vehículo marcado manualmente como VENDIDO por el asesor comercial. Se mantendrá VENDIDO protegiendo la venta.';
        } else if (existing.estado === 'Reservado' && existing.estadoModificadoManualmente) {
          advertenciaEstado = 'Vehículo con RESERVA manual activa. Se preserva el estado reservado.';
        }

        if (changes.length > 0) {
          modificadosCount++;
          diffItems.push({
            patente: existing.patente,
            marcaModelo: `${incoming.marca || existing.marca} ${incoming.modelo || existing.modelo} ${incoming.version || existing.version}`,
            tipo: 'modificado',
            cambios: changes,
            vehiculoNuevo: incoming,
            vehiculoExistente: existing,
            advertenciaEstado,
          });
        } else {
          sinCambiosCount++;
          diffItems.push({
            patente: existing.patente,
            marcaModelo: `${existing.marca} ${existing.modelo} ${existing.version}`,
            tipo: 'sin_cambio',
            vehiculoExistente: existing,
            advertenciaEstado,
          });
        }
      }
    });

    // 2. Analizar vehículos del stock actual que NO vinieron en la nueva lista
    let noAparecenCount = 0;
    currentStock.forEach((existing) => {
      const key = generateVehicleKey(existing);
      if (!key) return; // Si era un registro corrupto sin patente válida, no computar como baja legítima

      if (!incomingKeys.has(key)) {
        noAparecenCount++;
        diffItems.push({
          patente: existing.patente,
          marcaModelo: `${existing.marca} ${existing.modelo} ${existing.version}`,
          tipo: 'no_aparece',
          vehiculoExistente: existing,
          advertenciaEstado:
            existing.estado === 'Vendido'
              ? 'Ya estaba marcado como Vendido.'
              : 'No figura en la nueva lista de Autonet. Podría haber sido vendido o retirado.',
        });
      }
    });

    // 3. VALIDACIONES DE SEGURIDAD Y BLOQUEO DE CONFIRMACIÓN
    const currentCount = currentStock.length;
    const extractedCount = extractedList.length;
    const ratio = currentCount > 0 ? extractedCount / currentCount : 1;

    let isBlocked = false;
    let blockedReason: string | undefined;
    let warningMessage: string | undefined;

    // Regla 1: Si el nuevo stock es inferior al 60% del stock anterior (cuando stock anterior >= 20)
    if (currentCount >= 20 && ratio < 0.60) {
      isBlocked = true;
      blockedReason = `Se detectó una cantidad inusualmente baja de unidades (${extractedCount} extraídas vs ${currentCount} actuales, ${(ratio * 100).toFixed(1)}%). El archivo puede no haberse interpretado correctamente. La actualización fue bloqueada para evitar eliminar stock por error.`;
    } 
    // Regla 2: Parser encuentra menos de 50 registros (cuando stock anterior >= 50)
    else if (currentCount >= 50 && extractedCount < 50) {
      isBlocked = true;
      blockedReason = `El archivo analizado solo contiene ${extractedCount} unidades válidas, mientras que el stock actual cuenta con ${currentCount}. Se bloqueó la confirmación preventiva.`;
    }
    // Regla 3: Más del 30% de los registros fueron descartados
    else if (diagnostics && diagnostics.recordsReconstructed > 10 && (diagnostics.discardedRecords / diagnostics.recordsReconstructed) > 0.30) {
      isBlocked = true;
      blockedReason = `Se descartó el ${((diagnostics.discardedRecords / diagnostics.recordsReconstructed) * 100).toFixed(1)}% de las filas por falta de datos esenciales (patente, año o precio). Revise el archivo.`;
    }
    // Regla 4: No se detectaron vehículos válidos
    else if (extractedCount === 0) {
      isBlocked = true;
      blockedReason = 'No se detectó ninguna unidad válida en el archivo PDF proporcionado.';
    }
    // Advertencia informativa si hay más del 25% de bajas pero no está bloqueado
    else if (currentCount >= 20 && noAparecenCount > 0.25 * currentCount) {
      warningMessage = `Atención: Hay ${noAparecenCount} unidades que no figuran en esta lista (${((noAparecenCount / currentCount) * 100).toFixed(1)}% del stock actual). Verifique que correspondan a unidades vendidas o retiradas.`;
    }

    const safetyValidation: SafetyValidation = {
      isBlocked,
      blockedReason,
      warningMessage,
      ratio,
    };

    if (diagnostics) {
      diagnostics.corregidosCount = corregidosCount;
    }

    return {
      archivoNombre: fileName,
      totalEncontrados: extractedCount,
      nuevos: nuevosCount,
      modificados: modificadosCount,
      sinCambios: sinCambiosCount,
      noAparecen: noAparecenCount,
      cambiosPrecio: cambiosPrecioCount,
      corregidos: corregidosCount,
      items: diffItems,
      timestamp: new Date().toISOString(),
      diagnostics,
      safetyValidation,
    };
  }

  /**
   * Genera un lote de prueba simulado realista para probar el flujo.
   */
  public generateSimulatedBatch(
    currentStock: Vehicle[], 
    scenario: 'quincenal' | 'cambio_precios' | 'ingresos_masivos'
  ): Partial<Vehicle>[] {
    const base: Partial<Vehicle>[] = currentStock.map((v) => ({ ...v }));

    if (scenario === 'quincenal') {
      if (base.length > 3) {
        base.pop();
      }

      if (base[0]) {
        base[0].precio = (base[0].precio || 30000000) + 1200000;
        base[0].kilometraje = (base[0].kilometraje || 20000) + 1500;
      }
      if (base[1]) {
        base[1].precio = (base[1].precio || 40000000) - 800000;
      }

      base.push({
        id: 'AUT-113',
        marca: 'Chevrolet',
        modelo: 'Tracker',
        version: '1.2 Turbo Premier AT',
        anio: 2023,
        color: 'Gris Plata',
        kilometraje: 17500,
        precio: 31800000,
        moneda: 'ARS',
        patente: 'AF 930 LL',
        combustible: 'Nafta',
        caja: 'Automática',
        traccion: '4x2',
        estado: 'Disponible',
        observaciones: 'Nuevo ingreso Autonet.',
        fotoPrincipal: '',
        fotos: [],
        urlAutonetOriginal: 'https://autonet.com.ar/usados/chevrolet-tracker-af930ll',
        provinciaRadicacion: 'Neuquén',
      });

      base.push({
        id: 'AUT-114',
        marca: 'Volkswagen',
        modelo: 'Vento',
        version: 'GLI 2.0 TSI DSG 230 CV',
        anio: 2022,
        color: 'Rojo Tornado',
        kilometraje: 38000,
        precio: 41000000,
        moneda: 'ARS',
        patente: 'AF 114 VK',
        combustible: 'Nafta',
        caja: 'Automática',
        traccion: '4x2',
        estado: 'Disponible',
        observaciones: 'Sedán deportivo premium.',
        fotoPrincipal: '',
        fotos: [],
        urlAutonetOriginal: 'https://autonet.com.ar/usados/volkswagen-vento-gli-af114vk',
        provinciaRadicacion: 'Neuquén',
      });
    }

    return base;
  }
}

export const pdfService = new PdfService();
