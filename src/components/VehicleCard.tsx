import React from 'react';
import { Calendar, Gauge, Fuel, Settings, Calculator, ExternalLink, Building2, Palette, MapPin, Mountain } from 'lucide-react';
import { Vehicle } from '../types/stock';
import { formatCurrency, formatKm } from '../utils/formatters';
import { getSituacionOperativaInfo } from '../utils/autonetHelpers';
import { StatusBadge } from './ui/StatusBadge';
import { Highlight } from './ui/Highlight';
import { isHistoricalVehicle } from '../utils/stockSelectors';

interface VehicleCardProps {
  vehicle: Vehicle;
  onSelect: (vehicle: Vehicle) => void;
  onStatusChange: (vehicleOrPatent: Vehicle | string, newStatus: 'Disponible' | 'Reservado' | 'Vendido') => void;
  onQuote?: (vehicle: Vehicle) => void;
  onOpenMarkAsSold?: (vehicle: Vehicle) => void;
  query?: string;
}

const Spec: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex items-center gap-1.5 min-w-0 text-[12px] text-slate-600">
    <span className="text-slate-400 shrink-0">{icon}</span>
    <span className="truncate font-semibold text-slate-700">{children}</span>
  </div>
);

export const VehicleCard: React.FC<VehicleCardProps> = React.memo(
  ({ vehicle, onSelect, onStatusChange, onQuote, onOpenMarkAsSold, query }) => {
    const sold = vehicle.estado === 'Vendido';
    const historical = isHistoricalVehicle(vehicle);
    const hasValidAutonetUrl = Boolean(vehicle.urlAutonetOriginal && vehicle.urlAutonetOriginal.startsWith('http'));
    const ub = vehicle.ubicacion ? getSituacionOperativaInfo(vehicle.ubicacion) : null;
    const priceToConfirm = vehicle.precio === null || vehicle.precio === undefined;

    return (
      <article
        className={`group autonet-card autonet-card-hover flex flex-col overflow-hidden ${
          sold || historical ? 'bg-slate-50/60' : ''
        }`}
      >
        {/* Cabecera: patente + estado */}
        <div className="px-4 pt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="plate">
              <Highlight text={vehicle.patente} query={query} />
            </span>
            <span className="text-[10.5px] font-mono text-slate-400 truncate">{vehicle.id}</span>
          </div>
          <StatusBadge vehicle={vehicle} size="sm" />
        </div>

        {/* Título */}
        <button type="button" onClick={() => onSelect(vehicle)} className="px-4 pt-3 text-left">
          <h3 className="text-[15px] font-extrabold text-slate-900 leading-snug line-clamp-1 group-hover:text-action-700 transition-colors">
            <Highlight text={`${vehicle.marca} ${vehicle.modelo}`} query={query} />
          </h3>
          <p className="text-[12px] text-slate-500 font-medium line-clamp-1 mt-0.5">
            <Highlight text={vehicle.version || '—'} query={query} />
          </p>
        </button>

        {/* Precio */}
        <div className="px-4 pt-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Precio contado</div>
          <div
            className={`tabular font-extrabold tracking-tight leading-tight ${
              priceToConfirm ? 'text-amber-600 text-[15px] mt-1' : sold ? 'text-slate-500 text-[22px]' : 'text-slate-950 text-[22px]'
            }`}
          >
            {formatCurrency(vehicle.precio, vehicle.moneda)}
          </div>
        </div>

        {/* Especificaciones */}
        <div className="px-4 pt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
          <Spec icon={<Calendar className="w-3.5 h-3.5" />}>{vehicle.anio}</Spec>
          <Spec icon={<Gauge className="w-3.5 h-3.5" />}>{formatKm(vehicle.kilometraje)}</Spec>
          <Spec icon={<Fuel className="w-3.5 h-3.5" />}>{vehicle.combustible}</Spec>
          <Spec icon={<Settings className="w-3.5 h-3.5" />}>{vehicle.caja}</Spec>
          <Spec icon={<Palette className="w-3.5 h-3.5" />}>
            <Highlight text={vehicle.color || 'Color a confirmar'} query={query} />
          </Spec>
          {vehicle.traccion === '4x4' || vehicle.traccion === 'AWD' ? (
            <Spec icon={<Mountain className="w-3.5 h-3.5" />}>Tracción {vehicle.traccion}</Spec>
          ) : null}
        </div>

        {/* Situación y empresa */}
        {(ub || vehicle.empresa) && (
          <div className="px-4 pt-3 flex flex-wrap items-center gap-1.5">
            {ub && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold border ${ub.badgeClass}`}
                title={`Situación operativa (Ub): ${ub.label}`}
              >
                <MapPin className="w-3 h-3 opacity-70" />
                {ub.shortLabel}
              </span>
            )}
            {vehicle.empresa && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
                title={`Empresa / procedencia: ${vehicle.empresa}`}
              >
                <Building2 className="w-3 h-3 opacity-60" />
                {vehicle.empresa}
              </span>
            )}
            {hasValidAutonetUrl && (
              <a
                href={vehicle.urlAutonetOriginal}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-action-700 hover:underline"
                title="Ver publicación en autonet.com.ar"
              >
                Web <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Acciones */}
        <div className="mt-4 p-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-1.5">
          <button id={`ver-vehiculo-${vehicle.id}`} type="button" onClick={() => onSelect(vehicle)} className="btn btn-sm btn-secondary flex-1">
            Ficha
          </button>
          {onQuote && (
            <button
              id={`cotizar-vehiculo-${vehicle.id}`}
              type="button"
              onClick={() => onQuote(vehicle)}
              title="Calcular cotización y transferencia DNRPA"
              className="btn btn-sm btn-primary flex-1"
            >
              <Calculator className="w-3.5 h-3.5" />
              Cotizar
            </button>
          )}
          {vehicle.estado === 'Disponible' ? (
            <button
              id={`marcar-vendido-${vehicle.id}`}
              type="button"
              onClick={() => (onOpenMarkAsSold ? onOpenMarkAsSold(vehicle) : onStatusChange(vehicle, 'Vendido'))}
              title="Registrar venta"
              className="btn btn-sm btn-ghost hover:!text-brand-700 hover:!bg-brand-50"
            >
              Vendido
            </button>
          ) : vehicle.estado === 'Vendido' ? (
            <>
              {onOpenMarkAsSold && (
                <button type="button" id={`gestionar-venta-${vehicle.id}`} onClick={() => onOpenMarkAsSold(vehicle)} className="btn btn-sm btn-ghost" title="Modificar datos de la venta">
                  Venta
                </button>
              )}
              <button
                type="button"
                id={`marcar-disponible-${vehicle.id}`}
                onClick={() => onStatusChange(vehicle, 'Disponible')}
                title="Reactivar a Disponible"
                className="btn btn-sm btn-ghost hover:!text-emerald-700 hover:!bg-emerald-50"
              >
                Reactivar
              </button>
            </>
          ) : vehicle.estado === 'Reservado' ? (
            <button
              type="button"
              id={`marcar-disponible-${vehicle.id}`}
              onClick={() => onStatusChange(vehicle, 'Disponible')}
              title="Liberar reserva"
              className="btn btn-sm btn-ghost hover:!text-emerald-700 hover:!bg-emerald-50"
            >
              Liberar
            </button>
          ) : (
            <button
              type="button"
              id={`marcar-disponible-${vehicle.id}`}
              onClick={() => onStatusChange(vehicle, 'Disponible')}
              title="Volver a poner en stock como Disponible"
              className="btn btn-sm btn-ghost hover:!text-emerald-700 hover:!bg-emerald-50"
            >
              Reactivar
            </button>
          )}
        </div>
      </article>
    );
  }
);
VehicleCard.displayName = 'VehicleCard';
