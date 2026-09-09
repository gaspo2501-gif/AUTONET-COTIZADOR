import React from 'react';
import { Eye, CheckCircle2, AlertCircle, XCircle, ExternalLink, Building2, Calculator } from 'lucide-react';
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
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
          Fuera de stock
        </span>
      );
    }

    switch (vehicle.estado) {
      case 'Disponible':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Disponible
          </span>
        );
      case 'Reservado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <AlertCircle className="w-3 h-3" />
            Reservado
          </span>
        );
      case 'Vendido':
        if (vehicle.saleOwner === 'self') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3 h-3" />
              Vendida por mí
            </span>
          );
        }
        if (vehicle.saleOwner === 'other') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              <XCircle className="w-3 h-3" />
              Vendido (otro)
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <XCircle className="w-3 h-3" />
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
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
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
                      <span className="px-2.5 py-1 rounded bg-slate-900 text-white font-mono text-xs font-bold tracking-wider">
                        {v.patente}
                      </span>
                      {hasValidAutonetUrl && (
                        <a
                          href={v.urlAutonetOriginal}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver en autonet.com.ar"
                          className="text-blue-500 hover:text-blue-700"
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
                      className="text-left font-bold text-slate-900 hover:text-blue-600 block transition-colors"
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
                  <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-blue-700">
                    {formatCurrency(v.precio, v.moneda)}
                  </td>

                  {/* Mecánica */}
                  <td className="py-3 px-3 whitespace-nowrap text-xs text-slate-600">
                    <div>{v.combustible}</div>
                    <div className="text-[11px] text-slate-400">{v.caja}</div>
                  </td>

                  {/* Estado */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    {getStatusBadge(v)}
                  </td>

                  {/* Acciones */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onSelect(v)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        title="Ver ficha completa"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {onQuote && (
                        <button
                          onClick={() => onQuote(v)}
                          className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
                          title="Cotizar transferencia DNRPA"
                        >
                          <Calculator className="w-4 h-4" />
                        </button>
                      )}

                      {/* Toggle simple de estado rápido o gestión de venta */}
                      {v.estado === 'Disponible' ? (
                        <button
                          onClick={() => onOpenMarkAsSold ? onOpenMarkAsSold(v) : onStatusChange(v.id, 'Vendido')}
                          className="text-[11px] px-2 py-1 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 transition-colors"
                          title="Registrar venta"
                        >
                          Vender
                        </button>
                      ) : v.estado === 'Vendido' ? (
                        <div className="flex items-center gap-1">
                          {onOpenMarkAsSold && (
                            <button
                              onClick={() => onOpenMarkAsSold(v)}
                              className="text-[11px] px-1.5 py-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition-colors"
                              title="Modificar venta"
                            >
                              Venta
                            </button>
                          )}
                          <button
                            onClick={() => onStatusChange(v.id, 'Disponible')}
                            className="text-[11px] px-1.5 py-1 rounded bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 border border-slate-200 transition-colors"
                            title="Reactivar a disponible"
                          >
                            Reactivar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onStatusChange(v.id, 'Disponible')}
                          className="text-[11px] px-2 py-1 rounded bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 border border-slate-200 transition-colors"
                          title="Liberar reserva"
                        >
                          Disponible
                        </button>
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
