import React, { useState, useRef } from 'react';
import { 
  FileUp, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowRight, 
  RefreshCw, 
  X, 
  FileText, 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown, 
  PlusCircle, 
  HelpCircle,
  Sparkles,
  Info,
  ChevronDown,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { DiffResult, Vehicle, PdfStageInfo, PdfProcessingError } from '../types/stock';
import { pdfService } from '../services/pdfService';
import { stockService } from '../services/stockService';
import { formatCurrency, formatKm } from '../utils/formatters';

interface UpdateStockViewProps {
  currentStock: Vehicle[];
  onUpdateCompleted: (fileName: string) => void;
  onCancel: () => void;
}

const INITIAL_STAGES: PdfStageInfo[] = [
  { key: 'archivo_recibido', label: 'Archivo recibido', status: 'pending' },
  { key: 'arraybuffer_creado', label: 'ArrayBuffer creado', status: 'pending' },
  { key: 'pdf_cargado', label: 'Motor PDF.js inicializado', status: 'pending' },
  { key: 'paginas_detectadas', label: 'Páginas detectadas', status: 'pending' },
  { key: 'texto_extraido', label: 'Texto extraído', status: 'pending' },
  { key: 'filas_reconstruidas', label: 'Filas reconstruidas', status: 'pending' },
  { key: 'vehiculos_validados', label: 'Vehículos validados', status: 'pending' },
];

export const UpdateStockView: React.FC<UpdateStockViewProps> = ({
  currentStock,
  onUpdateCompleted,
  onCancel,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stages, setStages] = useState<PdfStageInfo[]>(INITIAL_STAGES);
  const [pdfError, setPdfError] = useState<PdfProcessingError | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [filterDiffType, setFilterDiffType] = useState<'todos' | 'nuevos' | 'modificados' | 'no_aparecen'>('todos');
  const [pdfRawInfo, setPdfRawInfo] = useState<{ pages: number; textSnippet: string } | null>(null);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [missingActions, setMissingActions] = useState<Record<string, 'mantener' | 'vendido' | 'reservado' | 'eliminar'>>({});
  const [showDiscarded, setShowDiscarded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carga de archivo real PDF
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processPdfFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      processPdfFile(file);
    }
  };

  const processPdfFile = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setPdfError(null);
    setDiffResult(null);
    setStages(INITIAL_STAGES.map((s) => ({ ...s, status: 'pending' })));

    let lastKnownStage = 'Lectura inicial';

    try {
      // Extraer datos usando pdfjs-dist con reporte de etapas
      const parsed = await pdfService.extractFromPdfFile(file, (stageInfo) => {
        lastKnownStage = stageInfo.label;
        setStages((prev) =>
          prev.map((s) => (s.key === stageInfo.key ? { ...s, ...stageInfo } : s))
        );
      });

      // Validación estricta: NO interpretar 0 como resultado válido ni continuar con compareStock
      if (!parsed.pageCount || parsed.pageCount === 0) {
        throw new Error('El motor PDF.js no detectó páginas legibles en el archivo (numPages: 0).');
      }

      if (!parsed.diagnostics || parsed.diagnostics.recordsReconstructed === 0) {
        throw new Error(
          `No se reconstruyó ninguna fila tabular en el documento (${parsed.diagnostics?.linesExtracted || 0} líneas de texto analizadas). Verifique que el documento corresponda al listado de stock Autonet.`
        );
      }

      if (parsed.extractedVehicles.length === 0) {
        throw new Error(
          `Se reconstruyeron ${parsed.diagnostics.recordsReconstructed} filas pero ninguna superó las validaciones obligatorias de patente y columnas. Se detiene el proceso para evitar un falso borrado masivo del stock.`
        );
      }

      setPdfRawInfo({
        pages: parsed.pageCount,
        textSnippet: parsed.rawText.slice(0, 600),
      });

      // Comparar contra el stock actual únicamente si la extracción fue exitosa
      const diff = pdfService.compareWithStock(
        parsed.extractedVehicles,
        currentStock,
        file.name,
        parsed.diagnostics
      );
      setDiffResult(diff);
    } catch (error: any) {
      console.error('[AUTONET PDF IMPORT ERROR]', error);
      
      // Marcar la etapa fallida en rojo
      setStages((prev) => {
        let marked = false;
        return prev.map((s) => {
          if (!marked && s.status !== 'ok') {
            marked = true;
            return { ...s, status: 'error', detail: error?.message || 'Fallo en esta etapa' };
          }
          return s;
        });
      });

      setPdfError({
        fileName: file.name,
        stage: lastKnownStage,
        technicalMessage: error?.message || String(error) || 'Error desconocido al procesar el archivo PDF',
        timestamp: new Date().toLocaleTimeString('es-AR'),
      });

      // CRÍTICO: diffResult queda en null. NO ejecutar compareStock, NO generar 256 "Ya no figuran".
      setDiffResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Simulación con datos realistas para probar el flujo completo
  const handleRunSimulation = (scenario: 'quincenal' | 'cambio_precios') => {
    setIsProcessing(true);
    setTimeout(() => {
      const simulatedVehicles = pdfService.generateSimulatedBatch(currentStock, scenario);
      const simulatedDiff = pdfService.compareWithStock(
        simulatedVehicles,
        currentStock,
        `Lista_Autonet_Quincenal_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.pdf`,
        {
          pageCount: 7,
          linesExtracted: currentStock.length + 10,
          recordsReconstructed: simulatedVehicles.length,
          validRecords: simulatedVehicles.length,
          discardedRecords: 0,
          discardedDetails: [],
        }
      );
      setDiffResult(simulatedDiff);
      setIsProcessing(false);
    }, 600);
  };

  const handleConfirmUpdate = () => {
    if (!diffResult) return;
    stockService.applyBatchUpdate(diffResult);
    setAppliedSuccess(true);
    setTimeout(() => {
      onUpdateCompleted(diffResult.archivoNombre);
    }, 1200);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setDiffResult(null);
    setPdfRawInfo(null);
    setPdfError(null);
    setStages(INITIAL_STAGES.map((s) => ({ ...s, status: 'pending' })));
    setMissingActions({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filtrado de la tabla de diferencias
  const filteredItems = React.useMemo(() => {
    if (!diffResult) return [];
    if (filterDiffType === 'todos') return diffResult.items;
    if (filterDiffType === 'nuevos') return diffResult.items.filter((i) => i.tipo === 'nuevo');
    if (filterDiffType === 'modificados') return diffResult.items.filter((i) => i.tipo === 'modificado');
    if (filterDiffType === 'no_aparecen') return diffResult.items.filter((i) => i.tipo === 'no_aparece');
    return diffResult.items;
  }, [diffResult, filterDiffType]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      
      {/* Título y Explicación del Proceso */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <FileUp className="w-6 h-6 text-blue-600" />
              <span>Actualización Inteligente de Stock</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-3xl">
              Cargue la lista periódica que proporciona Autonet (en formato PDF). El sistema detectará automáticamente unidades nuevas, cambios de precio o kilometraje y vehículos que ya no figuren, <strong>sin sobreescribir las unidades marcadas como vendidas manualmente</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Stock en base actual:</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200">
              {currentStock.length} unidades
            </span>
          </div>
        </div>
      </div>

      {/* ERROR CRÍTICO AL PROCESAR PDF */}
      {pdfError && (
        <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-6 text-red-950 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-xl shrink-0 mt-0.5">
                <AlertCircle className="w-7 h-7 text-red-600" />
              </div>
              <div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-200 text-red-900 uppercase tracking-wide">
                  Error de Lectura
                </span>
                <h2 className="text-lg font-black text-red-950 mt-1">
                  ERROR AL PROCESAR PDF
                </h2>
                <p className="text-xs text-red-800 mt-0.5">
                  No se pudo procesar el archivo. La comparación fue cancelada automáticamente para proteger el stock vigente y evitar falsas bajas.
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-red-100 text-red-800 border border-red-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Cerrar</span>
            </button>
          </div>

          {/* Ficha técnica del error */}
          <div className="bg-white/95 border border-red-200 rounded-xl p-4 text-xs space-y-3 font-mono">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pb-2.5 border-b border-red-100">
              <div>
                <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold">Archivo:</span>
                <span className="font-semibold text-slate-800 break-all">{pdfError.fileName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold">Etapa:</span>
                <span className="font-semibold text-red-700">{pdfError.stage}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold">Hora:</span>
                <span className="font-semibold text-slate-700">{pdfError.timestamp}</span>
              </div>
            </div>
            <div>
              <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold mb-1">
                Mensaje de la excepción:
              </span>
              <div className="bg-red-950 text-red-100 p-3 rounded-lg text-[11px] whitespace-pre-wrap overflow-x-auto font-mono">
                {pdfError.technicalMessage}
              </div>
            </div>
          </div>

          {/* Diagnóstico por etapas */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-red-950 uppercase tracking-wide block">
              Diagnóstico por etapas:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {stages.map((stage) => (
                <div
                  key={stage.key}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    stage.status === 'ok'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : stage.status === 'error'
                      ? 'bg-red-100 border-red-300 text-red-950 font-bold ring-1 ring-red-400'
                      : stage.status === 'in_progress'
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {stage.status === 'ok' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {stage.status === 'error' && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                    {stage.status === 'in_progress' && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
                    {stage.status === 'pending' && <Clock className="w-4 h-4 text-slate-400 shrink-0" />}
                    <span className="truncate">{stage.label}</span>
                  </div>
                  {stage.detail && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/70 border border-slate-200 shrink-0">
                      {stage.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
            >
              <FileUp className="w-4 h-4" />
              <span>Reintentar con otro archivo</span>
            </button>
          </div>
        </div>
      )}

      {/* Si todavía no hay un lote analizado: Selector de Archivo o Simulador */}
      {!diffResult && (
        <div className="space-y-4">
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white rounded-2xl p-8 sm:p-12 text-center transition-colors shadow-xs"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
              id="pdf-file-input"
            />

            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-4 shadow-inner">
              <FileText className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-bold text-slate-800">
              Seleccione o arrastre el archivo PDF de Autonet
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
              El archivo será analizado y se generará una previsualización completa de los cambios antes de tocar la base de datos.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                id="btn-seleccionar-pdf"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
              >
                <FileUp className="w-4 h-4" />
                <span>{isProcessing ? 'Analizando documento...' : 'Cargar archivo PDF'}</span>
              </button>

              <button
                id="btn-simular-quincenal"
                onClick={() => handleRunSimulation('quincenal')}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold border border-slate-200 transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Probar Lote Quincenal Simulado</span>
              </button>
            </div>

            {isProcessing && (
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-blue-600 font-semibold animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Leyendo páginas del PDF y comparando patentes contra el stock...</span>
              </div>
            )}
          </div>

          {/* Nota informativa de arquitectura */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block mb-0.5">Estructura preparada para el PDF real de Autonet:</strong>
              No asumimos de antemano el diseño gráfico exacto del PDF de Autonet. Al recibir el primer archivo real, se ajusta el extractor de columnas exacto en <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono">pdfService.ts</code> sin modificar el resto de la aplicación.
            </div>
          </div>
        </div>
      )}

      {/* PANTALLA DE PREVISUALIZACIÓN DE DIFERENCIAS (ANTES DE CONFIRMAR) */}
      {diffResult && !appliedSuccess && (
        <div className="space-y-6">
          
          {/* ALERTA CRÍTICA DE SEGURIDAD SI ESTÁ BLOQUEADO */}
          {diffResult.safetyValidation?.isBlocked && (
            <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 text-red-950 shadow-sm flex items-start gap-4">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-xl shrink-0 mt-0.5">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-base text-red-950">
                    Bloqueo de Seguridad: Stock Sospechosamente Bajo
                  </h4>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-200 text-red-900 uppercase tracking-wide">
                    Umbral Preventivo
                  </span>
                </div>
                <p className="text-xs text-red-900 leading-relaxed font-medium">
                  {diffResult.safetyValidation.blockedReason}
                </p>
                <div className="mt-2 text-[11px] bg-white/70 border border-red-200 rounded-lg p-2.5 text-red-800">
                  <p className="font-semibold">El documento fue interpretado correctamente por el lector:</p>
                  <p className="text-red-700 mt-0.5">
                    Se procesaron con éxito {diffResult.diagnostics.pageCount} páginas y {diffResult.diagnostics.linesExtracted} líneas. Sin embargo, solo {diffResult.totalEncontrados} unidades fueron reconocidas como válidas frente a las {currentStock.length} unidades del stock actual (menos del 60%). Para evitar bajas accidentales en masa, la importación se mantiene bloqueada.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ADVERTENCIA INFORMATIVA SI HAY MUCHAS BAJAS PERO NO BLOQUEADO */}
          {!diffResult.safetyValidation?.isBlocked && diffResult.safetyValidation?.warningMessage && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-amber-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold block text-amber-950 mb-0.5">Atención</span>
                <p>{diffResult.safetyValidation.warningMessage}</p>
              </div>
            </div>
          )}

          {/* DIAGNÓSTICO VISUAL DE EXTRACCIÓN */}
          {diffResult.diagnostics && (
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Diagnóstico de extracción del documento
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {diffResult.archivoNombre}
                </span>
              </div>

              <div className={`grid grid-cols-2 ${diffResult.diagnostics.corregidosCount ? 'sm:grid-cols-3 lg:grid-cols-6' : 'sm:grid-cols-5'} gap-3 mt-3`}>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Páginas leídas</span>
                  <span className="text-base font-black text-slate-800 font-mono">
                    {diffResult.diagnostics.pageCount}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Líneas analizadas</span>
                  <span className="text-base font-black text-slate-800 font-mono">
                    {diffResult.diagnostics.linesExtracted}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Filas reconstruidas</span>
                  <span className="text-base font-black text-slate-800 font-mono">
                    {diffResult.diagnostics.recordsReconstructed}
                  </span>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Unidades válidas</span>
                  <span className="text-base font-black text-emerald-800 font-mono">
                    {diffResult.diagnostics.validRecords}
                  </span>
                </div>
                {diffResult.diagnostics.corregidosCount !== undefined && diffResult.diagnostics.corregidosCount > 0 && (
                  <div className="bg-teal-50 p-2.5 rounded-lg border border-teal-200">
                    <span className="text-[10px] uppercase font-bold text-teal-800 block">Corregidos</span>
                    <span className="text-base font-black text-teal-800 font-mono">
                      {diffResult.diagnostics.corregidosCount}
                    </span>
                  </div>
                )}
                <div className={`p-2.5 rounded-lg border ${
                  diffResult.diagnostics.discardedRecords > 0 
                    ? 'bg-amber-50 border-amber-200' 
                    : 'bg-slate-50 border-slate-100'
                }`}>
                  <span className={`text-[10px] uppercase font-bold block ${
                    diffResult.diagnostics.discardedRecords > 0 ? 'text-amber-800' : 'text-slate-500'
                  }`}>
                    Filas descartadas
                  </span>
                  <span className={`text-base font-black font-mono ${
                    diffResult.diagnostics.discardedRecords > 0 ? 'text-amber-800' : 'text-slate-800'
                  }`}>
                    {diffResult.diagnostics.discardedRecords}
                  </span>
                </div>
              </div>

              {diffResult.diagnostics.discardedRecords > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  {/* Resumen de causas agrupadas */}
                  {diffResult.diagnostics.discardedSummary && (
                    <div className="mb-3">
                      <span className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                        Causas principales de descarte:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {diffResult.diagnostics.discardedSummary.patenteNoDetectada > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-900 border border-amber-200">
                            Patente no detectada: {diffResult.diagnostics.discardedSummary.patenteNoDetectada}
                          </span>
                        )}
                        {diffResult.diagnostics.discardedSummary.patenteInvalida > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-900 border border-red-200">
                            Patente inválida: {diffResult.diagnostics.discardedSummary.patenteInvalida}
                          </span>
                        )}
                        {diffResult.diagnostics.discardedSummary.marcaNoDetectada > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-900 border border-orange-200">
                            Marca no detectada: {diffResult.diagnostics.discardedSummary.marcaNoDetectada}
                          </span>
                        )}
                        {diffResult.diagnostics.discardedSummary.modeloNoDetectado > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-900 border border-yellow-200">
                            Modelo no detectado: {diffResult.diagnostics.discardedSummary.modeloNoDetectado}
                          </span>
                        )}
                        {diffResult.diagnostics.discardedSummary.anioInvalido > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-900 border border-rose-200">
                            Año inválido: {diffResult.diagnostics.discardedSummary.anioInvalido}
                          </span>
                        )}
                        {diffResult.diagnostics.discardedSummary.kmInvalido > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-900 border border-indigo-200">
                            KM inválido: {diffResult.diagnostics.discardedSummary.kmInvalido}
                          </span>
                        )}
                        {diffResult.diagnostics.discardedSummary.precioInvalido > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-900 border border-purple-200">
                            Precio inválido: {diffResult.diagnostics.discardedSummary.precioInvalido}
                          </span>
                        )}
                        {diffResult.diagnostics.discardedSummary.columnasIncompletas > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-800 border border-slate-300">
                            Columnas incompletas: {diffResult.diagnostics.discardedSummary.columnasIncompletas}
                          </span>
                        )}
                        {diffResult.diagnostics.discardedSummary.otros > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Otros motivos: {diffResult.diagnostics.discardedSummary.otros}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setShowDiscarded(!showDiscarded)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>
                      {showDiscarded 
                        ? 'Ocultar detalle de filas descartadas' 
                        : `Ver detalle forense de las ${diffResult.diagnostics.discardedRecords} filas descartadas`}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDiscarded ? 'rotate-180' : ''}`} />
                  </button>

                  {showDiscarded && (
                    <div className="mt-2.5 p-3 bg-amber-50/60 rounded-lg border border-amber-200/70 max-h-64 overflow-y-auto space-y-2.5 text-xs">
                      {diffResult.diagnostics.discardedDetails.map((item, dIdx) => (
                        <div key={dIdx} className="bg-white p-3 rounded-lg border border-amber-200/80 shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-bold text-amber-950 flex items-center gap-1.5">
                              {item.page ? (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-mono text-[10px]">
                                  Pág {item.page} · Fila {item.rowNumber ?? dIdx + 1}
                                </span>
                              ) : null}
                              {item.reason}
                            </span>
                            {item.patenteDetectada && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono font-bold text-[11px]">
                                Patente: {item.patenteDetectada}
                              </span>
                            )}
                          </div>

                          {(item.descripcionDetectada || item.anioDetectado || item.kmDetectado || item.precioDetectado) && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] bg-slate-50 p-2 rounded border border-slate-200/60">
                              {item.descripcionDetectada && (
                                <div className="col-span-2 sm:col-span-4">
                                  <span className="text-slate-500 font-semibold">Descripción: </span>
                                  <span className="text-slate-800">{item.descripcionDetectada}</span>
                                </div>
                              )}
                              {item.anioDetectado && (
                                <div>
                                  <span className="text-slate-500 font-semibold">Año: </span>
                                  <span className="text-slate-800">{item.anioDetectado}</span>
                                </div>
                              )}
                              {item.kmDetectado && (
                                <div>
                                  <span className="text-slate-500 font-semibold">KM: </span>
                                  <span className="text-slate-800">{item.kmDetectado}</span>
                                </div>
                              )}
                              {item.precioDetectado && (
                                <div className="col-span-2">
                                  <span className="text-slate-500 font-semibold">Precio: </span>
                                  <span className="text-slate-800">{item.precioDetectado}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {item.raw && (
                            <div>
                              <span className="text-[10px] text-slate-400 font-mono block">Texto crudo:</span>
                              <p className="text-[11px] text-slate-600 font-mono break-all bg-slate-50 px-2 py-1 rounded">
                                {item.raw}
                              </p>
                            </div>
                          )}

                          {item.tokensWithX && (
                            <div>
                              <span className="text-[10px] text-slate-400 font-mono block">Tokens (con coordenada X pt):</span>
                              <p className="text-[10px] text-slate-500 font-mono break-all bg-slate-100/70 px-2 py-1 rounded">
                                {item.tokensWithX}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Métricas de la Actualización (interactivas como filtros rápidos) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <button
              type="button"
              id="filter-card-todos"
              onClick={() => setFilterDiffType('todos')}
              className={`rounded-xl p-4 border text-left transition-all cursor-pointer ${
                filterDiffType === 'todos'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-400'
                  : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
              }`}
            >
              <span className={`text-xs font-semibold block mb-1 ${filterDiffType === 'todos' ? 'text-slate-300' : 'text-slate-500'}`}>
                Todos
              </span>
              <span className={`text-2xl font-black font-mono ${filterDiffType === 'todos' ? 'text-white' : 'text-slate-900'}`}>
                {diffResult.items.length}
              </span>
            </button>

            <button
              type="button"
              id="filter-card-nuevos"
              onClick={() => setFilterDiffType('nuevos')}
              className={`rounded-xl p-4 border text-left transition-all cursor-pointer ${
                filterDiffType === 'nuevos'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                  : 'bg-emerald-50 hover:bg-emerald-100/70 border-emerald-200 shadow-xs'
              }`}
            >
              <span className={`text-xs font-semibold block mb-1 ${filterDiffType === 'nuevos' ? 'text-emerald-100' : 'text-emerald-800'}`}>
                Nuevos
              </span>
              <span className={`text-2xl font-black font-mono ${filterDiffType === 'nuevos' ? 'text-white' : 'text-emerald-700'}`}>
                +{diffResult.nuevos}
              </span>
            </button>

            <button
              type="button"
              id="filter-card-modificados"
              onClick={() => setFilterDiffType('modificados')}
              className={`rounded-xl p-4 border text-left transition-all cursor-pointer ${
                filterDiffType === 'modificados'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300'
                  : 'bg-blue-50 hover:bg-blue-100/70 border-blue-200 shadow-xs'
              }`}
            >
              <span className={`text-xs font-semibold block mb-1 ${filterDiffType === 'modificados' ? 'text-blue-100' : 'text-blue-800'}`}>
                Modificados
              </span>
              <span className={`text-2xl font-black font-mono ${filterDiffType === 'modificados' ? 'text-white' : 'text-blue-700'}`}>
                {diffResult.modificados}
              </span>
            </button>

            <button
              type="button"
              id="filter-card-sincambios"
              onClick={() => setFilterDiffType('todos')}
              className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-xs text-left"
            >
              <span className="text-xs font-semibold text-slate-600 block mb-1">Sin Cambios</span>
              <span className="text-2xl font-black text-slate-700 font-mono">
                {diffResult.sinCambios}
              </span>
            </button>

            <button
              type="button"
              id="filter-card-noaparecen"
              onClick={() => setFilterDiffType('no_aparecen')}
              className={`rounded-xl p-4 border text-left transition-all cursor-pointer ${
                filterDiffType === 'no_aparecen'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
                  : 'bg-amber-50 hover:bg-amber-100/70 border-amber-200 shadow-xs'
              }`}
            >
              <span className={`text-xs font-semibold block mb-1 ${filterDiffType === 'no_aparecen' ? 'text-amber-100' : 'text-amber-800'}`}>
                Ya no figuran
              </span>
              <span className={`text-2xl font-black font-mono ${filterDiffType === 'no_aparecen' ? 'text-white' : 'text-amber-700'}`}>
                {diffResult.noAparecen}
              </span>
            </button>

            <div className="bg-violet-50 rounded-xl p-4 border border-violet-200 shadow-xs">
              <span className="text-xs font-semibold text-violet-800 block mb-1">Cambios Precio</span>
              <span className="text-2xl font-black text-violet-700 font-mono">
                {diffResult.cambiosPrecio}
              </span>
            </div>
          </div>

          {/* Barra de Acciones de Confirmación y Filtros de Tabla */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Filtros de la tabla */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              <button
                id="btn-filter-diff-todos"
                onClick={() => setFilterDiffType('todos')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  filterDiffType === 'todos'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({diffResult.items.length})
              </button>

              <button
                id="btn-filter-diff-nuevos"
                onClick={() => setFilterDiffType('nuevos')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  filterDiffType === 'nuevos'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Nuevos ({diffResult.nuevos})
              </button>

              <button
                id="btn-filter-diff-modificados"
                onClick={() => setFilterDiffType('modificados')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  filterDiffType === 'modificados'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Modificados ({diffResult.modificados})
              </button>

              <button
                id="btn-filter-diff-noaparecen"
                onClick={() => setFilterDiffType('no_aparecen')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  filterDiffType === 'no_aparecen'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                No figuran ({diffResult.noAparecen})
              </button>
            </div>

            {/* Botones de acción principales */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                id="btn-cancelar-actualizacion"
                onClick={handleReset}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors"
              >
                Cancelar
              </button>

              <button
                id="btn-confirmar-actualizacion"
                onClick={handleConfirmUpdate}
                disabled={diffResult.safetyValidation?.isBlocked}
                className={`px-6 py-2.5 rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center gap-2 ${
                  diffResult.safetyValidation?.isBlocked
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title={
                  diffResult.safetyValidation?.isBlocked 
                    ? 'Actualización bloqueada por seguridad' 
                    : 'Confirmar actualización del stock'
                }
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {diffResult.safetyValidation?.isBlocked 
                    ? 'Actualización Bloqueada' 
                    : 'Confirmar actualización'}
                </span>
              </button>
            </div>
          </div>

          {/* Tabla de Cambios Detectados */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Detalle de cambios detectados ({filteredItems.length} registros)
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {diffResult.archivoNombre}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-4">Patente</th>
                    <th className="py-2.5 px-4">Vehículo</th>
                    <th className="py-2.5 px-4">Tipo de Detección</th>
                    <th className="py-2.5 px-4">Detalle del Cambio</th>
                    <th className="py-2.5 px-4">Observaciones / Reglas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      {/* Patente */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-slate-900">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white">
                          {item.patente}
                        </span>
                      </td>

                      {/* Vehículo */}
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {item.marcaModelo}
                      </td>

                      {/* Tipo */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.tipo === 'nuevo' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                            <PlusCircle className="w-3.5 h-3.5" />
                            Nuevo ingreso
                          </span>
                        )}
                        {item.tipo === 'modificado' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800">
                            <RefreshCw className="w-3.5 h-3.5" />
                            Datos actualizados
                          </span>
                        )}
                        {item.tipo === 'sin_cambio' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                            Sin cambios
                          </span>
                        )}
                        {item.tipo === 'no_aparece' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                            NO PRESENTE EN ÚLTIMA ACTUALIZACIÓN
                          </span>
                        )}
                      </td>

                      {/* Detalle de cambios / Acción para unidades no presentes */}
                      <td className="py-3 px-4">
                        {item.tipo === 'nuevo' && item.vehiculoNuevo && (
                          <div className="space-y-0.5">
                            <span className="font-bold text-emerald-700">
                              {formatCurrency(item.vehiculoNuevo.precio || 0)}
                            </span>
                            <div className="text-[11px] text-slate-500">
                              Año {item.vehiculoNuevo.anio} • {formatKm(item.vehiculoNuevo.kilometraje || 0)}
                            </div>
                          </div>
                        )}

                        {item.tipo === 'modificado' && item.cambios && (
                          <div className="space-y-1">
                            {item.cambios.map((c, i) => {
                              const isPrice = c.campo === 'precio';
                              const diffNum = isPrice ? c.valorNuevo - c.valorAnterior : null;
                              return (
                                <div key={i} className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-slate-600">{c.etiqueta}:</span>
                                  <span className="line-through text-slate-400">
                                    {isPrice ? formatCurrency(c.valorAnterior) : c.valorAnterior}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-slate-400" />
                                  <span className="font-bold text-blue-700">
                                    {isPrice ? formatCurrency(c.valorNuevo) : c.valorNuevo}
                                  </span>
                                  {diffNum !== null && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                      diffNum > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                      {diffNum > 0 ? `+${formatCurrency(diffNum)}` : formatCurrency(diffNum)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {item.tipo === 'sin_cambio' && (
                          <span className="text-slate-400">Datos idénticos al stock actual</span>
                        )}

                        {item.tipo === 'no_aparece' && (
                          <div>
                            {item.vehiculoExistente?.estado === 'Vendido' ? (
                              <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                <span>Vendido (Historial)</span>
                              </div>
                            ) : item.vehiculoExistente?.estado === 'Reservado' ? (
                              <div className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                <span>Reservado (Historial)</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                <span>Pasa a Fuera de Stock</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Observaciones y Reglas de Estado */}
                      <td className="py-3 px-4">
                        {item.advertenciaEstado ? (
                          <div className="flex items-center gap-1.5 text-blue-700 font-semibold bg-blue-50 p-1.5 rounded">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>{item.advertenciaEstado}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje de éxito tras confirmación */}
      {appliedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center animate-in zoom-in-95 duration-200">
          <div className="w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-emerald-950">
            ¡Stock Actualizado Exitosamente!
          </h2>
          <p className="text-sm text-emerald-800 mt-1">
            Los cambios fueron consolidados en la base de datos y registrados en el historial de actualizaciones. Redirigiendo a la pantalla de stock...
          </p>
        </div>
      )}
    </div>
  );
};
