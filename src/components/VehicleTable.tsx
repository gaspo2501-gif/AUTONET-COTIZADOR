import React from 'react';
import { 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  ExternalLink, 
  Building2, 
  Calculator,
  Tag
} from 'lucide-react';
import { Vehicle } from '../types/stock';
import { formatCurrency, formatKm } from '../utils/formatters';
import { getSituacionOperativaInfo, getEmpresaBadgeClass } from '../utils/autonetHelpers';

interface VehicleTableProps {
  vehicles: Vehicle[];
  onSelect: (vehicle: Vehicle) => void;
  onStatusChange: (id: string, newStatus: 'Disponible' | 'Reservado' | 'Vendido') => void;
  onQuote?: (vehicle: Vehicle) => void;
  onOpenMarkAsSold?: (vehicle: Vehicle) => void;
}

export const VehicleTable: React.FC<VehicleTableProps> = ({
  vehicles,
  onSelect,
  onStatusChange,
  onQuote,
  onOpenMarkAsSold,
}) => {
  const getStatusBadge = (vehicle: Vehicle) => {
    if (vehicle.isHistorical || vehicle.estado === 'fuera_de_stock') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          Fuera de stock
        </span>
      );
    }

    switch (vehicle.estado) {
      case 'Disponible':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Disponible
          </span>
        );
      case 'Reservado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            Reservado
          </span>
        );
      case 'Vendido':
        if (vehicle.saleOwner === 'self') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
              <CheckCircle2 className="w-3 h-3 text-teal-600" />
              Vendida por mí
            </span>
          );
        }
        if (vehicle.saleOwner === 'other') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
              <XCircle className="w-3 h-3 text-indigo-600" />
              Vendido (otro)
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Vendido
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-200 text-xs font-extrabold uppercase tracking-wider">
              <th className="py-3 px-4">Patente</th>
              <th className="py-3 px-4">Vehículo</th>
              <th className="py-3 px-3">Situación (Ub)</th>
              <th className="py-3 px-3">Empresa</th>
              <th className="py-3 px-3 text-center">Año</th>
              <th className="py-3 px-4 text-right">Kilometraje</th>
              <th className="py-3 px-4 text-right">Precio Venta</th>
              <th className="py-3 px-3">Mecánica</th>
              <th className="py-3 px-3">Estado</th>
              <th className="py-3 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {vehicles.map((v) => {
              const ubInfo = getSituacionOperativaInfo(v.ubicacion);
              const hasValidAutonetUrl = Boolean(
                v.urlAutonetOriginal && v.urlAutonetOriginal.startsWith('http')
              );

              return (
                <tr 
                  key={v.id} 
                  className={`hover:bg-blue-50/40 transition-colors ${
                    v.estado === 'Vendido' ? 'bg-slate-50/70 text-slate-500' : ''
                  }`}
                >
                  {/* Patente */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded bg-slate-950 text-white font-mono text-xs font-black tracking-wider shadow-2xs">
                        {v.patente}
                      </span>
                      {hasValidAutonetUrl && (
                        <a
                          href={v.urlAutonetOriginal}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver en autonet.com.ar"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{v.id}</div>
                  </td>

                  {/* Marca, Modelo y Versión */}
                  <td className="py-3 px-4 max-w-xs">
                    <button 
                      onClick={() => onSelect(v)}
                      className="text-left font-bold text-slate-900 hover:text-blue-700 block transition-colors cursor-pointer"
                    >
                      {v.marca} {v.modelo}
                    </button>
                    <span className="text-xs text-slate-500 line-clamp-1">
                      {v.version}
                    </span>
                  </td>

                  {/* Situación (Ub) */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span 
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${ubInfo.badgeClass}`}
                      title={`Situación operativa: ${ubInfo.label}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${ubInfo.dotColor}`}></span>
                      <span>{ubInfo.shortLabel}</span>
                    </span>
                  </td>

                  {/* Empresa */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span 
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${getEmpresaBadgeClass(v.empresa)}`}
                      title={`Empresa: ${v.empresa}`}
                    >
                      <Building2 className="w-3 h-3 opacity-60" />
                      <span>{v.empresa || 'Autonet'}</span>
                    </span>
                  </td>

                  {/* Año */}
                  <td className="py-3 px-3 text-center font-bold text-slate-900">
                    {v.anio}
                  </td>

                  {/* Kilometraje */}
                  <td className="py-3 px-4 text-right font-mono font-medium">
                    {formatKm(v.kilometraje)}
                  </td>

                  {/* Precio Venta */}
                  <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-black text-blue-700">
                    {formatCurrency(v.precio, v.moneda)}
                  </td>

                  {/* Mecánica */}
                  <td className="py-3 px-3 whitespace-nowrap text-xs text-slate-600">
                    <div>{v.combustible}</div>
                    <div className="text-[11px] text-slate-400">{v.caja}</div>
                  </td>

                  {/* Estado comercial */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    {getStatusBadge(v)}
                  </td>

                  {/* Acciones */}
                  <td className="py-3 px-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1">
                      
                      {/* Botón Cotizar (Principal) */}
                      {onQuote && v.estado !== 'Vendido' && !v.isHistorical && (
                        <button
                          onClick={() => onQuote(v)}
                          title="Cotizar unidad y transferencias"
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer"
                        >
                          <Calculator className="w-4 h-4" />
                        </button>
                      )}

                      {/* Botón Ver Ficha */}
                      <button
                        onClick={() => onSelect(v)}
                        title="Ver ficha completa"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Botón Registrar Venta */}
                      {onOpenMarkAsSold && v.estado !== 'Vendido' && !v.isHistorical && (
                        <button
                          onClick={() => onOpenMarkAsSold(v)}
                          title="Registrar venta"
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer"
                        >
                          <Tag className="w-4 h-4" />
                        </button>
                      )}

                      {/* Selector rápido de estado si no está vendido */}
                      {v.estado !== 'Vendido' && !v.isHistorical && (
                        <select
                          value={v.estado}
                          onChange={(e) => onStatusChange(v.id, e.target.value as any)}
                          className="text-[11px] font-bold border border-slate-200 rounded-md py-1 px-1.5 bg-slate-50 text-slate-700 hover:bg-white outline-none cursor-pointer ml-1"
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
