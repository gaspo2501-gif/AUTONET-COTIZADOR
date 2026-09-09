export type VehicleStatus = 'Disponible' | 'Reservado' | 'Vendido' | 'fuera_de_stock';
export type SaleOwner = 'self' | 'other' | null;
export type VehicleTransmission = 'Manual' | 'Automática';
export type VehicleFuel = 'Nafta' | 'Diésel' | 'GNC' | 'Híbrido' | 'Eléctrico';
export type VehicleTraction = '4x2' | '4x4' | 'AWD';

export interface Vehicle {
  id: string; // ID interno (ej. AUT-1024)
  marca: string;
  modelo: string;
  version: string;
  anio: number;
  color: string;
  kilometraje: number;
  precio: number;
  moneda: 'ARS' | 'USD';
  patente: string; // Dominio identificador único (ej. AF 123 CD)
  combustible: VehicleFuel;
  caja: VehicleTransmission;
  traccion: VehicleTraction;
  estado: VehicleStatus;
  estadoModificadoManualmente?: boolean; // Si el asesor lo marcó como Vendido manualmente, no se sobreescribe por PDF
  observaciones: string;
  fotos: string[];
  fotoPrincipal: string;
  urlAutonetOriginal?: string;
  fechaActualizacion: string; // ISO string
  fechaIncorporacion: string; // ISO string
  origenDato: 'autonet_pdf' | 'autonet_web' | 'manual';
  
  // Control de ventas comerciales
  saleOwner?: SaleOwner; // 'self' = vendida por mí, 'other' = vendida por otro vendedor, null = sin clasificar
  soldAt?: string; // Fecha de venta (ISO string YYYY-MM-DD o ISO timestamp)
  soldPrice?: number; // Precio al momento de la venta
  
  // Control de stock activo vs histórico
  isHistorical?: boolean; // true si ya no figura en el stock activo del último PDF
  fechaSalidaStock?: string; // ISO timestamp de cuándo dejó de figurar en el PDF activo

  // Campos preparados para cotización y transferencia DNRPA
  valorTablaDnrpaEstimado?: number;
  costoTransferenciaEstimado?: number;
  provinciaRadicacion?: 'Neuquén' | 'Río Negro';

  // Metadatos extraídos de la lista oficial Autonet
  numeroOrden?: number;
  ubicacion?: string; // Situación operativa / localización en stock (Ub)
  ubCode?: string; // Código crudo de Ub (A, P, S, GR, FINAN)
  ubLabel?: string; // Etiqueta descriptiva (Autonet, Pendiente, Solalique, etc.)
  tipoVehiculo?: string;
  empresa?: string; // Procedencia / sociedad comercial (MIRAGE, IRUÑA, etc.)
  fechaToma?: string;
  categoriaOrigen?: string;

  // Información complementaria de la web de Autonet (https://autonet.com.ar/)
  precioPublicadoWeb?: number;
  sincronizadoAutonetWeb?: boolean;
  fechaSincronizacionWeb?: string;
  descripcionWeb?: string;
  autonetWebId?: string;
}

export interface FieldChange {
  campo: string;
  etiqueta: string;
  valorAnterior: any;
  valorNuevo: any;
}

export interface VehicleDiffItem {
  patente: string;
  marcaModelo: string;
  tipo: 'nuevo' | 'modificado' | 'sin_cambio' | 'no_aparece';
  cambios?: FieldChange[];
  vehiculoNuevo?: Partial<Vehicle>;
  vehiculoExistente?: Vehicle;
  advertenciaEstado?: string;
}

export interface DiscardedRecordDetail {
  page?: number;
  rowNumber?: number;
  raw: string;
  tokensWithX?: string;
  descripcionDetectada?: string;
  ubDetectado?: string;
  tipoDetectado?: string;
  patenteDetectada?: string;
  anioDetectado?: string;
  colorDetectado?: string;
  kmDetectado?: string;
  empresaDetectada?: string;
  precioDetectado?: string;
  fechaDetectada?: string;
  reason: string;
  category?:
    | 'patente_no_detectada'
    | 'patente_invalida'
    | 'marca_no_detectada'
    | 'modelo_no_detectado'
    | 'anio_invalido'
    | 'km_invalido'
    | 'precio_invalido'
    | 'columnas_incompletas'
    | 'otros';
}

export interface DiscardedSummary {
  patenteNoDetectada: number;
  patenteInvalida: number;
  marcaNoDetectada: number;
  modeloNoDetectado: number;
  anioInvalido: number;
  kmInvalido: number;
  precioInvalido: number;
  columnasIncompletas: number;
  otros: number;
}

export interface ParsingDiagnostics {
  pageCount: number;
  linesExtracted: number;
  recordsReconstructed: number;
  validRecords: number;
  discardedRecords: number;
  corregidosCount?: number;
  discardedDetails: DiscardedRecordDetail[];
  discardedSummary?: DiscardedSummary;
}

export interface SafetyValidation {
  isBlocked: boolean;
  blockedReason?: string;
  warningMessage?: string;
  ratio: number;
}

export type PdfProcessingStageKey =
  | 'archivo_recibido'
  | 'arraybuffer_creado'
  | 'pdf_cargado'
  | 'paginas_detectadas'
  | 'texto_extraido'
  | 'filas_reconstruidas'
  | 'vehiculos_validados';

export interface PdfStageInfo {
  key: PdfProcessingStageKey;
  label: string;
  status: 'pending' | 'in_progress' | 'ok' | 'error';
  detail?: string;
}

export interface PdfProcessingError {
  fileName: string;
  stage: string;
  technicalMessage: string;
  timestamp: string;
}

export interface DiffResult {
  archivoNombre: string;
  totalEncontrados: number;
  nuevos: number;
  modificados: number;
  sinCambios: number;
  noAparecen: number;
  cambiosPrecio: number;
  corregidos?: number;
  enriquecidosWeb?: number;
  soloPdf?: number;
  items: VehicleDiffItem[];
  timestamp: string;
  diagnostics?: ParsingDiagnostics;
  safetyValidation?: SafetyValidation;
}

export interface UpdateHistoryRecord {
  id: string;
  fecha: string;
  archivoNombre: string;
  vehiculosEncontrados: number;
  nuevos: number;
  modificados: number;
  sinCambios: number;
  noAparecen: number;
  cambiosPrecio: number;
  cambiosDetectados: VehicleDiffItem[];
  errores: string[];
}

export type CommercialFilter =
  | 'activo' // Default: Stock activo (Disponible + Reservado)
  | 'Disponible'
  | 'Reservado'
  | 'vendidas_propias' // Vendidas por mí
  | 'vendidas_otros' // Vendidas por otros
  | 'fuera_de_stock' // Fuera de stock (historial)
  | 'todos'; // Todo

export interface StockFilters {
  searchQuery: string;
  marca: string;
  modelo: string;
  anioMin: number | '';
  anioMax: number | '';
  kmMin: number | '';
  kmMax: number | '';
  precioMin: number | '';
  precioMax: number | '';
  combustible: string;
  caja: string;
  traccion: string;
  estado: string; // 'Todos' | 'Disponible' | 'Reservado' | 'Vendido' | 'fuera_de_stock'
  estadoComercial?: CommercialFilter;
  ubicacion?: string; // Filtro por campo Ub (Pendiente, Solalique, GR, FINAN, Autonet)
  empresa?: string; // Filtro por campo Empresa (MIRAGE, IRUÑA, AKIRA, OIL BULL, etc.)
  fotosAutonet?: 'todas' | 'con_fotos' | 'sin_fotos';
}

export type ProvinceTransfer = 'Neuquén' | 'Río Negro';

/**
 * Estructura de datos para el cálculo y cotización de transferencia de vehículos usados.
 * Separa claramente los valores fundamentales y prepara la base para futuros presupuestos.
 */
export interface VehicleQuoteCalculation {
  vehicleId: string;
  patente: string;
  marca: string;
  modelo: string;
  version: string;
  anio: number;
  vehiclePrice: number;
  dnrpaTableValue: number;
  transferBaseValue: number;
  usedBaseOrigin: 'precio_venta' | 'tabla_dnrpa' | 'iguales';
  comparisonExplanation: string;
  province: ProvinceTransfer;
  transferPercentage: number; // 4.9 (Neuquén) | 5.5 (Río Negro)
  estimatedTransferCost: number;
  
  // Estructura lista para futura etapa de presupuesto formal
  gastosAdicionales?: number;
  totalOperacion?: number;
  datosAsesor?: {
    nombre: string;
    telefono: string;
    concesionaria: string;
    sucursal: string;
  };
  datosCliente?: {
    nombre?: string;
    telefono?: string;
    email?: string;
    dniCuit?: string;
  };
  observacionesPresupuesto?: string;
  fechaCotizacion: string;
}
