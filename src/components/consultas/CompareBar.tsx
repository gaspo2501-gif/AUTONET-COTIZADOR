import React from 'react';
import { GitCompare, X } from 'lucide-react';
import { Vehicle } from '../../types/stock';

export const CompareBar: React.FC<{ vehicles: Vehicle[]; onOpen: () => void; onClear: () => void }> = ({ vehicles, onOpen, onClear }) => {
  if (vehicles.length === 0) return null;
  return (
    <div className="fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(var(--bottomnav-h)+0.75rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:left-[calc(50%+var(--sidebar-w)/2)] animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-center gap-1 pl-4 pr-1.5 py-1.5 rounded-full bg-slate-900 text-white shadow-2xl ring-1 ring-white/10">
        <GitCompare className="w-4 h-4 text-sky-300" />
        <span className="text-[13px] font-semibold px-1.5 whitespace-nowrap">
          {vehicles.length} para comparar
        </span>
        <button type="button" onClick={onOpen} disabled={vehicles.length < 2} className="btn btn-sm btn-primary !rounded-full disabled:!opacity-60" title={vehicles.length < 2 ? 'Elegí al menos 2 unidades' : 'Ver comparación'}>
          Comparar
        </button>
        <button type="button" onClick={onClear} className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10" aria-label="Vaciar comparación">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
