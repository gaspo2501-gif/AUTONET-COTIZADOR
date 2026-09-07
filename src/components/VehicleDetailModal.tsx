import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Calculator, 
  Calendar, 
  Gauge, 
  Fuel, 
  Tag,
  Building2,
  Share2,
  Check
} from 'lucide-react';
import { Vehicle, VehicleStatus, ProvinceTransfer } from '../types/stock';
import { formatCurrency, formatKm } from '../utils/formatters';
import { getSituacionOperativaInfo, getEmpresaBadgeClass } from '../utils/autonetHelpers';
import { quoteService } from '../services/quoteService';
import { VehicleQuoteModal } from './VehicleQuoteModal';

interface VehicleDetailModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onStatusChange: (id: string, newStatus: VehicleStatus) => void;
  onOpenQuote?: (vehicle: Vehicle) => void;
  onUpdateVehicleTableValue?: (vehicleId: string, tableValue: number, province: ProvinceTransfer) => void;
}

export const VehicleDetailModal: React.FC<VehicleDetailModalProps> = ({
  vehicle,
  onClose,
  onStatusChange,
  onOpenQuote,
  onUpdateVehicleTableValue,
}) => {
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  if (!vehicle) return null;

  const hasValidAutonetUrl = Boolean(
    vehicle.urlAutonetOriginal && vehicle.urlAutonetOriginal.startsWith('http')
  );

  const ubInfo = getSituacionOperativaInfo(vehicle.ubicacion);

  const handleCopyShare = () => {
    const text = quoteService.formatVehicleShareMessage(vehicle);
    navigator.clipboard.writeText(text);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  const handleOpenQuoteModal = () => {
    if (onOpenQuote) {
      onOpenQuote(vehicle);
    } else {
      setIsQuoteModalOpen(true);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Cabecera Modal */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-md bg-slate-900 text-white font-mono text-sm font-bold tracking-widest shadow-xs">
                {vehicle.patente}
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {vehicle.marca} {vehicle.modelo}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {vehicle.version} • {vehicle.anio} • ID: {vehicle.id}
                </p>
              </div>
            </div>

            <button
              id="close-vehicle-modal-btn"
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cuerpo del Modal scrollable (Sin fotos, limpio y ordenado) */}
          <div className="p-6 overflow-y-auto space-y-6">
            
            {/* Banner de Estado y Precio */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 text-white">
              <div>
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
                  Precio de venta
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                  {formatCurrency(vehicle.precio, vehicle.moneda)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Estado actual:</span>
                {vehicle.estado === 'Disponible' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    Disponible
                  </span>
                )}
                {vehicle.estado === 'Reservado' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs">
                    <AlertCircle className="w-4 h-4" />
                    Reservado
                  </span>
                )}
                {vehicle.estado === 'Vendido' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs">
                    <XCircle className="w-4 h-4" />
                    Vendido {vehicle.estadoModificadoManualmente ? '(Manual)' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Grilla de Datos Técnicos y Administrativos */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 uppercase tracking-wider">
                Ficha Técnica y Ubicación en Stock
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-white">
                
                {/* Columna 1 */}
                <div className="p-4 space-y-3">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Marca:</span>
                    <span className="font-bold text-slate-900 text-sm">{vehicle.marca}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Modelo:</span>
                    <span className="font-bold text-slate-900 text-sm">{vehicle.modelo}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Versión:</span>
                    <span className="font-semibold text-slate-800">{vehicle.version || 'Estándar'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Año de fabricación:</span>
                    <span className="font-bold text-slate-800">{vehicle.anio}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Patente / Dominio:</span>
                    <span className="font-mono font-black text-slate-900 text-sm">{vehicle.patente}</span>
                  </div>
                </div>

                {/* Columna 2 */}
                <div className="p-4 space-y-3">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Kilometraje:</span>
                    <span className="font-bold text-slate-900 text-sm">{formatKm(vehicle.kilometraje)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Color:</span>
                    <span className="font-semibold text-slate-800">{vehicle.color || 'A confirmar'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Combustible:</span>
                    <span className="font-semibold text-slate-800">{vehicle.combustible || 'Nafta'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Transmisión:</span>
                    <span className="font-semibold text-slate-800">{vehicle.caja || 'Manual'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Tipo:</span>
                    <span className="font-semibold text-slate-800">{vehicle.tipoVehiculo || vehicle.traccion || 'Estándar'}</span>
                  </div>
                </div>

                {/* Columna 3 */}
                <div className="p-4 space-y-3">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Empresa / Procedencia:</span>
                    <span className="font-bold text-slate-900">{vehicle.empresa || 'Autonet'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Situación en stock (Ub):</span>
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${ubInfo.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ubInfo.dotColor}`}></span>
                        <span>{ubInfo.label} (Ub: {ubInfo.shortLabel})</span>
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Fecha de toma:</span>
                    <span className="font-mono text-slate-700">{vehicle.fechaToma || 'No registrada'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Publicación en Autonet:</span>
                    {hasValidAutonetUrl ? (
                      <a
                        href={vehicle.urlAutonetOriginal}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 mt-0.5"
                      >
                        <span className="truncate max-w-[180px]">{vehicle.urlAutonetOriginal}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Sin publicación web activa</span>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Observaciones */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-800 uppercase tracking-wider block mb-1">
                Observaciones
              </span>
              <p className="text-slate-600 leading-relaxed">
                {vehicle.observaciones || 'Sin observaciones registradas para esta unidad.'}
              </p>
            </div>

          </div>

          {/* Footer con Acciones Requeridas:
              "VER EN AUTONET"
              "COTIZAR"
              "MARCAR COMO VENDIDO"
              "MARCAR COMO RESERVADO"
              "MARCAR COMO DISPONIBLE"
          */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            
            {/* Botones de negocio principales */}
            <div className="flex flex-wrap items-center gap-2">
              {/* VER EN AUTONET (solo si existe URL válida) */}
              {hasValidAutonetUrl && (
                <a
                  href={vehicle.urlAutonetOriginal}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="modal-btn-ver-autonet"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs"
                >
                  <span>VER EN AUTONET</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              {/* COTIZAR */}
              <button
                type="button"
                id="modal-btn-cotizar"
                onClick={handleOpenQuoteModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs"
              >
                <Calculator className="w-3.5 h-3.5 text-blue-400" />
                <span>COTIZAR</span>
              </button>

              {/* Copiar Ficha para WhatsApp */}
              <button
                type="button"
                onClick={handleCopyShare}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
                title="Copiar ficha del vehículo para enviar por WhatsApp"
              >
                {copiedShare ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedShare ? '¡Copiado!' : 'Compartir'}</span>
              </button>
            </div>

            {/* Botones de gestión de Estado */}
            <div className="flex flex-wrap items-center gap-1.5">
              {vehicle.estado !== 'Disponible' && (
                <button
                  type="button"
                  id="modal-btn-marcar-disponible"
                  onClick={() => onStatusChange(vehicle.id, 'Disponible')}
                  className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition-colors"
                >
                  MARCAR COMO DISPONIBLE
                </button>
              )}

              {vehicle.estado !== 'Reservado' && (
                <button
                  type="button"
                  id="modal-btn-marcar-reservado"
                  onClick={() => onStatusChange(vehicle.id, 'Reservado')}
                  className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 text-xs font-bold transition-colors"
                >
                  MARCAR COMO RESERVADO
                </button>
              )}

              {vehicle.estado !== 'Vendido' && (
                <button
                  type="button"
                  id="modal-btn-marcar-vendido"
                  onClick={() => onStatusChange(vehicle.id, 'Vendido')}
                  className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 hover:bg-rose-100 text-xs font-bold transition-colors"
                >
                  MARCAR COMO VENDIDO
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors ml-1"
              >
                Cerrar
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* Modal de Cotización si fue abierto directamente */}
      {isQuoteModalOpen && (
        <VehicleQuoteModal
          vehicle={vehicle}
          onClose={() => setIsQuoteModalOpen(false)}
          onUpdateVehicleTableValue={onUpdateVehicleTableValue}
        />
      )}
    </>
  );
};
