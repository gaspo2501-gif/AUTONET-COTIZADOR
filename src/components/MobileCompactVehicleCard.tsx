import React from 'react';
import { Vehicle } from '../types/stock';
import { formatCurrency, formatKm } from '../utils/formatters';
import { CheckCircle2, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import { normalizePatent } from '../utils/vehicleIdentity';

interface MobileCompactVehicleCardProps {
  vehicle: Vehicle;
  onSelect: (vehicle: Vehicle) => void;
}

export const MobileCompactVehicleCard: React.FC<MobileCompactVehicleCardProps> = React.memo(({
  vehicle,
  onSelect,
}) => {
  const getStatusBadge = () => {
    if (vehicle.isHistorical || vehicle.estado === 'fuera_de_stock') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700">
          Fuera de stock
        </span>
      );
    }

    switch (vehicle.estado) {
      case 'Disponible':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            Disponible
          </span>
        );
      case 'Reservado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
            <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
            Reservado
          </span>
        );
      case 'Vendido':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-white">
            <Clock className="w-3 h-3 text-slate-300 shrink-0" />
            Vendido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
            {vehicle.estado}
          </span>
        );
    }
  };

  const formattedPrice = formatCurrency(vehicle.precio, vehicle.moneda);
  const formattedKm = formatKm(vehicle.kilometraje);
  const displayPlate = vehicle.patente ? vehicle.patente.toUpperCase().trim() : 'S/D';

  return (
    <div
      onClick={() => onSelect(vehicle)}
      className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-blue-400 active:scale-[0.99] transition-all p-3.5 cursor-pointer select-none"
    >
      {/* Fila 1: Patente destacada + Badge Estado */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="inline-block px-2.5 py-1 rounded bg-slate-900 text-white font-mono font-black text-sm tracking-wider shadow-2xs">
          {displayPlate}
        </span>
        <div className="flex items-center gap-1.5">
          {getStatusBadge()}
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* Fila 2: Marca y Modelo en negrita */}
      <div className="text-slate-900 font-extrabold text-[15px] leading-tight line-clamp-1">
        {vehicle.marca} {vehicle.modelo}
      </div>

      {/* Fila 3: Versión si existe */}
      {vehicle.version && (
        <div className="text-slate-500 font-medium text-xs line-clamp-1 mt-0.5">
          {vehicle.version}
        </div>
      )}

      {/* Fila 4: Año · Kilometraje y a la derecha el Precio grande */}
      <div className="flex items-baseline justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
        <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <span>{vehicle.anio}</span>
          <span className="text-slate-300">•</span>
          <span>{formattedKm}</span>
          {vehicle.combustible && (
            <>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">{vehicle.combustible}</span>
            </>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm sm:text-base font-black text-blue-700 font-mono tracking-tight">
            {formattedPrice}
          </span>
        </div>
      </div>
    </div>
  );
});

MobileCompactVehicleCard.displayName = 'MobileCompactVehicleCard';
