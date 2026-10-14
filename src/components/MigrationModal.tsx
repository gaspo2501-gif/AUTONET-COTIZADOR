import React, { useState } from 'react';
import { 
  CloudUpload, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  X, 
  Loader2, 
  RefreshCw,
  Database,
  ArrowRight
} from 'lucide-react';
import { migrationService, LocalStockInventory, MigrationValidationResult } from '../services/migrationService';

interface MigrationModalProps {
  userId: string;
  onMigrationSuccess: (result: MigrationValidationResult) => void;
  onClose: () => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({
  userId,
  onMigrationSuccess,
  onClose,
}) => {
  const [inventory] = useState<LocalStockInventory>(() => migrationService.getLocalInventory());
  const [hasDownloadedBackup, setHasDownloadedBackup] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [validationResult, setValidationResult] = useState<MigrationValidationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownloadBackup = () => {
    migrationService.triggerBackupDownload();
    setHasDownloadedBackup(true);
  };

  const handleStartMigration = async () => {
    if (!hasDownloadedBackup) {
      alert('Por seguridad comercial, debe descargar el backup antes de proceder a la migración.');
      return;
    }

    setIsMigrating(true);
    setErrorMessage(null);

    try {
      const result = await migrationService.executeMigration(userId, (text) => {
        setProgressText(text);
      });

      setValidationResult(result);
      if (result.success) {
        onMigrationSuccess(result);
      } else {
        setErrorMessage(result.errorMessage || 'La migración no pudo validarse completamente.');
      }
    } catch (err: any) {
      console.error('Error durante la migración a Firestore:', err);
      setErrorMessage(err?.message || 'Ocurrió un error inesperado durante la migración.');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Encabezado */}
        <div className="bg-slate-900 text-white p-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center shrink-0 shadow-md">
              <CloudUpload className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800">
                Sincronización Multidispositivo
              </span>
              <h2 className="text-xl font-black tracking-tight text-white mt-1">
                MIGRACIÓN INICIAL DISPONIBLE
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Se detectaron datos comerciales en el almacenamiento local de este navegador.
              </p>
            </div>
          </div>
          {!isMigrating && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Contenido Principal */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Resumen real obtenido del almacenamiento local */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4 text-slate-500" />
                Datos locales detectados en este equipo
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                Almacenamiento: {inventory.stockKey}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-center">
                <span className="text-[10px] text-slate-500 block uppercase font-semibold">Total histórico</span>
                <span className="text-lg font-black text-slate-900">{inventory.counts.total}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-[10px] text-emerald-700 block uppercase font-semibold">Disponibles</span>
                <span className="text-lg font-black text-emerald-800">{inventory.counts.disponible}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-center">
                <span className="text-[10px] text-amber-700 block uppercase font-semibold">Reservados</span>
                <span className="text-lg font-black text-amber-800">{inventory.counts.reservado}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-center">
                <span className="text-[10px] text-blue-700 block uppercase font-semibold">Vendidas por mí</span>
                <span className="text-lg font-black text-blue-800">{inventory.counts.misVentas}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-center">
                <span className="text-[10px] text-purple-700 block uppercase font-semibold">Vendidas por otros</span>
                <span className="text-lg font-black text-purple-800">{inventory.counts.ventasOtros}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-center">
                <span className="text-[10px] text-slate-600 block uppercase font-semibold">Fuera de stock</span>
                <span className="text-lg font-black text-slate-700">{inventory.counts.fueraStock}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-center col-span-2">
                <span className="text-[10px] text-slate-500 block uppercase font-semibold">Actualizaciones registradas</span>
                <span className="text-lg font-black text-slate-900">{inventory.counts.historialActualizaciones}</span>
              </div>
            </div>
          </div>

          {/* Garantías de seguridad */}
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-blue-900">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Garantía de preservación de datos comerciales</span>
            </div>
            <p className="text-blue-800 leading-relaxed">
              La migración copiará exactamente sus unidades y estados a Cloud Firestore bajo su cuenta personal.
              <strong> Sus datos locales no serán borrados ni alterados</strong>, quedando preservados como respaldo.
            </p>
          </div>

          {/* Errores si ocurrieron */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-xs text-red-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-red-800">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>La migración no pudo validarse completamente</span>
              </div>
              <p className="text-red-700">{errorMessage}</p>
              {validationResult?.missingPatentes && validationResult.missingPatentes.length > 0 && (
                <p className="text-[11px] font-mono text-red-800">
                  Patentes faltantes: {validationResult.missingPatentes.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Éxito de Validación */}
          {validationResult && validationResult.success && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 space-y-3">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-sm">MIGRACIÓN COMPLETADA CORRECTAMENTE</span>
              </div>
              <div className="text-xs space-y-1 text-emerald-900">
                <p className="font-semibold">Resumen de sincronización (Local → Firestore):</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-2 bg-white rounded border border-emerald-200">
                    Total: {validationResult.localCounts.todos} → {validationResult.cloudCounts.todos}
                  </div>
                  <div className="p-2 bg-white rounded border border-emerald-200">
                    Disponibles: {validationResult.localCounts.disponible} → {validationResult.cloudCounts.disponible}
                  </div>
                  <div className="p-2 bg-white rounded border border-emerald-200">
                    Reservados: {validationResult.localCounts.reservado} → {validationResult.cloudCounts.reservado}
                  </div>
                  <div className="p-2 bg-white rounded border border-emerald-200">
                    Mis Ventas: {validationResult.localCounts.misVentas} → {validationResult.cloudCounts.misVentas}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progreso en curso */}
          {isMigrating && (
            <div className="p-4 bg-slate-100 rounded-xl flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
              <div className="text-xs text-slate-700">
                <p className="font-bold">Migrando datos a Cloud Firestore...</p>
                <p className="text-slate-500 font-mono text-[11px] mt-0.5">{progressText}</p>
              </div>
            </div>
          )}

        </div>

        {/* Botones de acción */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={isMigrating}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              hasDownloadedBackup
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-xs'
            }`}
          >
            {hasDownloadedBackup ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Backup descargado</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-slate-600" />
                <span>1. DESCARGAR BACKUP (Obligatorio)</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!validationResult?.success && (
              <button
                type="button"
                onClick={onClose}
                disabled={isMigrating}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            )}

            {validationResult?.success ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
              >
                <span>CERRAR Y COMENZAR</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartMigration}
                disabled={isMigrating || !hasDownloadedBackup}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  hasDownloadedBackup && !isMigrating
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>MIGRANDO...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" />
                    <span>2. MIGRAR A FIRESTORE</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
