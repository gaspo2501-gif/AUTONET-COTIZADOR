import React from 'react';
import { Eye, Calculator, Tag, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { Vehicle } from '../types/stock';
import { formatCurrency, formatKm } from '../utils/formatters';
import { getSituacionOperativaInfo, getEmpresaBadgeClass } from '../utils/autonetHelpers';
import { normalizePatent } from '../utils/vehicleIdentity';
import { StatusBadge } from './ui/StatusBadge';
import { Highlight } from './ui/Highlight';
import { StockSortKey } from '../utils/stockSort';

interface VehicleTableProps {
  vehicles: Vehicle[];
  onSelect: (vehicle: Vehicle) => void;
  onStatusChange: (vehicleOrPatent: Vehicle | string, newStatus: 'Disponible' | 'Reservado' | 'Vendido') => void;
  onQuote?: (vehicle: Vehicle) => void;
  onOpenMarkAsSold?: (vehicle: Vehicle) => void;
  query?: string;
  sortBy?: StockSortKey;
  onSortChange?: (s: StockSortKey) => void;
}

type Col = { label: string; asc?: StockSortKey; desc?: StockSortKey; align?: string };

const SortHeader: React.FC<{ col: Col; sortBy?: StockSortKey; onSortChange?: (s: StockSortKey) => void }> = ({ col, sortBy, onSortChange }) => {
  if (!col.asc || !col.desc || !onSortChange) return <>{col.label}</>;
  const active = sortBy === col.asc || sortBy === col.desc;
  const next = sortBy === col.desc ? col.asc : col.desc;
  return (
    <button
      type="button"
      onClick={() => onSortChange(next)}
      className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-900 ${active ? 'text-slate-900' : ''}`}
    >
      {col.label}
      {!active ? (
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      ) : sortBy === col.asc ? (
        <ChevronUp className="w-3.5 h-3.5 text-action-600" />
      ) : (
        <ChevronDown className="w-3.5 h-3.5 text-action-600" />
      )}
    </button>
  );
};

export const VehicleTable: React.FC<VehicleTableProps> = ({ vehicles, onSelect, onStatusChange, onQuote, onOpenMarkAsSold, query, sortBy, onSortChange }) => {
  const cols: Col[] = [
    { label: 'Patente' },
    { label: 'Vehículo', asc: 'marca_asc', desc: 'marca_asc' },
    { label: 'Ub' },
    { label: 'Empresa' },
    { label: 'Año', asc: 'anio_asc', desc: 'anio_desc', align: 'text-center' },
    { label: 'Km', asc: 'km_asc', desc: 'km_desc', align: 'text-right' },
    { label: 'Precio', asc: 'precio_asc', desc: 'precio_desc', align: 'text-right' },
    { label: 'Mecánica' },
    { label: 'Estado' },
    { label: '', align: 'text-right' },
  ];

  return (
    <div className="autonet-card overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10.5px] font-extrabold uppercase tracking-wider">
              {cols.map((c, i) => (
                <th key={i} className={`py-3 px-3 first:pl-4 last:pr-4 whitespace-nowrap ${c.align || ''}`}>
                  <SortHeader col={c} sortBy={sortBy} onSortChange={onSortChange} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vehicles.map((v) => {
              const ub = v.ubicacion ? getSituacionOperativaInfo(v.ubicacion) : null;
              const sold = v.estado === 'Vendido' || v.isHistorical;
              return (
                <tr key={normalizePatent(v.patente) || v.id} className={`group hover:bg-action-50/40 transition-colors ${sold ? 'text-slate-500' : ''}`}>
                  <td className="py-2.5 pl-4 pr-3 whitespace-nowrap">
                    <span className="plate">
                      <Highlight text={v.patente} query={query} />
                    </span>
                  </td>
                  <td className="py-2.5 px-3 max-w-[280px]">
                    <button type="button" onClick={() => onSelect(v)} className="text-left">
                      <div className="font-bold text-slate-900 truncate group-hover:text-action-700">
                        <Highlight text={`${v.marca} ${v.modelo}`} query={query} />
                      </div>
                      <div className="text-[11.5px] text-slate-500 truncate">
                        <Highlight text={v.version} query={query} />
                      </div>
                    </button>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {ub ? (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold border ${ub.badgeClass}`} title={ub.label}>
                        {ub.shortLabel}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {v.empresa ? (
                      <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10.5px] font-bold border ${getEmpresaBadgeClass(v.empresa)}`}>{v.empresa}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-800 tabular">{v.anio}</td>
                  <td className="py-2.5 px-3 text-right tabular whitespace-nowrap">{formatKm(v.kilometraje)}</td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap tabular font-extrabold text-slate-950">{formatCurrency(v.precio, v.moneda)}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-[12px] text-slate-600">
                    {v.combustible} · {v.caja === 'Automática' ? 'AT' : 'MT'} · {v.traccion}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <StatusBadge vehicle={v} size="sm" />
                  </td>
                  <td className="py-2.5 pr-4 pl-3 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {onQuote && v.estado !== 'Vendido' && !v.isHistorical && (
                        <button type="button" onClick={() => onQuote(v)} title="Cotizar" className="btn btn-sm btn-primary !px-2">
                          <Calculator className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button type="button" onClick={() => onSelect(v)} title="Ver ficha" className="btn btn-sm btn-ghost !px-2">
                        <Eye className="w-4 h-4" />
                      </button>
                      {onOpenMarkAsSold && v.estado !== 'Vendido' && !v.isHistorical && (
                        <button type="button" onClick={() => onOpenMarkAsSold(v)} title="Registrar venta" className="btn btn-sm btn-ghost !px-2 hover:!text-emerald-700">
                          <Tag className="w-4 h-4" />
                        </button>
                      )}
                      {v.estado !== 'Vendido' && !v.isHistorical && (
                        <select
                          value={v.estado}
                          onChange={(e) => onStatusChange(v, e.target.value as any)}
                          aria-label="Cambiar estado"
                          className="text-[11px] font-bold border border-slate-200 rounded-lg py-1 px-1.5 bg-white text-slate-700 outline-none focus:border-action-600"
                        >
                          <option value="Disponible">Disponible</option>
                          <option value="Reservado">Reservado</option>
                          <option value="Vendido">Vendido</option>
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
