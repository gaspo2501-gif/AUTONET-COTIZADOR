import React from 'react';
import { 
  Eye, 
  Calendar, 
  Gauge, 
  Fuel, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Tag, 
  ExternalLink, 
  Building2,
  Calculator
} from 'lucide-react';
import { Vehicle } from '../types/stock';
import { formatCurrency, formatKm } from '../utils/formatters';
import { getSituacionOperativaInfo, getEmpresaBadgeClass } from '../utils/autonetHelpers';

interface VehicleCardProps {
  vehicle: Vehicle;
  onSelect: (vehicle: Vehicle) => void;
  onStatusChange: (id: string, newStatus: 'Disponible' | 'Reservado' | 'Vendido') => void;
  onQuote?: (vehicle: Vehicle) => void;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  onSelect,
  onStatusChange,
  onQuote,
}) => {
  const getStatusBadge = () => {
    switch (vehicle.estado) {
      case 'Disponible':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Disponible
          </span>
        );
      case 'Reservado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            Reservado
          </span>
        );
      case 'Vendido':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs">
            <XCircle className="w-3.5 h-3.5" />
            Vendido {vehicle.estadoModificadoManualmente ? '(Manual)' : ''}
          </span>
        );
      default:
        return null;
    }
  };

  const hasValidAutonetUrl = Boolean(
    vehicle.urlAutonetOriginal && vehicle.urlAutonetOriginal.startsWith('http')
  );

  return (
    <div className={`group bg-white rounded-xl overflow-hidden border transition-all duration-200 hover:shadow-lg flex flex-col justify-between ${
      vehicle.estado === 'Vendido' 
        ? 'border-slate-200 opacity-75 hover:opacity-100 bg-slate-50/50' 
        : 'border-slate-200/90 hover:border-blue-400'
    }`}>
      {/* Cabecera de Ficha: Patente, Estado e ID (Sin fotos) */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/80">
        <div className="flex items-center justify-between gap-2">
          {/* Patente estilo chapa vehicular */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-md bg-slate-900 text-white text-xs font-mono font-bold tracking-widest border border-slate-700 shadow-xs">
              {vehicle.patente}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {vehicle.id}
            </span>
          </div>

          {/* Badge Estado */}
          <div>
            {getStatusBadge()}
          </div>
        </div>

        {/* Situación Operativa (Ub) y Empresa */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          {vehicle.ubicacion && (
            (() => {
              const ubInfo = getSituacionOperativaInfo(vehicle.ubicacion);
              return (
                <span 
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${ubInfo.badgeClass}`}
                  title={`Situación operativa en stock (Ub): ${ubInfo.label}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${ubInfo.dotColor}`}></span>
                  <span>Ub: {ubInfo.shortLabel}</span>
                </span>
              );
            })()
          )}
          {vehicle.empresa && (
            <span 
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${getEmpresaBadgeClass(vehicle.empresa)}`}
              title={`Empresa / Procedencia: ${vehicle.empresa}`}
            >
              <Building2 className="w-3 h-3 opacity-60 shrink-0" />
              <span>{vehicle.empresa}</span>
            </span>
          )}
        </div>
      </div>

      {/* Contenido principal */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Marca y Modelo */}
          <div className="mb-2">
            <h3 
              onClick={() => onSelect(vehicle)}
              className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 cursor-pointer"
            >
              {vehicle.marca} {vehicle.modelo}
            </h3>
            <p className="text-xs text-slate-500 font-medium line-clamp-1">
              {vehicle.version}
            </p>
          </div>

          {/* Precio de venta */}
          <div className="my-2 py-2 px-3 rounded-lg bg-slate-50 border border-slate-100 flex items-baseline justify-between">
            <span className="text-xs font-medium text-slate-500">Precio contado:</span>
            <span className="text-lg font-extrabold text-blue-700 font-mono tracking-tight">
              {formatCurrency(vehicle.precio, vehicle.moneda)}
            </span>
          </div>

          {/* Fila de características rápidas */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mt-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Año: <strong className="text-slate-800">{vehicle.anio}</strong></span>
            </div>

            <div className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Km: <strong className="text-slate-800">{formatKm(vehicle.kilometraje)}</strong></span>
            </div>

            <div className="flex items-center gap-1.5">
              <Fuel className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{vehicle.combustible} • {vehicle.caja}</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500">
              <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{vehicle.color || 'A confirmar'}</span>
            </div>
          </div>
        </div>

        {/* Enlace a Autonet si existe URL real */}
        {hasValidAutonetUrl && (
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <a
              href={vehicle.urlAutonetOriginal}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-blue-700 text-xs font-bold transition-colors"
            >
              <span>VER EN AUTONET</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Botones de acción inferior */}
      <div className="p-4 pt-0 border-t border-slate-100 mt-2 flex items-center gap-1.5">
        <button
          id={`ver-vehiculo-${vehicle.id}`}
          onClick={() => onSelect(vehicle)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-xs"
        >
          <Eye className="w-3.5 h-3.5 text-slate-300" />
          <span>Ficha</span>
        </button>

        {onQuote && (
          <button
            id={`cotizar-vehiculo-${vehicle.id}`}
            onClick={() => onQuote(vehicle)}
            title="Calcular cotización y transferencia DNRPA"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            <Calculator className="w-3.5 h-3.5 text-blue-200" />
            <span>Cotizar</span>
          </button>
        )}

        {/* Botón rápido manual vendido / disponible / reservado */}
        {vehicle.estado === 'Disponible' ? (
          <button
            id={`marcar-vendido-${vehicle.id}`}
            onClick={() => onStatusChange(vehicle.id, 'Vendido')}
            title="Marcar como Vendido manualmente (evita que el PDF lo reactive)"
            className="py-2 px-2.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 text-xs font-semibold transition-colors"
          >
            Vendido
          </button>
        ) : vehicle.estado === 'Vendido' ? (
          <button
            id={`marcar-disponible-${vehicle.id}`}
            onClick={() => onStatusChange(vehicle.id, 'Disponible')}
            title="Reactivar a Disponible"
            className="py-2 px-2.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 text-xs font-semibold transition-colors"
          >
            Disponible
          </button>
        ) : (
          <button
            id={`marcar-disponible-${vehicle.id}`}
            onClick={() => onStatusChange(vehicle.id, 'Disponible')}
            title="Liberar reserva"
            className="py-2 px-2.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 text-xs font-semibold transition-colors"
          >
            Liberar
          </button>
        )}
      </div>
    </div>
  );
};
