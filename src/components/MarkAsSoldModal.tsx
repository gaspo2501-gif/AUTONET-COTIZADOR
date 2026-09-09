import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  UserCheck, 
  Users, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  RotateCcw,
  FileText
} from 'lucide-react';
import { Vehicle, SaleOwner } from '../types/stock';
import { formatCurrency } from '../utils/formatters';

interface MarkAsSoldModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  onConfirm: (options: {
    saleOwner: 'self' | 'other';
    soldAt?: string;
    soldPrice?: number;
    observaciones?: string;
  }) => void;
  onRevert?: (id: string) => void;
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
  const [soldPrice, setSoldPrice] = useState<number>(
    vehicle.soldPrice ?? vehicle.precio ?? 0
  );
  const [observaciones, setObservaciones] = useState<string>('');
  const [confirmRevert, setConfirmRevert] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      saleOwner,
      soldAt,
      soldPrice: Number(soldPrice) || vehicle.precio,
      observaciones: observaciones.trim() || undefined,
    });
    onClose();
  };

  const handleRevert = () => {
    if (onRevert) {
      onRevert(vehicle.id);
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
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
      >
        {/* Cabecera */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
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
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido del Formulario */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          
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
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  saleOwner === 'self'
                    ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
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
                  <div className="font-bold text-slate-900 text-sm">Vendida por mí</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Suma a tus ventas personales y comisiones
                  </div>
                </div>
              </button>

              {/* Opción B: Vendida por otro */}
              <button
                type="button"
                id="btn-venta-otro"
                onClick={() => setSaleOwner('other')}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  saleOwner === 'other'
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
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
                  <div className="font-bold text-slate-900 text-sm">Otro vendedor / Canal</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Vendida por un compañero o sucursal
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

          {/* Precio de Venta / Cierre */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                <span>Precio de venta / cierre ({vehicle.moneda}) *</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                Lista: {formatCurrency(vehicle.precio, vehicle.moneda)}
              </span>
            </div>
            <input
              type="number"
              id="input-precio-venta"
              required
              min={0}
              step={1000}
              value={soldPrice}
              onChange={(e) => setSoldPrice(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono font-bold text-base focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Observaciones opcionales */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Notas de la operación (opcional)</span>
            </label>
            <textarea
              rows={2}
              id="input-notas-venta"
              placeholder="Ej: Cliente Juan Pérez, seña 10%, entrega estimada..."
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
                  className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 font-semibold hover:underline"
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
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                    >
                      Sí, reactivar a Disponible
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRevert(false)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-xs"
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
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-confirmar-venta"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-1.5"
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
