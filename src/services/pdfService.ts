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
  SafetyValidation
} from '../types/stock';
import { autonetService } from './autonetService';
import { normalizeMileage } from '../utils/formatters';

// Configure pdfjs worker if in browser
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('pdfjs worker initialization error:', e);
  }
}

export { normalizeMileage };

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
 * Normaliza una patente argentina eliminando espacios, guiones y caracteres no alfanuméricos,
 * convirtiendo a mayúsculas y aplicando trim.
 * 
 * Ejemplos:
 * "AD835UE", "AD 835 UE", "ad835ue", " AD835UE ", "AD-835-UE" -> "AD835UE"
 * "AG560PC", "AI029HY", "AF930LL" -> Mercosur
 * "ABC 123", "abc-123" -> Tradicional
 * "RA28489", "HF13759" -> Especiales / internos
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
 * Genera una clave única de comparación para un vehículo.
 * IDENTIFICADOR PRINCIPAL: PATENTE normalizada.
 * REGLA ESTRICTA: NO usar el número de fila / orden de la primera columna como ID,
 * ya que cambia entre versiones del PDF.
 * Fallback únicamente si la unidad no posee patente válida: marca + modelo + versión + año normalizados.
 */
export function generateVehicleKey(v: Partial<Vehicle>): string {
  const plate = normalizePlate(v.patente);
  if (plate && plate.length >= 5) {
    return plate;
  }
  const marca = (v.marca || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const modelo = (v.modelo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const anio = v.anio || '';
  const version = (v.version || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `fallback_${marca}_${modelo}_${anio}_${version}`;
}

export interface BrandDefinition {
  regex: RegExp;
  standard: string;
}

export const KNOWN_BRANDS: BrandDefinition[] = [
  { regex: /\b(VOLKSWAGEN|VW)\b/i, standard: 'Volkswagen' },
  { regex: /\bTOYOTA\b/i, standard: 'Toyota' },
  { regex: /\bFORD\b/i, standard: 'Ford' },
  { regex: /\b(CHEVROLET|CHEVY)\b/i, standard: 'Chevrolet' },
  { regex: /\bFIAT\b/i, standard: 'Fiat' },
  { regex: /\bRENAULT\b/i, standard: 'Renault' },
  { regex: /\bPEUGEOT\b/i, standard: 'Peugeot' },
  { regex: /\bJEEP\b/i, standard: 'Jeep' },
  { regex: /\bNISSAN\b/i, standard: 'Nissan' },
  { regex: /\b(CITROEN|CITROËN)\b/i, standard: 'Citroën' },
  { regex: /\bHONDA\b/i, standard: 'Honda' },
  { regex: /\bHYUNDAI\b/i, standard: 'Hyundai' },
  { regex: /\bKIA\b/i, standard: 'Kia' },
  { regex: /\bAUDI\b/i, standard: 'Audi' },
  { regex: /\bBMW\b/i, standard: 'BMW' },
  { regex: /\b(MERCEDES[-\s]?BENZ|MERCEDES)\b/i, standard: 'Mercedes-Benz' },
  { regex: /\bRAM\b/i, standard: 'RAM' },
  { regex: /\bCHERY\b/i, standard: 'Chery' },
  { regex: /\bMITSUBISHI\b/i, standard: 'Mitsubishi' },
  { regex: /\bDS\b/i, standard: 'DS' },
  { regex: /\bBAIC\b/i, standard: 'BAIC' },
  { regex: /\bHAVAL\b/i, standard: 'Haval' },
  { regex: /\bGREAT\s+WALL\b/i, standard: 'Great Wall' },
  { regex: /\bJAC\b/i, standard: 'JAC' },
  { regex: /\bGEELY\b/i, standard: 'Geely' },
  { regex: /\bBYD\b/i, standard: 'BYD' },
  { regex: /\bDFSK\b/i, standard: 'DFSK' },
  { regex: /\bLIFAN\b/i, standard: 'Lifan' },
  { regex: /\bVOLVO\b/i, standard: 'Volvo' },
  { regex: /\bMINI\b/i, standard: 'Mini' },
  { regex: /\bALFA\s+ROMEO\b/i, standard: 'Alfa Romeo' },
  { regex: /\bSEAT\b/i, standard: 'SEAT' },
  { regex: /\bDODGE\b/i, standard: 'Dodge' },
  { regex: /\bCHRYSLER\b/i, standard: 'Chrysler' },
  { regex: /\bLEXUS\b/i, standard: 'Lexus' },
  { regex: /\bISUZU\b/i, standard: 'Isuzu' },
  { regex: /\bIVECO\b/i, standard: 'Iveco' },
];

const KNOWN_MODELS = [
  'COROLLA CROSS', 'C3 AIRCROSS', 'C4 CACTUS', 'DUSTER OROCH', 'SANDERO STEPWAY',
  'GOL TREND', 'T CROSS', 'T-CROSS', 'TIGGO 4', 'S 10', 'FOX CROSSFOX', 'GRAND CHEROKEE',
  'CRUZE', 'ONIX', 'PRISMA', 'SPIN', 'TRACKER', 'BERLINGO', 'C3', 'C4',
  'ARGO', 'CRONOS', 'FASTBACK', 'PALIO', 'PULSE', 'TORO', 'MOBI', 'STRADA', 'FIORINO', 'SIENA',
  'ECOSPORT', 'FIESTA', 'FOCUS', 'KA', 'KUGA', 'MAVERICK', 'RANGER', 'TERRITORY', 'MONDEO',
  'HRV', 'WRV', 'CRV', 'CIVIC', 'FIT',
  'CRETA', 'TUCSON', 'SANTA FE', 'COMPASS', 'PATRIOT', 'RENEGADE', 'WRANGLER',
  'SOUL', 'SPORTAGE', 'SELTOS', 'KICKS', 'NOTE', 'SENTRA', 'FRONTIER', 'VERSA', 'MARCH',
  '2008', '208', '3008', '308', '408', 'PARTNER',
  'ARKANA', 'CAPTUR', 'DUSTER', 'FLUENCE', 'KARDIAN', 'KWID', 'LOGAN', 'SANDERO', 'KANGOO', 'ALASKAN', 'MASTER',
  'COROLLA', 'ETIOS', 'HILUX', 'YARIS', 'SW4', 'RAV4',
  'AMAROK', 'GOLF', 'NIVUS', 'POLO', 'SURAN', 'TAOS', 'TERA', 'UP', 'VENTO', 'VIRTUS', 'FOX', 'SAVEIRO', 'TIGUAN'
];

export class PdfService {
  /**
   * Extrae líneas de texto preservando la estructura horizontal y vertical de una página PDF.
   * Evita agrupar toda la página en una sola línea.
   */
  private extractLinesFromTextContent(textContent: any): string[] {
    if (!textContent || !Array.isArray(textContent.items)) {
      return [];
    }

    interface TextToken {
      str: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }

    const tokens: TextToken[] = [];
    for (const item of textContent.items) {
      if (item && typeof item.str === 'string') {
        const text = item.str;
        if (text.trim().length === 0) continue;
        const transform = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
        tokens.push({
          str: text,
          x: typeof transform[4] === 'number' ? transform[4] : 0,
          y: typeof transform[5] === 'number' ? transform[5] : 0,
          width: typeof item.width === 'number' ? item.width : 0,
          height: typeof item.height === 'number' ? item.height : 0,
        });
      }
    }

    if (tokens.length === 0) return [];

    // Ordenar de arriba a abajo (en coordenadas PDF, 'y' mayor está más arriba en la página)
    // Para elementos con similar altura 'y', ordenar de izquierda a derecha (x menor primero)
    tokens.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 3.5) {
        return b.y - a.y;
      }
      return a.x - b.x;
    });

    const lines: string[] = [];
    let currentLineTokens: TextToken[] = [];
    let currentLineY: number | null = null;

    for (const token of tokens) {
      if (currentLineY === null) {
        currentLineY = token.y;
        currentLineTokens.push(token);
      } else if (Math.abs(token.y - currentLineY) <= 3.5) {
        currentLineTokens.push(token);
      } else {
        currentLineTokens.sort((a, b) => a.x - b.x);
        const lineText = currentLineTokens.map((t) => t.str).join(' ').replace(/\s+/g, ' ').trim();
        if (lineText) lines.push(lineText);

        currentLineTokens = [token];
        currentLineY = token.y;
      }
    }

    if (currentLineTokens.length > 0) {
      currentLineTokens.sort((a, b) => a.x - b.x);
      const lineText = currentLineTokens.map((t) => t.str).join(' ').replace(/\s+/g, ' ').trim();
      if (lineText) lines.push(lineText);
    }

    return lines;
  }

  /**
   * Identifica encabezados, pies de página o separadores de página que no corresponden a registros de vehículos.
   */
  private isHeaderOrFooter(line: string): boolean {
    const t = line.trim();
    if (!t) return true;
    if (/^---\s*P[AÁ]GINA\s+\d+(\s+DE\s+\d+)?\s*---$/i.test(t)) return true;
    if (/^P[AÁ]GINA\s+\d+(\s+DE\s+\d+)?$/i.test(t)) return true;
    if (/^AUTONET(\s+USADOS(\s+SELECCIONADOS)?)?$/i.test(t)) return true;
    if (/^STOCK(\s+DE)?\s+(UNIDADES\s+)?(DISPONIBLES|USADOS)/i.test(t)) return true;
    if (/^LISTADO?\s+DE\s+(STOCK|PRECIOS|UNIDADES)/i.test(t)) return true;
    // Encabezados de columnas de la tabla
    if (
      /\b(ORDEN|CAT|DOMINIO|PATENTE|A[ÑN]O|KM|KILOMETRAJE|EMPRESA|PRECIO|TOMA)\b/i.test(t) &&
      /\b(MARCA|MODELO|VERSION|UB)\b/i.test(t)
    ) {
      return true;
    }
    return false;
  }

  /**
   * Determina si un texto acumulado ya cuenta con patente y precio válidos (registro completo).
   */
  private hasPriceAndPlate(text: string): boolean {
    const hasPrice = /\b\d{1,3}\.\d{3}\.\d{3}\b|\b\d{7,9}\b/.test(text);
    const hasPlateAndYear = /\b[A-Z0-9]{6,8}\s+(199\d|20[0-2]\d|2030)\b/i.test(text);
    return hasPrice && hasPlateAndYear;
  }

  /**
   * Reconstruye filas fragmentadas de la tabla de Autonet.
   * Maneja casos donde una unidad se divide en 2, 3 o 4 líneas consecutivas.
   */
  private reconstructRecordsFromLines(rawLines: string[]): {
    combinedRecords: { combined: string; lines: string[] }[];
    discardedRecords: DiscardedRecordDetail[];
  } {
    const combinedRecords: { combined: string; lines: string[] }[] = [];
    const discardedRecords: DiscardedRecordDetail[] = [];

    let currentBuffer: string[] = [];

    const flushCurrent = () => {
      if (currentBuffer.length === 0) return;
      const combined = currentBuffer.join(' ').replace(/\s+/g, ' ').trim();
      if (combined.length > 0) {
        combinedRecords.push({
          combined,
          lines: [...currentBuffer],
        });
      }
      currentBuffer = [];
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;
      if (this.isHeaderOrFooter(line)) continue;

      // 1. Verificar si la línea empieza con un número de orden
      const numMatch = line.match(/^(\d{1,3})\b(?:\s+(.*))?$/);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        const rest = (numMatch[2] || '').trim();

        // Caso especial: Tipo (1, 2 o 3) seguido de Patente y Año
        // Ejemplo: "2 AG560PC 2024 AZUL 38.000 IRUÑA 42.000.000"
        // Este patrón indica que NO es un número de orden inicial, sino la continuación de la fila con Tipo + Patente + Año
        const isTipoPatenteYear = (num === 1 || num === 2 || num === 3) && /^[A-Z0-9]{6,8}\s+(199\d|20[0-2]\d|2030)\b/i.test(rest);

        if (isTipoPatenteYear) {
          currentBuffer.push(line);
          continue;
        }

        // Si la línea es únicamente un número aislado (ej: "223")
        if (!rest) {
          if (currentBuffer.length === 0) {
            currentBuffer = [line];
          } else {
            const bufText = currentBuffer.join(' ');
            if (this.hasPriceAndPlate(bufText) || num > 3) {
              flushCurrent();
              currentBuffer = [line];
            } else {
              currentBuffer.push(line);
            }
          }
          continue;
        }

        // Si tiene número de orden y texto posterior (ej: "221 P - T VW TAOS 1.4 HIGHLINE")
        flushCurrent();
        currentBuffer = [line];
        continue;
      }

      // 2. Si no empieza con número: verificar si contiene marca conocida o empieza con Categoría conocida
      const containsBrand = KNOWN_BRANDS.some((b) => b.regex.test(line));
      const startsWithCat = /^((P\s*-\s*)?(C|T|TS|PA|AK|A|FLOTA|0\s*KM)|-\s*(C|T|TS|PA|AK|A|FLOTA))\b/i.test(line);

      if ((containsBrand || startsWithCat) && currentBuffer.length > 0 && this.hasPriceAndPlate(currentBuffer.join(' '))) {
        flushCurrent();
        currentBuffer = [line];
        continue;
      }

      if (currentBuffer.length === 0) {
        currentBuffer = [line];
        continue;
      }

      // 3. De lo contrario, es una línea de continuación de la fila (ej: "P", "A", "-", observaciones, etc.)
      currentBuffer.push(line);
    }

    // Vaciar el último buffer
    flushCurrent();

    return {
      combinedRecords,
      discardedRecords,
    };
  }

  /**
   * Parsea un registro combinado y extrae todos los atributos del vehículo.
   */
  private parseVehicleRecord(
    combined: string,
    rawLines: string[],
    index: number
  ): { vehicle: Partial<Vehicle> | null; discardedReason?: string } {
    const trimmed = combined.trim();
    if (!trimmed || trimmed.length < 10) {
      return { vehicle: null, discardedReason: 'Línea vacía o con contenido insuficiente' };
    }

    // 1. DETECCIÓN DE PATENTE Y AÑO
    // Prioridad 1: Código alfanumérico (6-8 caracteres) inmediatamente anterior al año de 4 dígitos (1990-2030)
    let rawPlate = '';
    let anio = 0;
    let plateMatchIndex = -1;

    // Patrón con patente contigua al año (ej: "AG560PC 2024", "AI029HY 2026", "AD835UE 2023", "RA28489 2021", "HF13759 2020")
    const preYearMatch = trimmed.match(/\b([A-Z0-9]{6,8})\s+(199\d|20[0-2]\d|2030)\b/i);
    if (preYearMatch) {
      rawPlate = preYearMatch[1];
      anio = parseInt(preYearMatch[2], 10);
      plateMatchIndex = preYearMatch.index!;
    } else {
      // Patrón con espacios dentro de la patente (ej: "AG 560 PC 2024" o "ABC 123 2018")
      const spacedPlateMatch = trimmed.match(/\b([A-Z]{2}\s+[0-9]{3}\s+[A-Z]{2}|[A-Z]{3}\s+[0-9]{3})\s+(199\d|20[0-2]\d|2030)\b/i);
      if (spacedPlateMatch) {
        rawPlate = spacedPlateMatch[1];
        anio = parseInt(spacedPlateMatch[2], 10);
        plateMatchIndex = spacedPlateMatch.index!;
      } else {
        // Fallback: buscar patente estándar en cualquier posición
        const genericPlateMatch = trimmed.match(/\b([A-Z]{2}\s?[0-9]{3}\s?[A-Z]{2}|[A-Z]{3}\s?[0-9]{3}|[A-Z]{2}[0-9]{5})\b/i);
        if (genericPlateMatch) {
          rawPlate = genericPlateMatch[1];
          plateMatchIndex = genericPlateMatch.index!;
        }
        const genericYearMatch = trimmed.match(/\b(199\d|20[0-2]\d|2030)\b/);
        if (genericYearMatch) {
          anio = parseInt(genericYearMatch[1], 10);
        }
      }
    }

    const patente = normalizePlate(rawPlate);

    // Validación de patente obligatoria
    if (!patente || patente.length < 5) {
      return { 
        vehicle: null, 
        discardedReason: `No se detectó patente válida en el registro: "${trimmed.slice(0, 70)}..."` 
      };
    }

    // Validación de año obligatorio
    if (!anio || anio < 1990 || anio > 2030) {
      return { 
        vehicle: null, 
        discardedReason: `No se detectó año de fabricación válido para la patente ${patente}` 
      };
    }

    // 2. DETECCIÓN DE PRECIO
    // Precios en listas argentinas: 42.000.000, 35.900.000, 9.800.000, etc.
    const priceMatches = [...trimmed.matchAll(/\b(\d{1,3}(?:\.\d{3}){2,3}|\d{7,9})\b/g)];
    let precio = 0;
    let priceMatchIndex = -1;
    let priceMatchStr = '';

    if (priceMatches.length > 0) {
      // Tomar el último número en los millones que aparezca en la fila
      const lastMatch = priceMatches[priceMatches.length - 1];
      const rawP = lastMatch[1].replace(/\./g, '');
      const p = parseInt(rawP, 10);
      if (p >= 1000000) {
        precio = p;
        priceMatchIndex = lastMatch.index!;
        priceMatchStr = lastMatch[0];
      }
    }

    if (!precio || precio < 1000000) {
      return { 
        vehicle: null, 
        discardedReason: `No se detectó precio de venta válido para la patente ${patente}` 
      };
    }

    // 3. DETECCIÓN DE FECHA DE TOMA (posterior al precio)
    let fechaToma = '-';
    if (priceMatchIndex !== -1) {
      const tailAfterPrice = trimmed.slice(priceMatchIndex + priceMatchStr.length).trim();
      const dateMatch = tailAfterPrice.match(/\b(\d{2}[-/]\d{2}[-/]\d{2,4})\b/);
      if (dateMatch) {
        fechaToma = dateMatch[1];
      } else if (tailAfterPrice.includes('-')) {
        fechaToma = '-';
      }
    }

    // 4. KILOMETRAJE, COLOR Y EMPRESA (segmento intermedio entre Año y Precio)
    let kilometraje = 0;
    let color = 'Consultar';
    let empresa = 'Autonet';

    if (plateMatchIndex !== -1 && priceMatchIndex !== -1) {
      // Tomar el texto entre el año y el precio
      const yearStr = String(anio);
      const yearPos = trimmed.indexOf(yearStr, plateMatchIndex);
      const midStart = yearPos !== -1 ? yearPos + yearStr.length : plateMatchIndex;
      const midText = trimmed.slice(midStart, priceMatchIndex).trim();

      // Kilometraje: número normalizado con soporte para formatos argentinos ("129.000", "49.600", "4.800", "0")
      const kmMatch = midText.match(/\b(\d{1,3}(?:\.\d{3})+|\d{1,6})\b/);
      if (kmMatch) {
        const parsedKm = normalizeMileage(kmMatch[1]);
        if (parsedKm !== null) {
          kilometraje = parsedKm;
        }
      }

      // Color: palabra antes del KM
      const knownColorsRegex = /\b(BLANCO|BLANCA|NEGRO|NEGRA|GRIS\s+PLATA|GRIS\s+OSCURO|GRIS|AZUL|ROJO|ROJA|BORDO|BORDÓ|VERDE|MARRON|MARRÓN|BEIGE|ORO|PLATA|NARANJA|AMARILLO)\b/i;
      const colorMatch = midText.match(knownColorsRegex);
      if (colorMatch) {
        let c = colorMatch[1].trim();
        c = c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
        if (c.toLowerCase() === 'blanca') c = 'Blanco';
        if (c.toLowerCase() === 'roja') c = 'Rojo';
        if (c.toLowerCase() === 'negra') c = 'Negro';
        if (c.toLowerCase() === 'bordo') c = 'Bordó';
        color = c;
      }

      // Empresa / Concesionario: IRUÑA, MIRAGE, AKIRA, OIL BULL, AUTONET
      const empresaMatch = midText.match(/\b(OIL\s+BULL|MIRAGE|IRUÑA|AKIRA|AUTONET)\b/i);
      if (empresaMatch) {
        empresa = empresaMatch[1].toUpperCase().trim();
      }
    }

    // 5. CABECERA (izquierda de la patente): Orden, Categoría/Prefijo, Marca, Modelo, Versión, Observaciones, Ubicación, Tipo
    const headText = trimmed.slice(0, plateMatchIndex).trim();

    // Número de orden
    let numOrden = index + 1;
    let cleanHead = headText;
    const orderMatch = cleanHead.match(/^\s*(\d{1,3})\b/);
    if (orderMatch) {
      numOrden = parseInt(orderMatch[1], 10);
      cleanHead = cleanHead.slice(orderMatch[0].length).trim();
    }

    // Ubicación (Ub) y Tipo (1, 2, 3) que se encuentran hacia el final de cleanHead
    let ub = 'Neuquén';
    const ubTipoMatch = cleanHead.match(/\s+([A-Z0-9]{1,10})\s+([123])$/i);
    if (ubTipoMatch) {
      ub = ubTipoMatch[1].trim().toUpperCase();
      cleanHead = cleanHead.slice(0, cleanHead.length - ubTipoMatch[0].length).trim();
    } else {
      const ubMatch = cleanHead.match(/\s+([PAS]|GR|SOLALIQUE|FINAN)$/i);
      if (ubMatch) {
        ub = ubMatch[1].trim().toUpperCase();
        cleanHead = cleanHead.slice(0, cleanHead.length - ubMatch[0].length).trim();
      }
    }

    // Observaciones dentro de la cabecera (Sección 9)
    let observaciones = '';
    const obsRegex = /(UNIDAD\s+CON\s+PRENDA\s+NO\s+VENDER|NO\s+VENDER\s+EN\s+TRAMITE\s+CON\s+DEMORA|NO\s+VENDER\s+UNIDAD\s+PRENDADA|CANCELACION\s+DE\s+PRENDA\s+EN\s+PROCE[SG]O|NO\s+VENDER|PRENDA|RESERVAD[OA]?|USADO\s+SELECCIONADO)/i;
    const obsMatch = cleanHead.match(obsRegex);
    if (obsMatch) {
      observaciones = obsMatch[1].trim().toUpperCase();
      cleanHead = cleanHead.replace(obsMatch[0], '').replace(/\s*-\s*/g, ' ').trim();
    }

    // Detección robusta de Marca (evitando prefijos como "P - C", "- TS", "- PA", "AK", "P - T", etc.)
    // Buscamos la marca en cualquier posición dentro de cleanHead
    let bestBrandMatch: { brand: string; index: number; length: number; standard: string } | null = null;
    let earliestBrandIndex = Infinity;

    for (const b of KNOWN_BRANDS) {
      const m = cleanHead.match(b.regex);
      if (m && m.index !== undefined && m.index < earliestBrandIndex) {
        earliestBrandIndex = m.index;
        bestBrandMatch = {
          brand: m[0],
          index: m.index,
          length: m[0].length,
          standard: b.standard,
        };
      }
    }

    if (!bestBrandMatch) {
      return {
        vehicle: null,
        discardedReason: `No se detectó una marca automotriz válida en cabecera: "${cleanHead.slice(0, 45)}...". "Autonet" no es marca de vehículo.`
      };
    }

    const marca = bestBrandMatch.standard;
    const prefixPart = cleanHead.slice(0, bestBrandMatch.index).trim();
    const afterBrandPart = cleanHead.slice(bestBrandMatch.index + bestBrandMatch.length).trim();

    // Categoría / Condición de origen extraída de los prefijos previos a la marca (ej: "P - C", "- TS", "PA", "T")
    let categoria = prefixPart.replace(/^[-_\s]+|[-_\s]+$/g, '').trim();

    // Modelo y Versión extraídos a partir de lo que sigue a la marca
    let modelo = '';
    let version = afterBrandPart;

    for (const km of KNOWN_MODELS) {
      const kmRegex = new RegExp(`^${km}\\b`, 'i');
      if (kmRegex.test(afterBrandPart)) {
        modelo = km;
        version = afterBrandPart.slice(km.length).trim();
        break;
      }
    }

    if (!modelo) {
      const parts = afterBrandPart.split(/\s+/);
      modelo = parts[0] || '';
      version = parts.slice(1).join(' ') || '';
    }

    // Normalizar modelo y versión
    modelo = modelo.replace(/^[-_\s]+|[-_\s]+$/g, '').trim();
    version = version.replace(/^[-_\s]+|[-_\s]+$/g, '').trim();
    if (!version) version = 'Estándar';

    // VALIDACIÓN ESTRICTA DE CALIDAD DEL REGISTRO (Sección 7 y 9)
    if (!marca || marca.toLowerCase() === 'autonet') {
      return { vehicle: null, discardedReason: `Marca inválida o sospechosa ("${marca}") en: "${trimmed.slice(0, 40)}..."` };
    }
    if (!modelo || modelo === 'P' || modelo.startsWith('-')) {
      return { vehicle: null, discardedReason: `Modelo desplazado o inválido ("${modelo}") en: "${trimmed.slice(0, 40)}..."` };
    }
    const cleanPlate = normalizePlate(patente);
    if (!cleanPlate || cleanPlate.length < 5) {
      return { vehicle: null, discardedReason: `Patente inválida o ausente ("${patente}") en: "${trimmed.slice(0, 40)}..."` };
    }
    if (!anio || anio < 1990 || anio > 2030) {
      return { vehicle: null, discardedReason: `Año fuera de rango (${anio}) en: "${trimmed.slice(0, 40)}..."` };
    }
    if (!precio || precio <= 0 || isNaN(precio)) {
      return { vehicle: null, discardedReason: `Precio inválido ($ ${precio}) en: "${trimmed.slice(0, 40)}..."` };
    }
    if (kilometraje === null || isNaN(kilometraje) || kilometraje < 0) {
      return { vehicle: null, discardedReason: `Kilometraje inválido (${kilometraje}) en: "${trimmed.slice(0, 40)}..."` };
    }

    // Combustible
    let combustible: VehicleFuel = 'Nafta';
    if (
      /\b(TDI|DIESEL|2\.8\s*4X4|2\.2\s*MT|V6)\b/i.test(version) ||
      /AMAROK/i.test(modelo) ||
      /HILUX/i.test(modelo) ||
      /S 10/i.test(modelo) ||
      /RANGER.*2\.2/i.test(afterBrandPart)
    ) {
      combustible = 'Diésel';
    } else if (/\b(HIBRID|HYBRID|HYBRIDA|E TECH)\b/i.test(version + ' ' + afterBrandPart)) {
      combustible = 'Híbrido';
    }

    // Transmisión
    let caja: VehicleTransmission = 'Manual';
    if (/\b(AT|CVT|AUTOMATICA|TIPTRONIC|CVT\s*PRO)\b/i.test(version + ' ' + afterBrandPart)) {
      caja = 'Automática';
    }

    // Tracción
    let traccion: VehicleTraction = '4x2';
    if (/\b(4X4|4WD|AWD)\b/i.test(version + ' ' + afterBrandPart)) {
      traccion = '4x4';
    }

    // Estado interno inicial
    let estado: VehicleStatus = 'Disponible';
    if (/NO VENDER|PRENDA|RESERVAD/i.test(observaciones)) {
      estado = 'Reservado';
    }

    const obsList: string[] = [];
    if (observaciones) obsList.push(`Observación: ${observaciones}`);
    if (categoria) obsList.push(`Origen: ${categoria}`);
    if (empresa) obsList.push(`Concesionario: ${empresa}`);
    if (ub && ub !== 'Neuquén') {
      const ubicacionNombre = 
        ub === 'A' ? 'Allen / Sucursal A' : 
        ub === 'P' ? 'Plottier' : 
        ub === 'S' ? 'Neuquén Salón' : 
        ub === 'GR' ? 'General Roca' : ub;
      obsList.push(`Ubicación: ${ubicacionNombre}`);
    }
    if (fechaToma && fechaToma !== '-') obsList.push(`Fecha toma: ${fechaToma}`);

    const vehicle: Partial<Vehicle> = {
      id: `AUT-${String(numOrden).padStart(3, '0')}`,
      numeroOrden: numOrden,
      marca,
      modelo,
      version: version || 'Estándar',
      anio,
      color,
      kilometraje,
      precio,
      moneda: 'ARS',
      patente,
      combustible,
      caja,
      traccion,
      estado,
      observaciones: obsList.join(' | '),
      ubicacion: ub,
      empresa,
      fechaToma,
      categoriaOrigen: categoria,
      fotoPrincipal: '',
      fotos: [],
      sincronizadoAutonetWeb: false,
      origenDato: 'autonet_pdf',
    };

    return { vehicle };
  }

  /**
   * Procesa un array de líneas crudas extraídas del documento PDF,
   * reconstruye filas fragmentadas y genera las estadísticas de diagnóstico.
   */
  public processLinesIntoVehicles(
    rawLines: string[],
    pageCount: number
  ): {
    vehicles: Partial<Vehicle>[];
    diagnostics: ParsingDiagnostics;
  } {
    const { combinedRecords, discardedRecords } = this.reconstructRecordsFromLines(rawLines);
    const validVehicles: Partial<Vehicle>[] = [];
    const seenPlates = new Set<string>();

    combinedRecords.forEach((item, idx) => {
      const { vehicle, discardedReason } = this.parseVehicleRecord(item.combined, item.lines, idx);
      if (vehicle && vehicle.patente) {
        const key = normalizePlate(vehicle.patente);
        if (!seenPlates.has(key)) {
          seenPlates.add(key);
          validVehicles.push(vehicle);
        } else {
          discardedRecords.push({
            raw: item.combined,
            reason: `Patente duplicada en el archivo (${key})`,
          });
        }
      } else {
        discardedRecords.push({
          raw: item.combined,
          reason: discardedReason || 'Registro incompleto o con datos faltantes',
        });
      }
    });

    const diagnostics: ParsingDiagnostics = {
      pageCount,
      linesExtracted: rawLines.length,
      recordsReconstructed: combinedRecords.length,
      validRecords: validVehicles.length,
      discardedRecords: discardedRecords.length,
      discardedDetails: discardedRecords,
    };

    return {
      vehicles: validVehicles,
      diagnostics,
    };
  }

  /**
   * Extrae texto crudo y detecta vehículos preliminares de cualquier archivo PDF cargado.
   * Procesa la totalidad de las páginas (7 páginas en listas de Autonet) sin omitir fragmentos.
   */
  public async extractFromPdfFile(file: File): Promise<ParsePdfResult> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let allLines: string[] = [];
      let fullText = '';
      const warnings: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageLines = this.extractLinesFromTextContent(textContent);
          allLines = allLines.concat(pageLines);
          fullText += `\n--- PÁGINA ${i} ---\n` + pageLines.join('\n');
        } catch (err: any) {
          warnings.push(`No se pudo leer el texto de la página ${i}: ${err?.message || ''}`);
        }
      }

      const { vehicles, diagnostics } = this.processLinesIntoVehicles(allLines, pdf.numPages);

      return {
        fileName: file.name,
        fileSize: file.size,
        pageCount: pdf.numPages,
        rawText: fullText,
        extractedVehicles: vehicles,
        parseWarnings: warnings,
        diagnostics,
      };
    } catch (err: any) {
      console.error('Error al procesar archivo PDF:', err);
      const emptyDiag: ParsingDiagnostics = {
        pageCount: 0,
        linesExtracted: 0,
        recordsReconstructed: 0,
        validRecords: 0,
        discardedRecords: 0,
        discardedDetails: [{ raw: '', reason: `Error al abrir el PDF: ${err?.message || 'Archivo dañado o protegido'}` }],
      };
      return {
        fileName: file.name,
        fileSize: file.size,
        pageCount: 0,
        rawText: '',
        extractedVehicles: [],
        parseWarnings: [`Error al procesar el archivo PDF: ${err?.message || 'Formato no legible'}`],
        diagnostics: emptyDiag,
      };
    }
  }

  /**
   * Permite procesar texto copiado o extraído directamente del PDF.
   */
  public extractFromText(rawText: string, fileName: string = 'Texto_PDF.txt'): ParsePdfResult {
    const rawLines = rawText.split(/[\r\n]+/);
    const { vehicles, diagnostics } = this.processLinesIntoVehicles(rawLines, 1);

    return {
      fileName,
      fileSize: rawText.length,
      pageCount: 1,
      rawText,
      extractedVehicles: vehicles,
      parseWarnings: [],
      diagnostics,
    };
  }

  /**
   * Extrae vehículos directamente de texto crudo (compatibilidad con llamadas existentes).
   */
  public extractVehiclesFromRawText(rawText: string): Partial<Vehicle>[] {
    const rawLines = rawText.split(/[\r\n]+/);
    const { vehicles } = this.processLinesIntoVehicles(rawLines, 1);
    return vehicles;
  }

  /**
   * Enriquece datos con la web de Autonet si la unidad existe en autonet.com.ar.
   */
  public async enrichVehiclesWithAutonetWeb(
    extractedList: Partial<Vehicle>[],
    onProgress?: (current: number, total: number, lastPlate: string) => void
  ): Promise<{
    enrichedList: Partial<Vehicle>[];
    webMatchedCount: number;
    pdfOnlyCount: number;
  }> {
    let webMatchedCount = 0;
    let pdfOnlyCount = 0;
    const nowIso = new Date().toISOString();
    const enrichedList: Partial<Vehicle>[] = [];
    const total = extractedList.length;

    for (let i = 0; i < total; i++) {
      const v = extractedList[i];
      const copy: Partial<Vehicle> = { ...v };
      const cleanPlate = normalizePlate(copy.patente);

      if (onProgress) {
        onProgress(i + 1, total, cleanPlate || copy.modelo || '');
      }

      if (cleanPlate) {
        try {
          const webDetails = await autonetService.fetchVehicleDetailsByPatente(cleanPlate);

          if (webDetails && (webDetails.urlAutonetOriginal || webDetails.precioPublicadoWeb)) {
            webMatchedCount++;
            copy.fotoPrincipal = '';
            copy.fotos = [];
            copy.urlAutonetOriginal = webDetails.urlAutonetOriginal;
            copy.precioPublicadoWeb = webDetails.precioPublicadoWeb;
            copy.sincronizadoAutonetWeb = true;
            copy.autonetWebId = webDetails.autonetId;
            copy.fechaSincronizacionWeb = nowIso;
            if (webDetails.description && !copy.descripcionWeb) {
              copy.descripcionWeb = webDetails.description;
            }
          } else {
            pdfOnlyCount++;
            copy.fotoPrincipal = '';
            copy.fotos = [];
            copy.sincronizadoAutonetWeb = false;
            copy.precioPublicadoWeb = undefined;
            copy.urlAutonetOriginal = undefined;
          }
        } catch {
          pdfOnlyCount++;
          copy.fotoPrincipal = '';
          copy.fotos = [];
          copy.sincronizadoAutonetWeb = false;
        }
      } else {
        pdfOnlyCount++;
        copy.fotoPrincipal = '';
        copy.fotos = [];
        copy.sincronizadoAutonetWeb = false;
      }

      enrichedList.push(copy);
    }

    return {
      enrichedList,
      webMatchedCount,
      pdfOnlyCount,
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
      currentMap.set(key, v);
    });

    const incomingKeys = new Set<string>();
    const diffItems: VehicleDiffItem[] = [];

    let nuevosCount = 0;
    let modificadosCount = 0;
    let sinCambiosCount = 0;
    let cambiosPrecioCount = 0;

    // 1. Analizar los vehículos entrantes
    extractedList.forEach((incoming) => {
      const key = generateVehicleKey(incoming);
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

        // Estado (Verificar protección de "Vendido" manual)
        let advertenciaEstado: string | undefined;
        if (existing.estado === 'Vendido' && existing.estadoModificadoManualmente) {
          advertenciaEstado = 'Vehículo marcado manualmente como VENDIDO por el asesor comercial. Se mantendrá VENDIDO protegiendo la venta.';
        }

        if (changes.length > 0) {
          modificadosCount++;
          diffItems.push({
            patente: existing.patente,
            marcaModelo: `${existing.marca} ${existing.modelo} ${existing.version}`,
            tipo: 'modificado',
            cambios: changes,
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
      if (!incomingKeys.has(key)) {
        noAparecenCount++;
        diffItems.push({
          patente: existing.patente,
          marcaModelo: `${existing.marca} ${existing.modelo} ${existing.version}`,
          tipo: 'no_aparece',
          vehiculoExistente: existing,
          advertenciaEstado: existing.estado === 'Vendido' 
            ? 'Ya estaba marcado como Vendido.' 
            : 'No figura en la nueva lista de Autonet. Podría haber sido vendido o retirado.',
        });
      }
    });

    // 3. VALIDACIONES DE SEGURIDAD Y BLOQUEO DE CONFIRMACIÓN (Secciones 3 y 13)
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

    return {
      archivoNombre: fileName,
      totalEncontrados: extractedCount,
      nuevos: nuevosCount,
      modificados: modificadosCount,
      sinCambios: sinCambiosCount,
      noAparecen: noAparecenCount,
      cambiosPrecio: cambiosPrecioCount,
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
