import React from 'react';
import { Vehicle } from '../../types/stock';
import { isHistoricalVehicle, normalizeCommercialStatus } from '../../utils/stockSelectors';

type Tone = { label: string; cls: string; dot: string };

export function getVehicleStatusTone(vehicle: Vehicle): Tone {
  if (isHistoricalVehicle(vehicle)) return { label: 'Fuera de stock', cls: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' };
  const st = normalizeCommercialStatus(vehicle.estado);
  if (st === 'Reservado') return { label: 'Reservado', cls: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' };
  if (st === 'Vendido') {
    if (vehicle.saleOwner === 'self') return { label: 'Vendida por mí', cls: 'bg-teal-50 text-teal-800 ring-teal-200', dot: 'bg-teal-600' };
    if (vehicle.saleOwner === 'other') return { label: 'Vendido (otro)', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500' };
    return { label: 'Vendido', cls: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' };
  }
  return { label: 'Disponible', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' };
}

export const StatusBadge: React.FC<{ vehicle: Vehicle; size?: 'sm' | 'md' }> = ({ vehicle, size = 'md' }) => {
  const t = getVehicleStatusTone(vehicle);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset font-bold whitespace-nowrap ${t.cls} ${
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
      {t.label}
    </span>
  );
};
