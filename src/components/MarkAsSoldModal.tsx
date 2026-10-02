import React, { useState, useMemo } from 'react';
import { 
  X, 
  CheckCircle2, 
  UserCheck, 
  Users, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  RotateCcw, 
  FileText,
  Percent,
  Flame,
  CreditCard,
  CarFront
} from 'lucide-react';
import { Vehicle } from '../types/stock';
import { CommissionIvaRate } from '../types/commissions';
import { formatCurrency } from '../utils/formatters';
import { calculateBaseCommission, calculateTradeInCommission } from '../services/commissionService';

interface MarkAsSoldModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  onConfirm: (options: {
    saleOwner: 'self' | 'other';
    soldAt?: string;
    soldPrice?: number;
    observaciones?: string;
    precioRealVenta?: number;
    ivaVenta?: CommissionIvaRate;
    comisionBaseCalculada?: number;
    esCritico?: boolean;
    usaCredinet?: boolean;
    tieneTomaUsado?: boolean;
    valorTomaUsado?: number;
    ivaTomaUsado?: CommissionIvaRate;
    comisionTomaCalculada?: number;
    marcaModeloTomaUsado?: string;
    patenteTomaUsado?: string;
    fechaFacturacion?: string;
  }) => void;
  onRevert?: (vehicleOrPatent: Vehicle | string) => void;
}

export const MarkAsSoldModal: React.FC<MarkAsSoldModalProps> = ({
  vehicle,
  onClose,
  onConfirm,
  onRevert,
}) => {
  const isAlreadySold = vehicle.estado === 'Vendido';
  const todayStr = new Date().toISOString().split('T')[0];

  const [saleOwner, setSaleOwner] = useState<'self' | 'other'>(
    vehicle.saleOwner === 'other' ? 'other' : 'self'
  );
  const [soldAt, setSoldAt] = useState<string>(
    vehicle.soldAt ? vehicle.soldAt.slice(0, 10) : todayStr
  );
  const [fechaFacturacion, setFechaFacturacion] = useState<string>(
    vehicle.fechaFacturacion ? vehicle.fechaFacturacion.slice(0, 10) : ''
  );
  
  // Precio real de venta
  const initialPrice = vehicle.precioRealVenta ?? vehicle.soldPrice ?? vehicle.precio ?? 0;
  const [precioRealVenta, setPrecioRealVenta] = useState<number>(initialPrice);
  const [ivaVenta, setIvaVenta] = useState<CommissionIvaRate>(vehicle.ivaVenta ?? 21);

  // Conceptos comerciales
  const [esCritico, setEsCritico] = useState<boolean>(vehicle.esCritico ?? false);
  const [usaCredinet, setUsaCredinet] = useState<boolean>(vehicle.usaCredinet ?? false);
  const [tieneTomaUsado, setTieneTomaUsado] = useState<boolean>(vehicle.tieneTomaUsado ?? false);

  // Toma de usado
  const [valorTomaUsado, setValorTomaUsado] = useState<number>(vehicle.valorTomaUsado ?? 0);
  const [ivaTomaUsado, setIvaTomaUsado] = useState<CommissionIvaRate>(vehicle.ivaTomaUsado ?? 21);
  const [marcaModeloTomaUsado, setMarcaModeloTomaUsado] = useState<string>(vehicle.marcaModeloTomaUsado ?? '');
  const [patenteTomaUsado, setPatenteTomaUsado] = useState<string>(vehicle.patenteTomaUsado ?? '');

  const [observaciones, setObservaciones] = useState<string>('');
  const [confirmRevert, setConfirmRevert] = useState<boolean>(false);

  // Cálculos en vivo
  const comisionBaseEstimada = useMemo(() => {
    return calculateBaseCommission(precioRealVenta, ivaVenta);
  }, [precioRealVenta, ivaVenta]);

  const comisionTomaEstimada = useMemo(() => {
    if (!tieneTomaUsado) return 0;
    return calculateTradeInCommission(valorTomaUsado, ivaTomaUsado);
  }, [tieneTomaUsado, valorTomaUsado, ivaTomaUsado]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const safePrecioVenta = Math.max(0, Number(precioRealVenta) || 0);
    const safeValorToma = tieneTomaUsado ? Math.max(0, Number(valorTomaUsado) || 0) : 0;
    const calcBase = calculateBaseCommission(safePrecioVenta, ivaVenta);
    const calcToma = tieneTomaUsado ? calculateTradeInCommission(safeValorToma, ivaTomaUsado) : 0;

    onConfirm({
      saleOwner,
      soldAt,
      soldPrice: safePrecioVenta,
      precioRealVenta: safePrecioVenta,
      ivaVenta,
      comisionBaseCalculada: calcBase,
      esCritico,
      usaCredinet,
      tieneTomaUsado,
      valorTomaUsado: tieneTomaUsado ? safeValorToma : undefined,
      ivaTomaUsado: tieneTomaUsado ? ivaTomaUsado : undefined,
      comisionTomaCalculada: tieneTomaUsado ? calcToma : undefined,
      marcaModeloTomaUsado: tieneTomaUsado ? (marcaModeloTomaUsado.trim() || undefined) : undefined,
      patenteTomaUsado: tieneTomaUsado ? (patenteTomaUsado.trim().toUpperCase() || undefined) : undefined,
      fechaFacturacion: fechaFacturacion.trim() || undefined,
      observaciones: observaciones.trim() || undefined,
    });
    onClose();
  };

  const handleRevert = () => {
    if (onRevert) {
      onRevert(vehicle);
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        id="modal-registro-venta"
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
      >
        {/* Cabecera */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {isAlreadySold ? 'Modificar Registro de Venta' : 'Registrar Venta de Unidad'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5">
                <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                  {vehicle.patente}
                </span>
                <span>{vehicle.marca} {vehicle.modelo}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido del Formulario */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          
          {/* Selector de Canal / Asignación de Venta */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              ¿Quién concretó la venta? *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Opción A: Vendida por mí */}
              <button
                type="button"
                id="btn-venta-propia"
                onClick={() => setSaleOwner('self')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  saleOwner === 'self'
                    ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    saleOwner === 'self' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    saleOwner === 'self' ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-100 text-slate-500'
                  }`}>
                    Mi Venta
                  </span>
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm">Vendida por mí</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Suma a tus comisiones y premios
                  </div>
                </div>
              </button>

              {/* Opción B: Vendida por otro */}
              <button
                type="button"
                id="btn-venta-otro"
                onClick={() => setSaleOwner('other')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  saleOwner === 'other'
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    saleOwner === 'other' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    saleOwner === 'other' ? 'bg-indigo-200 text-indigo-900' : 'bg-slate-100 text-slate-500'
                  }`}>
                    Otro Vendedor
                  </span>
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm">Otro vendedor / Canal</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Vendida por un compañero
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Fecha de Venta */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Fecha de la operación *</span>
            </label>
            <input
              type="date"
              id="input-fecha-venta"
              required
              value={soldAt}
              onChange={(e) => setSoldAt(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
            />
          </div>

          {/* Precio Real de Venta & Alícuota IVA */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                  <span>Precio Real de Venta *</span>
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  Lista: {formatCurrency(vehicle.precio, vehicle.moneda)}
                </span>
              </div>
              <input
                type="number"
                id="input-precio-real-venta"
                required
                min={0}
                step={1000}
                value={precioRealVenta || ''}
                onChange={(e) => setPrecioRealVenta(Number(e.target.value))}
                placeholder="Ej: 30000000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono font-bold text-base focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* IVA de la Operación */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-slate-500" />
                <span>IVA de la Operación:</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIvaVenta(21)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ivaVenta === 21
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  21% (Estándar)
                </button>
                <button
                  type="button"
                  onClick={() => setIvaVenta(10.5)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ivaVenta === 10.5
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  10,5%
                </button>
              </div>
            </div>

            {/* Preview Comisión Base */}
            {saleOwner === 'self' && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                <span className="text-slate-600 font-medium">Comisión Base (1% sin IVA):</span>
                <span className="font-mono font-extrabold text-blue-700 text-sm">
                  {formatCurrency(comisionBaseEstimada)}
                </span>
              </div>
            )}
          </div>

          {/* Opciones Comerciales para Objetivos / Premios */}
          <div className="space-y-2.5 pt-1">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Conceptos para Premios
            </div>

            {/* 1. Crítico */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Vehículo Crítico</div>
                  <div className="text-[11px] text-slate-500">Unidad designada como crítica</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEsCritico(false)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                    !esCritico ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setEsCritico(true)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                    esCritico ? 'bg-amber-500 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Sí
                </button>
              </div>
            </div>

            {/* 2. Credinet / Wunder */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Credinet / Wunder</div>
                  <div className="text-[11px] text-slate-500">Operación con financiación comercial</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setUsaCredinet(false)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                    !usaCredinet ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setUsaCredinet(true)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                    usaCredinet ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Sí
                </button>
              </div>
            </div>

            {/* 3. Toma de Usado */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <CarFront className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Toma de Usado</div>
                  <div className="text-[11px] text-slate-500">¿Recibe vehículo usado como parte de pago?</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTieneTomaUsado(false)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                    !tieneTomaUsado ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setTieneTomaUsado(true)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                    tieneTomaUsado ? 'bg-teal-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Sí
                </button>
              </div>
            </div>
          </div>

          {/* Subformulario: Detalle de Toma de Usado */}
          {tieneTomaUsado && (
            <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CarFront className="w-3.5 h-3.5 text-teal-700" />
                  <span>Datos del Usado Tomado</span>
                </span>
                <span className="text-[10px] bg-teal-200 text-teal-900 px-2 py-0.5 rounded-full font-bold">
                  Comisión: 0,5%
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-teal-900 mb-1">
                  Valor de Toma ($) *
                </label>
                <input
                  type="number"
                  required={tieneTomaUsado}
                  min={0}
                  step={1000}
                  value={valorTomaUsado || ''}
                  onChange={(e) => setValorTomaUsado(Number(e.target.value))}
                  placeholder="Ej: 20000000"
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-teal-300 text-slate-900 font-mono font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-teal-900">
                  IVA del Usado:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIvaTomaUsado(21)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      ivaTomaUsado === 21
                        ? 'bg-teal-700 text-white'
                        : 'bg-white border border-teal-200 text-teal-900'
                    }`}
                  >
                    21%
                  </button>
                  <button
                    type="button"
                    onClick={() => setIvaTomaUsado(10.5)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      ivaTomaUsado === 10.5
                        ? 'bg-teal-700 text-white'
                        : 'bg-white border border-teal-200 text-teal-900'
                    }`}
                  >
                    10,5%
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-teal-900 mb-1">
                    Marca / Modelo (opcional)
                  </label>
                  <input
                    type="text"
                    value={marcaModeloTomaUsado}
                    onChange={(e) => setMarcaModeloTomaUsado(e.target.value)}
                    placeholder="Ej: Toyota Hilux SRV"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-teal-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-teal-900 mb-1">
                    Patente (opcional)
                  </label>
                  <input
                    type="text"
                    value={patenteTomaUsado}
                    onChange={(e) => setPatenteTomaUsado(e.target.value.toUpperCase())}
                    placeholder="Ej: AE 123 CD"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-teal-300 text-slate-900 uppercase font-mono font-bold"
                  />
                </div>
              </div>

              {saleOwner === 'self' && (
                <div className="flex items-center justify-between text-xs pt-2 border-t border-teal-200 text-teal-900">
                  <span className="font-semibold">Comisión por Toma (0,5% sin IVA):</span>
                  <span className="font-mono font-extrabold text-teal-800 text-sm">
                    {formatCurrency(comisionTomaEstimada)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Observaciones opcionales */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Notas de la operación (opcional)</span>
            </label>
            <textarea
              rows={2}
              id="input-notas-venta"
              placeholder="Ej: Seña 10%, entrega estimada, toma pactada..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Si ya estaba vendida: opción de corregir y revertir a Disponible */}
          {isAlreadySold && onRevert && (
            <div className="pt-2 border-t border-slate-100">
              {!confirmRevert ? (
                <button
                  type="button"
                  onClick={() => setConfirmRevert(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 font-semibold hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>¿Error? Revertir venta y volver a marcar como Disponible</span>
                </button>
              ) : (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800">
                    <AlertCircle className="w-4 h-4" />
                    <span>Confirmar anulación de venta</span>
                  </div>
                  <p className="text-rose-700">
                    La unidad volverá a figurar como Disponible y se eliminará de las estadísticas de ventas.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleRevert}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
                    >
                      Sí, reactivar a Disponible
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRevert(false)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-confirmar-venta"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{isAlreadySold ? 'Guardar Cambios' : 'Confirmar Venta'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
