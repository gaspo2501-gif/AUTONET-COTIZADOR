import * as pdfjsLib from 'pdfjs-dist';
import { 
  DiffResult, 
  FieldChange, 
  Vehicle, 
  VehicleDiffItem,
  VehicleFuel,
  VehicleTransmission,
  VehicleTraction,
  VehicleStatus
} from '../types/stock';
import { autonetService } from './autonetService';

// Configure pdfjs worker if in browser
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('pdfjs worker initialization error:', e);
  }
}

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
}

/**
 * Normaliza una patente argentina eliminando espacios y guiones y llevándola a mayúsculas.
 * Soporta formato Mercosur (AA 123 BB / AF 892 PL) y formato previo (ABC 123).
 */
export function normalizePatente(patente?: string): string {
  if (!patente) return '';
  return patente.replace(/[\s\-_.]+/g, '').toUpperCase().trim();
}

/**
 * Genera una clave única para un vehículo si no tiene patente explícita.
 */
export function generateVehicleKey(v: Partial<Vehicle>): string {
  if (v.patente && v.patente.trim()) {
    return normalizePatente(v.patente);
  }
  const marca = (v.marca || '').toLowerCase().trim();
  const modelo = (v.modelo || '').toLowerCase().trim();
  const anio = v.anio || '';
  const version = (v.version || '').toLowerCase().trim();
  return `key_${marca}_${modelo}_${anio}_${version}`.replace(/\s+/g, '_');
}

export class PdfService {
  /**
   * Extrae texto crudo y detecta vehículos preliminares de cualquier archivo PDF cargado.
   * Diseñado de manera tolerante para que no falle con ningún PDF.
   */
  public async extractFromPdfFile(file: File): Promise<ParsePdfResult> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      const warnings: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str || '')
            .join(' ');
          fullText += `\n--- PÁGINA ${i} ---\n` + pageText;
        } catch (err) {
          warnings.push(`No se pudo leer el texto de la página ${i}`);
        }
      }

      const extractedVehicles = this.extractVehiclesFromRawText(fullText);

      return {
        fileName: file.name,
        fileSize: file.size,
        pageCount: pdf.numPages,
        rawText: fullText,
        extractedVehicles,
        parseWarnings: warnings,
      };
    } catch (err: any) {
      console.error('Error al procesar archivo PDF:', err);
      return {
        fileName: file.name,
        fileSize: file.size,
        pageCount: 1,
        rawText: '',
        extractedVehicles: [],
        parseWarnings: [`Error al procesar el archivo PDF: ${err?.message || 'Formato o permisos no legibles'}. También puede utilizar la opción de pegar texto copiado del PDF.`],
      };
    }
  }

  /**
   * Permite procesar texto copiado o extraído directamente del PDF.
   */
  public extractFromText(rawText: string, fileName: string = 'Texto_PDF.txt'): ParsePdfResult {
    const extractedVehicles = this.extractVehiclesFromRawText(rawText);
    return {
      fileName,
      fileSize: rawText.length,
      pageCount: 1,
      rawText,
      extractedVehicles,
      parseWarnings: [],
    };
  }

  /**
   * Parsea una línea con el formato tabular oficial de las listas de stock de Autonet:
   * [Orden] [Cat/Origen] [Marca] [Modelo] [Versión] [Ub] [Tipo] [Patente] [Año] [Color] [KM] [Empresa] [Precio] [FechaToma]
   */
  public parseAutonetLine(line: string, index: number): Partial<Vehicle> | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 15) return null;

    // Tail regex para capturar las columnas finales estructuradas
    const tailRegex = /\s+([A-Z0-9]+)\s+([123])\s+([A-Z0-9]{6,8})\s+(20\d{2})\s+([A-ZÁÉÍÓÚÑ]+)\s+([\d\.]+)\s+(OIL\s+BULL|MIRAGE|IRUÑA|AKIRA|[A-Z\s]+?)\s+([\d\.]+)\s+([\d\/\.\-]+)$/i;
    const tailMatch = trimmed.match(tailRegex);

    if (!tailMatch) {
      return null;
    }

    const ub = tailMatch[1].trim();
    const patente = tailMatch[3].trim().toUpperCase();
    const anio = parseInt(tailMatch[4], 10);
    const rawColor = tailMatch[5].trim();
    const rawKm = tailMatch[6].replace(/\./g, '');
    const kilometraje = parseInt(rawKm, 10) || 0;
    const empresa = tailMatch[7].trim();
    const rawPrecio = tailMatch[8].replace(/\./g, '');
    const precio = parseInt(rawPrecio, 10) || 0;
    const fechaToma = tailMatch[9].trim();

    // Resto del texto hacia la izquierda (número de orden, categoría, marca, modelo, versión)
    const head = trimmed.slice(0, trimmed.length - tailMatch[0].length).trim();

    // Extraer número de orden inicial
    const orderMatch = head.match(/^\s*(\d+)\s+/);
    let numOrden = index + 1;
    let desc = head;
    if (orderMatch) {
      numOrden = parseInt(orderMatch[1], 10);
      desc = head.slice(orderMatch[0].length).trim();
    }

    // Extraer categoría / condición de origen (ej: P - PA 0 KM, 0 KM, P - A, AK, T, C, A, PA, TS)
    const catRegex = /^(P\s*-\s*PA\s*0\s*KM|0\s*KM|P\s*-\s*A|AK|T|C|A|PA|TS|FLOTA)\s+/i;
    const catMatch = desc.match(catRegex);
    let categoria = '';
    let cleanDesc = desc;
    if (catMatch) {
      categoria = catMatch[1].trim();
      cleanDesc = desc.slice(catMatch[0].length).trim();
    }

    // Extraer notas de estado u observaciones insertadas en el modelo
    let observaciones = '';
    if (cleanDesc.includes('-')) {
      const parts = cleanDesc.split('-');
      if (parts.length > 1) {
        const potentialNote = parts.slice(1).join('-').trim();
        if (/NO VENDER|PRENDA|RESERVAD|USADO|ENTREGA/i.test(potentialNote)) {
          observaciones = potentialNote;
          cleanDesc = parts[0].trim();
        }
      }
    }

    const knownBrands = [
      'CHERY', 'CHEVROLET', 'CITROEN', 'CITROËN', 'FIAT', 'FORD',
      'HONDA', 'HYUNDAI', 'JEEP', 'KIA', 'NISSAN',
      'PEUGEOT', 'RENAULT', 'TOYOTA', 'VW', 'VOLKSWAGEN', 'AUDI', 'BMW', 'MERCEDES-BENZ', 'RAM'
    ];

    let marca = 'Autonet';
    let modeloYVersion = cleanDesc;

    for (const b of knownBrands) {
      const bRegex = new RegExp(`^${b}\\b`, 'i');
      if (bRegex.test(cleanDesc)) {
        marca = b === 'VW' ? 'Volkswagen' : b.charAt(0) + b.slice(1).toLowerCase();
        modeloYVersion = cleanDesc.slice(b.length).trim();
        break;
      }
    }

    const knownModels = [
      'COROLLA CROSS', 'C3 AIRCROSS', 'C4 CACTUS', 'DUSTER OROCH', 'SANDERO STEPWAY',
      'GOL TREND', 'T CROSS', 'TIGGO 4', 'S 10', 'FOX CROSSFOX',
      'CRUZE', 'ONIX', 'PRISMA', 'SPIN', 'TRACKER', 'BERLINGO', 'C3',
      'ARGO', 'CRONOS', 'FASTBACK', 'PALIO', 'PULSE',
      'ECOSPORT', 'FIESTA', 'FOCUS', 'KA', 'KUGA', 'MAVERICK', 'RANGER', 'TERRITORY',
      'HRV', 'WRV', 'CRETA', 'COMPASS', 'PATRIOT', 'SOUL', 'KICKS', 'NOTE', 'SENTRA',
      '2008', '208', 'ARKANA', 'CAPTUR', 'DUSTER', 'FLUENCE', 'KARDIAN', 'KWID', 'LOGAN', 'SANDERO',
      'COROLLA', 'ETIOS', 'HILUX', 'YARIS',
      'AMAROK', 'GOLF', 'NIVUS', 'POLO', 'SURAN', 'TAOS', 'TERA', 'UP', 'VENTO', 'VIRTUS'
    ];

    let modelo = '';
    let version = modeloYVersion;

    for (const km of knownModels) {
      const kmRegex = new RegExp(`^${km}\\b`, 'i');
      if (kmRegex.test(modeloYVersion)) {
        modelo = km;
        version = modeloYVersion.slice(km.length).trim();
        break;
      }
    }

    if (!modelo) {
      const parts = modeloYVersion.split(' ');
      modelo = parts[0] || 'Modelo';
      version = parts.slice(1).join(' ') || '';
    }

    let combustible: VehicleFuel = 'Nafta';
    if (/\b(TDI|DIESEL|2\.8\s*4X4|2\.2\s*MT|V6)\b/i.test(version) || /AMAROK/i.test(modelo) || /HILUX/i.test(modelo) || /S 10/i.test(modelo) || /RANGER.*2\.2/i.test(cleanDesc)) {
      combustible = 'Diésel';
    } else if (/\b(HIBRID|HYBRID|HYBRIDA|E TECH)\b/i.test(version + ' ' + cleanDesc)) {
      combustible = 'Híbrido';
    }

    let caja: VehicleTransmission = 'Manual';
    if (/\b(AT|CVT|AUTOMATICA|TIPTRONIC|CVT\s*PRO)\b/i.test(version + ' ' + cleanDesc)) {
      caja = 'Automática';
    }

    let traccion: VehicleTraction = '4x2';
    if (/\b(4X4|4WD|AWD)\b/i.test(version + ' ' + cleanDesc)) {
      traccion = '4x4';
    }

    let colorNorm = rawColor.charAt(0) + rawColor.slice(1).toLowerCase();
    if (colorNorm === 'Bordo') colorNorm = 'Bordó';
    if (colorNorm === 'Blanca') colorNorm = 'Blanco';

    let estado: VehicleStatus = 'Disponible';
    if (/NO VENDER/i.test(observaciones)) {
      estado = 'Reservado';
    }

    const obsList: string[] = [];
    if (observaciones) obsList.push(`Observación: ${observaciones}`);
    if (categoria) obsList.push(`Origen: ${categoria}`);
    if (empresa) obsList.push(`Concesionario: ${empresa}`);
    if (ub) {
      const ubicacionNombre = ub === 'A' ? 'Allen / Sucursal A' : ub === 'P' ? 'Plottier' : ub === 'S' ? 'Neuquén Salón' : ub === 'GR' ? 'General Roca' : ub;
      obsList.push(`Ubicación: ${ubicacionNombre}`);
    }
    if (fechaToma && fechaToma !== '-') obsList.push(`Fecha toma: ${fechaToma}`);

    return {
      id: `AUT-${String(numOrden).padStart(3, '0')}`,
      numeroOrden: numOrden,
      marca,
      modelo,
      version: version || 'Estándar',
      anio,
      color: colorNorm,
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
  }

  /**
   * Extrae vehículos de texto reconociendo el formato oficial de Autonet y formatos generales.
   */
  public extractVehiclesFromRawText(rawText: string): Partial<Vehicle>[] {
    const lines = rawText.split(/[\r\n]+/);
    const results: Partial<Vehicle>[] = [];
    const seenPlates = new Set<string>();

    const knownBrands = [
      'Volkswagen', 'Toyota', 'Peugeot', 'Ford', 'Chevrolet', 'Jeep', 
      'Fiat', 'Renault', 'Nissan', 'Honda', 'Citroën', 'Audi', 'BMW', 'Mercedes-Benz', 'RAM', 'Chery'
    ];
    const patenteRegex = /\b([A-Z]{2}\s?[0-9]{3}\s?[A-Z]{2}|[A-Z]{3}\s?[0-9]{3})\b/g;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 5) return;

      // 1. Intentar parser oficial de línea de Autonet
      const autonetParsed = this.parseAutonetLine(trimmed, idx);
      if (autonetParsed && autonetParsed.patente) {
        const cleanPlate = normalizePatente(autonetParsed.patente);
        if (!seenPlates.has(cleanPlate)) {
          seenPlates.add(cleanPlate);
          results.push(autonetParsed);
          return;
        }
      }

      // 2. Parser heurístico de respaldo (si la línea está formateada de otra manera)
      const patMatches = trimmed.match(patenteRegex);
      const foundBrand = knownBrands.find((b) =>
        new RegExp(`\\b${b}\\b`, 'i').test(trimmed)
      );

      if (patMatches || foundBrand) {
        const patente = patMatches ? patMatches[0].replace(/\s+/g, '').toUpperCase() : undefined;
        if (patente && seenPlates.has(patente)) return;

        const yearMatch = trimmed.match(/\b(201[0-9]|202[0-6])\b/);
        const anio = yearMatch ? parseInt(yearMatch[0], 10) : 2022;

        const priceMatch = trimmed.match(/\$?\s?([0-9]{1,3}(?:\.[0-9]{3})+(?:,[0-9]{2})?|\b[0-9]{7,9}\b)/);
        let precio: number | undefined;
        if (priceMatch) {
          const numStr = priceMatch[1].replace(/\./g, '').replace(',', '.');
          const p = parseFloat(numStr);
          if (p > 1000000) precio = p;
        }

        const kmMatch = trimmed.match(/\b([0-9]{1,3}(?:\.[0-9]{3})*|[0-9]{2,6})\s*(?:km|kms|kilometros)?\b/i);
        let km: number | undefined;
        if (kmMatch) {
          km = parseInt(kmMatch[1].replace(/\./g, ''), 10);
        }

        let modelo = 'Modelo por verificar';
        let version = '';
        if (foundBrand) {
          const parts = trimmed.split(new RegExp(foundBrand, 'i'))[1] || '';
          const subTokens = parts.trim().split(/\s+/).slice(0, 3);
          if (subTokens.length > 0) {
            modelo = subTokens[0];
            version = subTokens.slice(1).join(' ');
          }
        }

        if (patente || (foundBrand && anio)) {
          const finalPlate = patente || `S/P-${Math.floor(1000 + Math.random() * 9000)}`;
          seenPlates.add(finalPlate);
          results.push({
            id: `PDF-${idx + 1}`,
            patente: finalPlate,
            marca: foundBrand || 'Por determinar',
            modelo: modelo || 'Por verificar',
            version: version || '',
            anio,
            precio: precio || 25000000,
            kilometraje: km || 45000,
            color: 'Consultar',
            combustible: 'Nafta',
            caja: 'Manual',
            traccion: '4x2',
            estado: 'Disponible',
            observaciones: `Registro extraído de lista PDF: "${trimmed.slice(0, 100)}"`,
            origenDato: 'autonet_pdf',
            fotoPrincipal: '',
            fotos: [],
            sincronizadoAutonetWeb: false,
          });
        }
      }
    });

    return results;
  }

  /**
   * REGLA FUNDAMENTAL DE LA APLICACIÓN:
   * "si hay info en la pagina de autonet que la extraiga y sino que se quede solo con la info del listado en pdf ya que es este ultimo quien debe regir toda la app"
   *
   * Consulta la web oficial de Autonet para cada patente extraída del PDF:
   * - Si existe en Autonet: enriquece con fotos oficiales de alta calidad, link de publicación y precio web publicado.
   * - Si NO existe en Autonet: se mantiene estrictamente con la información del PDF, sin fotos artificiales ni enlaces ficticios.
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
      const cleanPlate = normalizePatente(copy.patente);

      if (onProgress) {
        onProgress(i + 1, total, cleanPlate || copy.modelo || '');
      }

      if (cleanPlate) {
        try {
          const webDetails = await autonetService.fetchVehicleDetailsByPatente(cleanPlate);

          if (webDetails && (webDetails.fotoPrincipal || (webDetails.fotos && webDetails.fotos.length > 0) || webDetails.urlAutonetOriginal)) {
            webMatchedCount++;
            copy.fotoPrincipal = webDetails.fotoPrincipal || (webDetails.fotos && webDetails.fotos[0]) || '';
            copy.fotos = webDetails.fotos || (webDetails.fotoPrincipal ? [webDetails.fotoPrincipal] : []);
            copy.urlAutonetOriginal = webDetails.urlAutonetOriginal;
            copy.precioPublicadoWeb = webDetails.precioPublicadoWeb;
            copy.sincronizadoAutonetWeb = true;
            copy.autonetWebId = webDetails.autonetId;
            copy.fechaSincronizacionWeb = nowIso;
            if (webDetails.description && !copy.descripcionWeb) {
              copy.descripcionWeb = webDetails.description;
            }
          } else {
            // NO se encuentra en la web oficial: se conserva estrictamente la información del PDF
            pdfOnlyCount++;
            copy.fotoPrincipal = '';
            copy.fotos = [];
            copy.sincronizadoAutonetWeb = false;
            copy.precioPublicadoWeb = undefined;
            copy.urlAutonetOriginal = undefined;
          }
        } catch {
          // Si ocurre un error de red, el PDF rige por defecto
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
   * Compara los vehículos extraídos de una nueva lista contra el stock actual de la base de datos.
   * Detecta:
   * - Nuevos ingresos
   * - Modificados (con detalle de qué campos cambiaron: precio, km, observaciones, etc.)
   * - Sin cambios
   * - Vehículos que ya no aparecen en la lista (posiblemente vendidos por Autonet)
   * - Conserva la regla de oro: si un vehículo fue marcado 'Vendido' internamente por el asesor, NO se resucita a 'Disponible'.
   */
  public compareWithStock(
    extractedList: Partial<Vehicle>[],
    currentStock: Vehicle[],
    fileName: string = 'Lista_Stock.pdf'
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
        // Vehículo nuevo
        nuevosCount++;
        diffItems.push({
          patente: incoming.patente || 'S/P',
          marcaModelo: `${incoming.marca || ''} ${incoming.modelo || ''} ${incoming.version || ''}`.trim(),
          tipo: 'nuevo',
          vehiculoNuevo: incoming,
        });
      } else {
        // Vehículo existente: comparar campos
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

        // Kilometraje
        if (incoming.kilometraje !== undefined && incoming.kilometraje !== existing.kilometraje) {
          changes.push({
            campo: 'kilometraje',
            etiqueta: 'Kilometraje',
            valorAnterior: existing.kilometraje,
            valorNuevo: incoming.kilometraje,
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
            : 'No figura en la nueva lista de Autonet. Podría haber sido vendido por otra sucursal o retirado.',
        });
      }
    });

    return {
      archivoNombre: fileName,
      totalEncontrados: extractedList.length,
      nuevos: nuevosCount,
      modificados: modificadosCount,
      sinCambios: sinCambiosCount,
      noAparecen: noAparecenCount,
      cambiosPrecio: cambiosPrecioCount,
      items: diffItems,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Genera un lote de prueba simulado realista para que el asesor pueda probar la experiencia completa
   * de previsualización, tabla de diferencias y confirmación sin esperar a tener el PDF definitivo en mano.
   */
  public generateSimulatedBatch(currentStock: Vehicle[], scenario: 'quincenal' | 'cambio_precios' | 'ingresos_masivos'): Partial<Vehicle>[] {
    // Tomar la mayoría de los vehículos existentes para simular continuidad
    const base: Partial<Vehicle>[] = currentStock.map((v) => ({ ...v }));

    if (scenario === 'quincenal') {
      // 1. Quitar el último vehículo para simular que ya no aparece
      if (base.length > 3) {
        base.pop();
      }

      // 2. Modificar el precio de 2 vehículos (ej. actualizar por inflación/mercado)
      if (base[0]) {
        base[0].precio = (base[0].precio || 30000000) + 1200000;
        base[0].kilometraje = (base[0].kilometraje || 20000) + 1500;
      }
      if (base[1]) {
        base[1].precio = (base[1].precio || 40000000) - 800000; // Ajuste competitivo
      }

      // 3. Agregar 2 nuevos vehículos ingresados a stock
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
        observaciones: 'Nuevo ingreso Autonet. Techo solar panorámico, frenado autónomo de emergencia con detector de peatones y alerta de colisión frontal.',
        fotoPrincipal: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80',
        fotos: ['https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80'],
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
        observaciones: 'Sedán deportivo premium. Caja DSG de doble embrague, butacas deportivas calefaccionadas y ventiladas, sistema de audio Beats y suspensión adaptativa.',
        fotoPrincipal: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1000&q=80',
        fotos: ['https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1000&q=80'],
        urlAutonetOriginal: 'https://autonet.com.ar/usados/volkswagen-vento-gli-af114vk',
        provinciaRadicacion: 'Neuquén',
      });
    }

    return base;
  }
}

export const pdfService = new PdfService();
