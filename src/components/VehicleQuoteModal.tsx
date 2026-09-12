import React, { useState, useId } from 'react';
import { 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  Save,
  Share2, 
  AlertCircle,
  Calculator,
  FileText,
  CreditCard,
  Plus,
  Trash2,
  FileCheck2
} from 'lucide-react';
import { Vehicle, ProvinceTransfer } from '../types/stock';
import { dnrpaService } from '../services/dnrpaService';
import { CommercialBudget, FinancingOption, quoteService } from '../services/quoteService';
import { formatCurrency } from '../utils/formatters';
import { ADVISOR_INFO } from '../constants/advisor';
import { BudgetModal } from './BudgetModal';
import { BoletoModal } from './boleto/BoletoModal';

interface VehicleQuoteModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  onUpdateVehicleTableValue?: (vehicleId: string, tableValue: number, province: ProvinceTransfer) => void;
  onOpenBudget?: (budget: CommercialBudget) => void;
}

const COMMON_ENTITIES = ['CREDINET', 'BNA', 'Santander', 'Macro', 'Galicia', 'BBVA'];

export const VehicleQuoteModal: React.FC<VehicleQuoteModalProps> = ({
  vehicle,
  onClose,
  onUpdateVehicleTableValue,
  onOpenBudget,
}) => {
  const tableValueInputId = useId();
  
  // 1. Selector de provincia: Neuquén (4,9%) o Río Negro (5,5%)
  const [province, setProvince] = useState<ProvinceTransfer>(
    (vehicle.provinciaRadicacion as ProvinceTransfer) || 'Neuquén'
  );

  // 2. Valor de tabla DNRPA (precargado si ya existía en la ficha)
  const [tableValueInput, setTableValueInput] = useState<string>(
    vehicle.valorTablaDnrpaEstimado && vehicle.valorTablaDnrpaEstimado > 0 
      ? vehicle.valorTablaDnrpaEstimado.toString() 
      : ''
  );

  // 3. Financiación manual
  const [llevaFinanciacion, setLlevaFinanciacion] = useState(false);
  const [opcionesFinanciacion, setOpcionesFinanciacion] = useState<FinancingOption[]>([
    {
      id: 'opc-1',
      entidad: 'CREDINET',
      montoFinanciado: 0,
      cuotas: 24,
      montoCuota: 0,
      detalle: 'Cuota fija en pesos',
    },
  ]);

  const [copiedPlate, setCopiedPlate] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);
  const [activeBudget, setActiveBudget] = useState<CommercialBudget | null>(null);
  const [isBoletoOpen, setIsBoletoOpen] = useState(false);

  // Parse numérico del valor de tabla ingresado
  const parsedTableValue = Math.max(0, parseInt(tableValueInput.replace(/\D/g, ''), 10) || 0);
  const hasValidTableValue = parsedTableValue > 0;

  // Datos del vehículo
  const vehiclePrice = Math.max(0, vehicle.precio || 0);

  // Base imponible: mayor entre precio de venta y valor de tabla DNRPA
  const baseImponible = Math.max(vehiclePrice, parsedTableValue);
  const alicuota = province === 'Neuquén' ? 4.9 : 5.5;
  const alicuotaLabel = province === 'Neuquén' ? '4,9%' : '5,5%';
  
  // Transferencia estimada calculada solo con valor de tabla válido
  const transferenciaEstimada = hasValidTableValue ? Math.round(baseImponible * (alicuota / 100)) : 0;
  const totalOperacion = vehiclePrice + transferenciaEstimada;

  // Manejo de opciones de financiación manuales
  const handleAddFinancingOption = () => {
    setOpcionesFinanciacion((prev) => [
      ...prev,
      {
        id: `opc-${Date.now()}`,
        entidad: 'BNA',
        montoFinanciado: 0,
        cuotas: 36,
        montoCuota: 0,
        detalle: '',
      },
    ]);
  };

  const handleRemoveFinancingOption = (id: string) => {
    setOpcionesFinanciacion((prev) => prev.filter((o) => o.id !== id));
  };

  const handleUpdateFinancingOption = (id: string, field: keyof FinancingOption, value: any) => {
    setOpcionesFinanciacion((prev) =>
      prev.map((o) => (o.id === id ? { ...o, [field]: value } : o))
    );
  };

  // Copiar patente para agilizar la carga en DNRPA
  const handleCopyPlate = () => {
    navigator.clipboard.writeText(vehicle.patente.trim().toUpperCase());
    setCopiedPlate(true);
    setTimeout(() => setCopiedPlate(false), 1800);
  };

  // Guardar valor de tabla en la ficha del vehículo
  const handleSaveToVehicle = () => {
    if (onUpdateVehicleTableValue && hasValidTableValue) {
      onUpdateVehicleTableValue(vehicle.id, parsedTableValue, province);
      setSavedLocally(true);
      setTimeout(() => setSavedLocally(false), 2500);
    }
  };

  // Generar presupuesto formal formalizando la cotización actual
  const handleGenerateBudget = () => {
    if (onUpdateVehicleTableValue && hasValidTableValue) {
      onUpdateVehicleTableValue(vehicle.id, parsedTableValue, province);
    }

    const validOptions = opcionesFinanciacion.filter((o) => o.montoCuota > 0 && o.entidad.trim());

    const newBudget = quoteService.createBudget({
      vehicle,
      dnrpaTableValue: parsedTableValue,
      province,
      financiacion: llevaFinanciacion && validOptions.length > 0
        ? {
            llevaFinanciacion: true,
            opciones: validOptions,
          }
        : undefined,
    });

    if (onOpenBudget) {
      onOpenBudget(newBudget);
    } else {
      setActiveBudget(newBudget);
    }
  };

  // Copiar resumen al portapapeles para WhatsApp con firma fija del asesor
  const handleCopyShare = () => {
    if (!hasValidTableValue) return;

    const validOptions = opcionesFinanciacion.filter((o) => o.montoCuota > 0 && o.entidad.trim());

    let summary = `🚗 *COTIZACIÓN DE TRANSFERENCIA*
*Vehículo:* ${vehicle.marca} ${vehicle.modelo} ${vehicle.version} (${vehicle.anio})
*Patente:* ${vehicle.patente}
*Provincia:* ${province}

━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 PRECIO DE VENTA: ${formatCurrency(vehiclePrice)}
📋 VALOR DE TABLA DNRPA: ${formatCurrency(parsedTableValue)}
📊 VALOR BASE PARA TRANSFERENCIA: ${formatCurrency(baseImponible)}
🏛️ ALÍCUOTA: ${alicuotaLabel} (${province})
📄 TRANSFERENCIA ESTIMADA: ${formatCurrency(transferenciaEstimada)}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🏁 TOTAL ESTIMADO OPERACIÓN: ${formatCurrency(totalOperacion)}
`;

    if (llevaFinanciacion && validOptions.length > 0) {
      summary += `\n🏦 *OPCIONES DE FINANCIACIÓN:*\n`;
      validOptions.forEach((opc) => {
        const cuotaStr = formatCurrency(opc.montoCuota);
        const det = opc.detalle ? ` (${opc.detalle})` : '';
        summary += `• ${opc.entidad}: ${opc.cuotas} cuotas de ${cuotaStr}${det}\n`;
      });
    }

    summary += `\n_Aviso: La transferencia se calcula sobre el mayor valor entre el precio de venta y el valor de tabla DNRPA. El importe es estimativo y puede variar según los costos y conceptos aplicables al momento de realizar la transferencia en el Registro Seccional correspondiente._
_Presupuesto válido por 24 horas._

━━━━━━━━━━━━━━━━━━━━━━━━━━
${ADVISOR_INFO.nombre} | ${ADVISOR_INFO.cargo}
📞 ${ADVISOR_INFO.telefono}
📍 ${ADVISOR_INFO.direccion}, ${ADVISOR_INFO.ciudad}, ${ADVISOR_INFO.provincia}, ${ADVISOR_INFO.pais}`;

    navigator.clipboard.writeText(summary);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2200);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Cabecera Principal - Estilo Autonet */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-widest text-blue-400">AUTONET</span>
                <span className="text-[11px] text-slate-400 font-medium">• Cotizador</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5">
                COTIZACIÓN DE TRANSFERENCIA
              </h2>
            </div>

            <button
              id="close-quote-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Cerrar cotización"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenido */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
            
            {/* 1. Información del Vehículo */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-sm space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vehículo:</span>
                <span className="font-extrabold text-slate-900 text-sm sm:text-right">
                  {vehicle.marca} {vehicle.modelo} {vehicle.version} ({vehicle.anio})
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Patente:</span>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-slate-900 text-white font-mono text-xs font-bold tracking-widest">
                    {vehicle.patente}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPlate}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                    title="Copiar patente"
                  >
                    {copiedPlate ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPlate ? 'Copiada' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Precio de venta:</span>
                <span className="font-black font-mono text-slate-900 text-base">
                  {formatCurrency(vehiclePrice, vehicle.moneda)}
                </span>
              </div>

              {/* 2. Selector de Provincia */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Provincia de radicación:</span>
                <div className="inline-flex rounded-lg p-0.5 bg-slate-200">
                  <button
                    type="button"
                    id="quote-province-neuquen"
                    onClick={() => setProvince('Neuquén')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      province === 'Neuquén'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    Neuquén (4,9%)
                  </button>
                  <button
                    type="button"
                    id="quote-province-rionegro"
                    onClick={() => setProvince('Río Negro')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      province === 'Río Negro'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    Río Negro (5,5%)
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Botón Principal: ABRIR DNRPA */}
            <a
              href={dnrpaService.OFFICIAL_ESTIMATOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              id="btn-abrir-dnrpa"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-xs shadow-xs transition-colors group"
            >
              <span>ABRIR ESTIMADOR OFICIAL DNRPA</span>
              <ExternalLink className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
            </a>

            {/* 4. Campo: VALOR DE TABLA DNRPA */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={tableValueInputId} className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  VALOR DE TABLA DNRPA
                </label>
                {onUpdateVehicleTableValue && hasValidTableValue && (
                  <button
                    type="button"
                    onClick={handleSaveToVehicle}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                  >
                    {savedLocally ? <Check className="w-3 h-3 text-emerald-600" /> : <Save className="w-3 h-3" />}
                    <span>{savedLocally ? 'Guardado en ficha' : 'Guardar en ficha'}</span>
                  </button>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-base">
                  $
                </span>
                <input
                  id={tableValueInputId}
                  type="text"
                  inputMode="numeric"
                  value={tableValueInput ? new Intl.NumberFormat('es-AR').format(parsedTableValue) : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setTableValueInput(raw);
                  }}
                  placeholder="Ingrese el valor obtenido de la tabla DNRPA"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 text-base focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-hidden bg-white"
                />
              </div>
            </div>

            {/* 5. CÁLCULO AUTOMÁTICO */}
            {hasValidTableValue ? (
              <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 space-y-3 shadow-md">
                <div className="divide-y divide-slate-800 text-xs">
                  
                  {/* PRECIO DE VENTA */}
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-400 font-medium">PRECIO DE VENTA</span>
                    <span className="font-bold font-mono text-white text-sm">
                      {formatCurrency(vehiclePrice)}
                    </span>
                  </div>

                  {/* VALOR DE TABLA DNRPA */}
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-400 font-medium">VALOR DE TABLA DNRPA</span>
                    <span className="font-bold font-mono text-white text-sm">
                      {formatCurrency(parsedTableValue)}
                    </span>
                  </div>

                  {/* VALOR BASE PARA TRANSFERENCIA */}
                  <div className="py-2.5 flex items-center justify-between bg-slate-800/60 -mx-2 px-2 rounded-lg">
                    <div>
                      <span className="text-blue-300 font-bold block">VALOR BASE PARA TRANSFERENCIA</span>
                      <span className="text-[10px] text-slate-400">
                        {parsedTableValue > vehiclePrice 
                          ? 'Base: Valor de tabla DNRPA (mayor)' 
                          : 'Base: Precio de venta (mayor o igual)'}
                      </span>
                    </div>
                    <span className="font-black font-mono text-blue-400 text-base sm:text-lg">
                      {formatCurrency(baseImponible)}
                    </span>
                  </div>

                  {/* ALÍCUOTA */}
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-400 font-medium">ALÍCUOTA ({province})</span>
                    <span className="font-bold font-mono text-emerald-400 text-sm">
                      {alicuotaLabel}
                    </span>
                  </div>

                  {/* TRANSFERENCIA ESTIMADA */}
                  <div className="py-3 flex items-center justify-between">
                    <span className="text-white font-extrabold text-sm uppercase tracking-wide">
                      TRANSFERENCIA ESTIMADA
                    </span>
                    <span className="font-black font-mono text-emerald-400 text-xl sm:text-2xl">
                      {formatCurrency(transferenciaEstimada)}
                    </span>
                  </div>
                </div>

                {/* Explicación breve requerida */}
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
                  <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    La transferencia se calcula sobre el mayor valor entre el precio de venta y el valor de tabla DNRPA.
                  </span>
                </div>

                {/* Total Estimado de la Operación */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold block">
                      TOTAL ESTIMADO OPERACIÓN
                    </span>
                    <span className="text-[10px] text-slate-500">Vehículo + Transferencia</span>
                  </div>
                  <span className="text-lg sm:text-xl font-black font-mono text-white">
                    {formatCurrency(totalOperacion)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center space-y-1.5">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Calculator className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-slate-700">
                  Ingrese el valor de tabla DNRPA para calcular la transferencia
                </p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Presione <strong>ABRIR ESTIMADOR OFICIAL DNRPA</strong>, consulte la valuación oficial e ingrese el importe en el casillero superior.
                </p>
              </div>
            )}

            {/* 6. MÓDULO DE FINANCIACIÓN MANUAL (Requisito Clave) */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span className="font-extrabold text-slate-800 uppercase tracking-wider">
                    ¿LLEVA FINANCIACIÓN?
                  </span>
                </div>

                <div className="inline-flex rounded-lg p-0.5 bg-slate-200">
                  <button
                    type="button"
                    onClick={() => setLlevaFinanciacion(false)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      !llevaFinanciacion
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    NO
                  </button>
                  <button
                    type="button"
                    onClick={() => setLlevaFinanciacion(true)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      llevaFinanciacion
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    SÍ
                  </button>
                </div>
              </div>

              {llevaFinanciacion && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="text-[11px] text-slate-500 italic">
                    Carga manual de cuotas sin cálculo automático de intereses ni fórmulas ocultas.
                  </div>

                  {opcionesFinanciacion.map((opc, idx) => (
                    <div
                      key={opc.id}
                      className="bg-white rounded-lg p-3 border border-slate-200 shadow-xs space-y-2 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-[11px] uppercase">
                          Alternativa #{idx + 1}
                        </span>
                        {opcionesFinanciacion.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFinancingOption(opc.id)}
                            className="text-red-500 hover:text-red-700 p-1 rounded"
                            title="Eliminar opción"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                        {/* Entidad */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5 uppercase">
                            Entidad
                          </label>
                          <input
                            type="text"
                            value={opc.entidad}
                            onChange={(e) => handleUpdateFinancingOption(opc.id, 'entidad', e.target.value)}
                            placeholder="Ej. CREDINET, BNA"
                            className="w-full px-2 py-1.5 rounded-md border border-slate-300 text-xs font-semibold uppercase"
                          />
                          <div className="flex flex-wrap gap-1 mt-1">
                            {COMMON_ENTITIES.slice(0, 3).map((ent) => (
                              <button
                                key={ent}
                                type="button"
                                onClick={() => handleUpdateFinancingOption(opc.id, 'entidad', ent)}
                                className={`text-[9px] px-1.5 py-0.5 rounded border ${
                                  opc.entidad === ent
                                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold'
                                    : 'bg-slate-50 border-slate-200 text-slate-600'
                                }`}
                              >
                                {ent}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Monto Financiado */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5 uppercase">
                            Monto Financiado ($)
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={opc.montoFinanciado && opc.montoFinanciado > 0 ? new Intl.NumberFormat('es-AR').format(opc.montoFinanciado) : ''}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, '');
                              handleUpdateFinancingOption(opc.id, 'montoFinanciado', raw ? Number(raw) : 0);
                            }}
                            placeholder="Ej. 10.000.000"
                            className="w-full px-2 py-1.5 rounded-md border border-slate-300 text-xs font-mono font-bold text-blue-900 bg-white"
                          />
                        </div>

                        {/* Cuotas */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5 uppercase">
                            Cantidad de Cuotas
                          </label>
                          <select
                            value={opc.cuotas}
                            onChange={(e) => handleUpdateFinancingOption(opc.id, 'cuotas', Number(e.target.value))}
                            className="w-full px-2 py-1.5 rounded-md border border-slate-300 text-xs font-semibold bg-white"
                          >
                            <option value={12}>12 cuotas</option>
                            <option value={18}>18 cuotas</option>
                            <option value={24}>24 cuotas</option>
                            <option value={36}>36 cuotas</option>
                            <option value={48}>48 cuotas</option>
                            <option value={60}>60 cuotas</option>
                          </select>
                        </div>

                        {/* Monto de Cuota */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5 uppercase">
                            Monto por Cuota ($)
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={opc.montoCuota > 0 ? new Intl.NumberFormat('es-AR').format(opc.montoCuota) : ''}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, '');
                              handleUpdateFinancingOption(opc.id, 'montoCuota', raw ? Number(raw) : 0);
                            }}
                            placeholder="Ej. 350.000"
                            className="w-full px-2 py-1.5 rounded-md border border-slate-300 text-xs font-mono font-bold text-slate-900"
                          />
                        </div>
                      </div>

                      {/* Detalle opcional */}
                      <div>
                        <input
                          type="text"
                          value={opc.detalle || ''}
                          onChange={(e) => handleUpdateFinancingOption(opc.id, 'detalle', e.target.value)}
                          placeholder="Observación opcional (ej. Cuota fija en pesos, Tasa anual especial)"
                          className="w-full px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-600"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddFinancingOption}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-blue-700 font-bold text-[11px] transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar otra alternativa de financiación</span>
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Footer con Acciones */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {/* Botón GENERAR PRESUPUESTO */}
              <button
                type="button"
                id="btn-generar-presupuesto"
                onClick={handleGenerateBudget}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs transition-colors shadow-xs"
              >
                <FileText className="w-4 h-4" />
                <span>GENERAR PRESUPUESTO</span>
              </button>

              {/* Botón GENERAR BOLETO */}
              <button
                type="button"
                id="btn-quote-generar-boleto"
                onClick={() => setIsBoletoOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-xs transition-colors shadow-xs cursor-pointer"
                title="Generar Boleto Oficial Autonet de 2 páginas"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>GENERAR BOLETO</span>
              </button>

              {hasValidTableValue && (
                <button
                  type="button"
                  onClick={handleCopyShare}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
                >
                  {copiedShare ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-slate-300" />}
                  <span>{copiedShare ? '¡Copiado!' : 'Copiar WhatsApp'}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors"
            >
              Cerrar
            </button>
          </div>

        </div>
      </div>

      {/* Modal de Presupuesto Formal si está activo */}
      {activeBudget && (
        <BudgetModal
          budget={activeBudget}
          onClose={() => setActiveBudget(null)}
        />
      )}

      {/* Modal de Boleto de Compraventa Oficial */}
      {isBoletoOpen && (
        <BoletoModal
          isOpen={isBoletoOpen}
          onClose={() => setIsBoletoOpen(false)}
          vehicle={vehicle}
          budget={activeBudget || quoteService.createBudget({
            vehicle,
            dnrpaTableValue: parsedTableValue,
            province,
            financiacion: llevaFinanciacion
              ? {
                  llevaFinanciacion: true,
                  opciones: opcionesFinanciacion.filter((o) => o.montoCuota > 0),
                }
              : undefined,
          })}
          financingAlternatives={llevaFinanciacion ? opcionesFinanciacion.filter((o) => o.montoCuota > 0) : []}
        />
      )}
    </>
  );
};

