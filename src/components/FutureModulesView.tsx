import React, { useState } from 'react';
import { todayISO } from '../utils/dates';
import { 
  Calculator, 
  FileText, 
  Settings, 
  Download, 
  Upload, 
  RotateCcw, 
  ShieldCheck, 
  Database, 
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  User,
  Phone,
  Building2,
  Mail,
  Printer,
  Share2,
  Search,
  Clock,
  FileUp,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  LogIn
} from 'lucide-react';
import { stockService } from '../services/stockService';
import { quoteService, AdvisorSettings } from '../services/quoteService';
import { Vehicle } from '../types/stock';
import { formatCurrency } from '../utils/formatters';

interface FutureModulesViewProps {
  type: 'configuracion';
  vehicles: Vehicle[];
  onStockReset: () => void;
  onQuoteVehicle?: (vehicle: Vehicle) => void;
  onGoToUpdateStock?: () => void;
  onOpenMigrationModal?: () => void;
  onOpenLoginModal?: () => void;
}

export const FutureModulesView: React.FC<FutureModulesViewProps> = ({
  type,
  vehicles,
  onStockReset,
  onQuoteVehicle,
  onGoToUpdateStock,
  onOpenMigrationModal,
  onOpenLoginModal,
}) => {
  const [resetDone, setResetDone] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Configuración del Asesor Comercial
  const [advisorSettings, setAdvisorSettings] = useState<AdvisorSettings>(() => quoteService.getAdvisorSettings());
  const [advisorSavedMessage, setAdvisorSavedMessage] = useState(false);


  // Guardar datos del asesor
  const handleSaveAdvisor = (e: React.FormEvent) => {
    e.preventDefault();
    quoteService.saveAdvisorSettings(advisorSettings);
    setAdvisorSavedMessage(true);
    setTimeout(() => setAdvisorSavedMessage(false), 2500);
  };

  // Descarga de backup JSON del stock y del historial
  const handleExportJson = () => {
    const jsonStr = stockService.exportStockJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autonet_stock_backup_${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Importar JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = stockService.importStockJson(content);
      if (success) {
        setImportMessage('¡Respaldo importado correctamente!');
        onStockReset();
        setTimeout(() => setImportMessage(null), 3000);
      } else {
        setImportMessage('Error al procesar el archivo JSON.');
        setTimeout(() => setImportMessage(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (window.confirm('¿Desea restablecer el stock inicial de Autonet?')) {
      stockService.resetToInitialStock();
      setResetDone(true);
      onStockReset();
      setTimeout(() => setResetDone(false), 2500);
    }
  };

  // VISTA 3: CONFIGURACIÓN
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
          <Settings className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">
          Configuración Comercial y Respaldo
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Configure los datos que aparecerán en los presupuestos emitidos y gestione copias de seguridad del stock.
        </p>

        {/* Acceso Directo: Actualizar Stock desde PDF (Punto 24 del prompt) */}
        {onGoToUpdateStock && (
          <div className="mt-5 p-4 rounded-xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                Carga Oficial de Stock Autonet
              </span>
              <span className="text-[11px] sm:text-xs text-slate-600">
                Incorpore un nuevo archivo PDF para detectar altas, modificaciones de precios y bajas.
              </span>
            </div>
            <button
              type="button"
              id="config-btn-actualizar-stock"
              onClick={onGoToUpdateStock}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0"
            >
              <FileUp className="w-4 h-4" />
              <span>ACTUALIZAR STOCK DESDE PDF</span>
            </button>
          </div>
        )}

        {/* 1. DATOS DEL ASESOR COMERCIAL (Punto 14 del prompt) */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" />
                <span>Datos del Asesor Comercial</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Estos datos se utilizarán automáticamente en el membrete y cierre de cada presupuesto emitido.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveAdvisor} className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nombre y Apellido del Asesor:
                </label>
                <input
                  type="text"
                  value={advisorSettings.nombre}
                  onChange={(e) => setAdvisorSettings({ ...advisorSettings, nombre: e.target.value })}
                  placeholder="Ej. Martín Gómez"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Teléfono / WhatsApp de Contacto:
                </label>
                <input
                  type="text"
                  value={advisorSettings.telefono}
                  onChange={(e) => setAdvisorSettings({ ...advisorSettings, telefono: e.target.value })}
                  placeholder="Ej. +54 9 299 123-4567"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email de Contacto (Opcional):
                </label>
                <input
                  type="email"
                  value={advisorSettings.email || ''}
                  onChange={(e) => setAdvisorSettings({ ...advisorSettings, email: e.target.value })}
                  placeholder="Ej. mgomez@autonet.com.ar"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Sucursal / Ubicación:
                </label>
                <input
                  type="text"
                  value={advisorSettings.sucursal}
                  onChange={(e) => setAdvisorSettings({ ...advisorSettings, sucursal: e.target.value })}
                  placeholder="Ej. Neuquén Capital"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Nombre de la Concesionaria:
                </label>
                <input
                  type="text"
                  value={advisorSettings.concesionaria}
                  onChange={(e) => setAdvisorSettings({ ...advisorSettings, concesionaria: e.target.value })}
                  placeholder="Ej. Autonet Usados Seleccionados"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              {advisorSavedMessage ? (
                <div className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Datos del asesor guardados correctamente.</span>
                </div>
              ) : (
                <div className="text-slate-400 text-[11px]">
                  Los cambios se guardan en el navegador y no requieren reiniciar la app.
                </div>
              )}

              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs"
              >
                Guardar Datos del Asesor
              </button>
            </div>
          </form>
        </div>

        {/* 2. ESTADO ACTUAL DEL STOCK */}
        <div className="mt-8 pt-5 border-t border-slate-200">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-3">
            Métricas del Almacenamiento Local
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-semibold block mb-0.5">Vehículos en Stock</span>
              <span className="text-xl font-black text-slate-900 font-mono">{vehicles.length}</span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-semibold block mb-0.5">Disponibles</span>
              <span className="text-xl font-black text-emerald-700 font-mono">
                {vehicles.filter((v) => v.estado === 'Disponible').length}
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-semibold block mb-0.5">Vendidos / Reservados</span>
              <span className="text-xl font-black text-slate-700 font-mono">
                {vehicles.filter((v) => v.estado !== 'Disponible').length}
              </span>
            </div>
          </div>
        </div>

        {/* 2.5 SINCRONIZACIÓN Y NUBE (FIREBASE / CLOUD FIRESTORE) */}
        <div className="mt-8 pt-5 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Cloud className="w-4 h-4 text-blue-600" />
              <span>Sincronización Multidispositivo (Cloud Firestore)</span>
            </h2>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
              stockService.isUsingCloud()
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {stockService.isUsingCloud() ? 'Nube Activa' : 'Modo Local'}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Sincronice el stock comercial, estados, ventas e historial con Firebase para acceder desde PC laboral, celular o nuevos dispositivos sin perder datos.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {onOpenMigrationModal && (
              <button
                type="button"
                onClick={onOpenMigrationModal}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Asistente de Migración a Firestore</span>
              </button>
            )}

            {onOpenLoginModal && (
              <button
                type="button"
                onClick={onOpenLoginModal}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Gestionar Sesión Firebase</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. RESPALDO Y RESTAURACIÓN */}
        <div className="mt-8 pt-5 border-t border-slate-200 space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
            Copias de Seguridad (Exportar / Importar)
          </h2>
          <p className="text-xs text-slate-500">
            Descargue el stock completo y su historial en formato JSON para transferirlo a otro equipo o conservarlo como copia de resguardo.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={handleExportJson}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-2 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Stock JSON</span>
            </button>

            <label className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition-colors flex items-center gap-2 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Respaldo JSON</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportJson}
                className="hidden"
              />
            </label>

            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer datos de stock iniciales</span>
            </button>
          </div>

          {importMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{importMessage}</span>
            </div>
          )}

          {resetDone && (
            <div className="p-3 rounded-lg bg-blue-50 text-blue-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Stock inicial de Autonet restaurado correctamente.</span>
            </div>
          )}
        </div>

        {/* 4. COMPATIBILIDAD CON GITHUB PAGES */}
        <div className="mt-8 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Despliegue y compatibilidad con GitHub Pages</span>
          </div>
          <p className="leading-relaxed">
            La aplicación está configurada con rutas de assets relativas y flujo automatizado para publicarse en GitHub Pages mediante GitHub Actions (<code className="bg-white px-1.5 py-0.5 rounded border font-mono">.github/workflows/deploy.yml</code>).
          </p>
        </div>
      </div>
    </div>
  );
};
