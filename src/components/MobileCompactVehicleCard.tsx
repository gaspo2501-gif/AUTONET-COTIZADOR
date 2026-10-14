import React from 'react';
import { ChevronRight, Calculator } from 'lucide-react';
import { Vehicle } from '../types/stock';
import { formatCurrency, formatKm } from '../utils/formatters';
import { StatusBadge } from './ui/StatusBadge';
import { Highlight } from './ui/Highlight';

interface MobileCompactVehicleCardProps {
  vehicle: Vehicle;
  onSelect: (vehicle: Vehicle) => void;
  onQuote?: (vehicle: Vehicle) => void;
  query?: string;
}

export const MobileCompactVehicleCard: React.FC<MobileCompactVehicleCardProps> = React.memo(({ vehicle, onSelect, onQuote, query }) => {
  const sold = vehicle.estado === 'Vendido';
  const priceToConfirm = vehicle.precio === null || vehicle.precio === undefined;

  return (
    <article className="autonet-card active:scale-[0.995] transition-transform select-none overflow-hidden">
      <button type="button" onClick={() => onSelect(vehicle)} className="w-full text-left p-3.5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="plate text-[0.78rem]">
            <Highlight text={vehicle.patente ? vehicle.patente.toUpperCase().trim() : 'S/D'} query={query} />
          </span>
          <div className="flex items-center gap-1">
            <StatusBadge vehicle={vehicle} size="sm" />
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
        </div>
        <div className="mt-2 text-slate-900 font-extrabold text-[15px] leading-tight line-clamp-1">
          <Highlight text={`${vehicle.marca} ${vehicle.modelo}`} query={query} />
        </div>
        {vehicle.version && (
          <div className="text-slate-500 font-medium text-[12px] line-clamp-1 mt-0.5">
            <Highlight text={vehicle.version} query={query} />
          </div>
        )}
        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div className="text-[12px] font-semibold text-slate-600 flex flex-wrap items-center gap-x-1.5 leading-tight">
            <span>{vehicle.anio}</span>
            <span className="text-slate-300">·</span>
            <span>{formatKm(vehicle.kilometraje)}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">{vehicle.combustible}</span>
            {vehicle.caja === 'Automática' && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">AT</span>
              </>
            )}
          </div>
          <div
            className={`tabular shrink-0 font-black tracking-tight ${
              priceToConfirm ? 'text-amber-600 text-[13px]' : sold ? 'text-slate-500 text-[17px]' : 'text-slate-950 text-[17px]'
            }`}
          >
            {formatCurrency(vehicle.precio, vehicle.moneda)}
          </div>
        </div>
      </button>
      {onQuote && !sold && (
        <div className="px-3.5 pb-3 -mt-0.5">
          <button type="button" onClick={() => onQuote(vehicle)} className="btn btn-sm w-full !py-2 bg-action-50 text-action-700 hover:bg-action-100 border-action-100">
            <Calculator className="w-3.5 h-3.5" /> Cotizar
          </button>
        </div>
      )}
    </article>
  );
});

MobileCompactVehicleCard.displayName = 'MobileCompactVehicleCard';
