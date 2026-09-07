import React, { useState } from 'react';
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
  FileUp
} from 'lucide-react';
import { stockService } from '../services/stockService';
import { quoteService, AdvisorSettings, CommercialBudget } from '../services/quoteService';
import { Vehicle } from '../types/stock';
import { formatCurrency } from '../utils/formatters';
import { BudgetModal } from './BudgetModal';

interface FutureModulesViewProps {
  type: 'cotizaciones' | 'presupuestos' | 'configuracion';
  vehicles: Vehicle[];
  onStockReset: () => void;
  onQuoteVehicle?: (vehicle: Vehicle) => void;
  onGoToUpdateStock?: () => void;
}

export const FutureModulesView: React.FC<FutureModulesViewProps> = ({
  type,
  vehicles,
  onStockReset,
  onQuoteVehicle,
  onGoToUpdateStock,
}) => {
  const [resetDone, setResetDone] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Configuración del Asesor Comercial
  const [advisorSettings, setAdvisorSettings] = useState<AdvisorSettings>(() => quoteService.getAdvisorSettings());
  const [advisorSavedMessage, setAdvisorSavedMessage] = useState(false);

  // Historial de Presupuestos
  const [budgetList, setBudgetList] = useState<CommercialBudget[]>(() => quoteService.getBudgetHistory());
  const [selectedBudgetToView, setSelectedBudgetToView] = useState<CommercialBudget | null>(null);

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
    a.download = `autonet_stock_backup_${new Date().toISOString().slice(0, 10)}.json`;
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

  // VISTA 1: COTIZACIONES
  if (type === 'cotizaciones') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <Calculator className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-extrabold text-slate-900">
                Cotizador de Transferencia DNRPA
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Calcule costos de transferencia estimativos para cualquier vehículo disponible según su valor de tabla oficial.
              </p>
            </div>

            <a
              href="https://www2.jus.gov.ar/dnrpa-site/#!/estimador"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shrink-0"
            >
              <span>Abrir Estimador DNRPA</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
            </a>
          </div>

          {/* Reglas de cálculo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-5">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
              <span className="font-extrabold text-slate-800 block mb-1">
                Alícuotas Oficiales
              </span>
              <p className="text-slate-600 leading-relaxed">
                • Neuquén: <strong>4,9%</strong> sobre la base imponible.<br />
                • Río Negro: <strong>5,5%</strong> sobre la base imponible.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
              <span className="font-extrabold text-slate-800 block mb-1">
                Base Imponible Obligatoria
              </span>
              <p className="text-slate-600 leading-relaxed">
                El cálculo se realiza siempre sobre el <strong>mayor valor</strong> entre el precio de venta y el valor de tabla DNRPA.
              </p>
            </div>
          </div>

          {/* Selector de vehículos del stock para cotizar */}
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Seleccionar unidad de stock para cotizar
                </h2>
                <p className="text-xs text-slate-500">
                  {vehicles.filter(v => v.estado === 'Disponible').length} unidades disponibles
                </p>
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por patente, marca o modelo..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-slate-50"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-96 overflow-y-auto bg-slate-50">
              {vehicles
                .filter((v) => {
                  if (v.estado === 'Vendido') return false;
                  if (!searchFilter.trim()) return true;
                  const q = searchFilter.toLowerCase();
                  return (
                    v.patente.toLowerCase().includes(q) ||
                    v.marca.toLowerCase().includes(q) ||
                    v.modelo.toLowerCase().includes(q)
                  );
                })
                .slice(0, 20)
                .map((v) => (
                  <div key={v.id} className="p-3 flex items-center justify-between hover:bg-white transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-8 bg-slate-200 rounded overflow-hidden flex items-center justify-center shrink-0">
                        {v.fotos && v.fotos.length > 0 ? (
                          <img src={v.fotos[0]} alt={v.modelo} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] font-bold text-slate-500">AUT</span>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          {v.marca} {v.modelo} {v.version} ({v.anio})
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Patente: <strong className="text-slate-800">{v.patente}</strong> • {formatCurrency(v.precio, v.moneda)}
                        </div>
                      </div>
                    </div>

                    {onQuoteVehicle && (
                      <button
                        onClick={() => onQuoteVehicle(v)}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>Cotizar</span>
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // VISTA 2: PRESUPUESTOS
  if (type === 'presupuestos') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <FileText className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-extrabold text-slate-900">
                Presupuestos Comerciales Autonet
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Emisión de presupuestos formales limpios (sin fotografías, validez de 24 horas) para imprimir o enviar por WhatsApp.
              </p>
            </div>

            <div className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium flex items-center gap-1.5 self-start sm:self-auto">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Validez estricta: 24 horas</span>
            </div>
          </div>

          {/* Listado de presupuestos emitidos */}
          <div className="mt-6 space-y-4">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Historial de Presupuestos Emitidos
            </h2>

            {budgetList.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No hay presupuestos emitidos aún</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  Seleccione cualquier vehículo en el Stock o en Cotizaciones y presione <strong>"GENERAR PRESUPUESTO"</strong> para crear uno al instante.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs">
                {budgetList.map((budget) => {
                  const isExpired = new Date(budget.fechaVencimiento).getTime() < Date.now();
                  return (
                    <div key={budget.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{budget.numeroPresupuesto}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            isExpired ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isExpired ? 'Vencido (24hs)' : 'Vigente'}
                          </span>
                        </div>
                        <div className="font-bold text-slate-800 text-sm mt-0.5">
                          {budget.vehiculo.marca} {budget.vehiculo.modelo} {budget.vehiculo.version} ({budget.vehiculo.anio})
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          Patente: <strong className="text-slate-700">{budget.vehiculo.patente}</strong> • Total:{' '}
                          <strong className="text-slate-900 font-mono">{formatCurrency(budget.totalEstimado)}</strong>
                          {budget.datosCliente.nombre && ` • Cliente: ${budget.datosCliente.nombre}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setSelectedBudgetToView(budget)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Ver Presupuesto</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal si se selecciona ver un presupuesto */}
        {selectedBudgetToView && (
          <BudgetModal
            budget={selectedBudgetToView}
            onClose={() => setSelectedBudgetToView(null)}
          />
        )}
      </div>
    );
  }

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
