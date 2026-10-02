import React, { useState, useMemo } from 'react';
import { 
  UserCheck, 
  DollarSign, 
  TrendingUp, 
  Car, 
  Calendar, 
  Search, 
  RotateCcw, 
  Eye, 
  Edit3, 
  CheckCircle2, 
  Building2,
  Users,
  Archive,
  ArrowUpDown,
  FileCheck,
  Clock,
  AlertCircle,
  X,
  Check
} from 'lucide-react';
import { Vehicle } from '../types/stock';
import { stockService } from '../services/stockService';
import { formatCurrency, formatKm } from '../utils/formatters';
import { normalizePatent } from '../utils/vehicleIdentity';

function formatDateDMY(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

interface MySalesViewProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onOpenMarkAsSold: (vehicle: Vehicle) => void;
  onNavigateToStock: () => void;
}

export const MySalesView: React.FC<MySalesViewProps> = ({
  vehicles,
  onSelectVehicle,
  onOpenMarkAsSold,
  onNavigateToStock,
}) => {
  const [salesFilter, setSalesFilter] = useState<'self' | 'other' | 'all' | 'historical'>('self');
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'pending' | 'invoiced'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'fecha_desc' | 'precio_desc' | 'marca_asc'>('fecha_desc');

  // Modal para marcar / editar fecha de facturación
  const [invoiceModalVehicle, setInvoiceModalVehicle] = useState<Vehicle | null>(null);
  const [invoiceDateInput, setInvoiceDateInput] = useState<string>('');

  // Modal de confirmación para marcar como pendiente
  const [pendingConfirmVehicle, setPendingConfirmVehicle] = useState<Vehicle | null>(null);

  // Cálculos de métricas comerciales
  const metrics = useMemo(() => {
    const mySales = vehicles.filter((v) => v.estado === 'Vendido' && v.saleOwner === 'self');
    const myInvoiced = mySales.filter((v) => v.fechaFacturacion && v.fechaFacturacion.trim());
    const myPendingInvoice = mySales.filter((v) => !v.fechaFacturacion || !v.fechaFacturacion.trim());
    const otherSales = vehicles.filter((v) => v.estado === 'Vendido' && v.saleOwner === 'other');
    const allSold = vehicles.filter((v) => v.estado === 'Vendido');
    const historical = vehicles.filter((v) => v.isHistorical || v.estado === 'fuera_de_stock');

    const totalMyAmount = mySales.reduce((acc, v) => acc + (v.soldPrice || v.precio || 0), 0);
    const avgMyPrice = mySales.length > 0 ? Math.round(totalMyAmount / mySales.length) : 0;

    return {
      mySalesCount: mySales.length,
      myInvoicedCount: myInvoiced.length,
      myPendingInvoiceCount: myPendingInvoice.length,
      mySalesAmount: totalMyAmount,
      myAvgPrice: avgMyPrice,
      otherSalesCount: otherSales.length,
      allSoldCount: allSold.length,
      historicalCount: historical.length,
    };
  }, [vehicles]);

  // Lista filtrada según pestaña, facturación y buscador
  const filteredList = useMemo(() => {
    return vehicles.filter((v) => {
      // Filtro de pestaña
      if (salesFilter === 'self') {
        if (v.estado !== 'Vendido' || v.saleOwner !== 'self') return false;
      } else if (salesFilter === 'other') {
        if (v.estado !== 'Vendido' || v.saleOwner !== 'other') return false;
      } else if (salesFilter === 'all') {
        if (v.estado !== 'Vendido') return false;
      } else if (salesFilter === 'historical') {
        if (!v.isHistorical && v.estado !== 'fuera_de_stock') return false;
      }

      // Filtro de Facturación para ventas propias
      if (salesFilter === 'self' || v.saleOwner === 'self') {
        if (invoiceFilter === 'pending') {
          if (v.fechaFacturacion && v.fechaFacturacion.trim()) return false;
        } else if (invoiceFilter === 'invoiced') {
          if (!v.fechaFacturacion || !v.fechaFacturacion.trim()) return false;
        }
      }

      // Buscador
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const searchTarget = `${v.patente} ${v.marca} ${v.modelo} ${v.version} ${v.anio} ${v.color}`.toLowerCase();
        const cleanPatente = v.patente.replace(/\s+/g, '').toLowerCase();
        const cleanQuery = q.replace(/\s+/g, '');
        if (!searchTarget.includes(q) && !cleanPatente.includes(cleanQuery)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'fecha_desc') {
        const dateA = a.soldAt || a.fechaActualizacion || '';
        const dateB = b.soldAt || b.fechaActualizacion || '';
        return dateB.localeCompare(dateA);
      }
      if (sortBy === 'precio_desc') {
        const priceA = a.soldPrice || a.precio || 0;
        const priceB = b.soldPrice || b.precio || 0;
        return priceB - priceA;
      }
      return `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`);
    });
  }, [vehicles, salesFilter, searchQuery, sortBy]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      
      {/* Cabecera Principal */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-2">
            <UserCheck className="w-4 h-4" />
            <span>Control Comercial del Asesor</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Resumen de Mis Ventas
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Lleve el registro detallado de las operaciones comerciales cerradas por usted, diferenciándolas de las ventas de otros asesores y de unidades retiradas de stock.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToStock}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs shrink-0 self-start md:self-auto"
        >
          <Car className="w-4 h-4 text-blue-400" />
          <span>Explorar Stock Activo</span>
        </button>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl p-5 text-white shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-emerald-100 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Mis Ventas Propias</span>
              <UserCheck className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="text-3xl font-black font-mono">
              {metrics.mySalesCount} <span className="text-sm font-sans font-medium text-emerald-100">unidades</span>
            </div>
          </div>
          <p className="text-xs text-emerald-100/90 mt-3 pt-3 border-t border-white/10 font-medium">
            Registradas y protegidas de reactivación
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Monto Total Vendido</span>
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono truncate" title={formatCurrency(metrics.mySalesAmount)}>
              {formatCurrency(metrics.mySalesAmount)}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
            Promedio: <strong className="text-slate-800 font-mono">{formatCurrency(metrics.myAvgPrice)}</strong> / unidad
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Ventas Otros Asesores</span>
              <Users className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="text-3xl font-black text-slate-800 font-mono">
              {metrics.otherSalesCount} <span className="text-sm font-sans font-medium text-slate-400">unidades</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
            Total ventas registradas: <strong className="text-slate-800 font-mono">{metrics.allSoldCount}</strong>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Fuera de Stock</span>
              <Archive className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-black text-slate-800 font-mono">
              {metrics.historicalCount} <span className="text-sm font-sans font-medium text-slate-400">históricas</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
            Unidades no presentes en último PDF
          </p>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Pestañas de estado de ventas */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              id="tab-sales-self"
              onClick={() => setSalesFilter('self')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                salesFilter === 'self'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Mis Ventas ({metrics.mySalesCount})
            </button>

            <button
              id="tab-sales-other"
              onClick={() => setSalesFilter('other')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                salesFilter === 'other'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Otros Asesores ({metrics.otherSalesCount})
            </button>

            <button
              id="tab-sales-all"
              onClick={() => setSalesFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                salesFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Todas las Ventas ({metrics.allSoldCount})
            </button>

            <button
              id="tab-sales-historical"
              onClick={() => setSalesFilter('historical')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                salesFilter === 'historical'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Fuera de Stock ({metrics.historicalCount})
            </button>
          </div>

          {/* Buscador */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por patente, modelo..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-medium text-slate-700"
            >
              <option value="fecha_desc">Fecha (más reciente)</option>
              <option value="precio_desc">Mayor precio</option>
              <option value="marca_asc">Marca A-Z</option>
            </select>
          </div>
        </div>

        {/* Subfiltro de Facturación para Mis Ventas */}
        {salesFilter === 'self' && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Filtrar Facturación:</span>
            </span>
            <button
              type="button"
              onClick={() => setInvoiceFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                invoiceFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              TODAS ({metrics.mySalesCount})
            </button>
            <button
              type="button"
              onClick={() => setInvoiceFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                invoiceFilter === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>PENDIENTES DE FACTURACIÓN ({metrics.myPendingInvoiceCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setInvoiceFilter('invoiced')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                invoiceFilter === 'invoiced'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>FACTURADAS ({metrics.myInvoicedCount})</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabla de Unidades Vendidas / Históricas */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredList.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <UserCheck className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
            <p className="text-sm font-semibold text-slate-600">
              No hay unidades para este criterio de búsqueda.
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Cuando concrete una operación, márquela como vendida desde la ficha del vehículo en el stock.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Patente</th>
                  <th className="py-3 px-4">Vehículo</th>
                  <th className="py-3 px-3">Fecha Venta</th>
                  <th className="py-3 px-3">Estado Facturación</th>
                  <th className="py-3 px-4 text-right">Precio Venta</th>
                  <th className="py-3 px-3">Asesor / Propietario</th>
                  <th className="py-3 px-3">Situación (Ub)</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((v) => {
                  const isMySale = v.saleOwner === 'self';
                  const isOtherSale = v.saleOwner === 'other';

                  return (
                    <tr key={normalizePatent(v.patente) || v.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Patente */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded bg-slate-900 text-white font-mono font-bold">
                          {v.patente}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{v.id}</div>
                      </td>

                      {/* Vehículo */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onSelectVehicle(v)}
                          className="text-left font-bold text-slate-900 hover:text-blue-600 block transition-colors text-sm"
                        >
                          {v.marca} {v.modelo}
                        </button>
                        <div className="text-slate-500 text-xs">
                          {v.version} • {v.anio} • {formatKm(v.kilometraje)}
                        </div>
                      </td>

                      {/* Fecha Venta */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-700 font-medium">
                        {v.soldAt ? (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {v.soldAt.slice(0, 10)}
                          </span>
                        ) : v.fechaSalidaStock ? (
                          <span className="text-slate-400 font-mono">
                            Salida: {v.fechaSalidaStock.slice(0, 10)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No registrada</span>
                        )}
                      </td>

                      {/* Estado Facturación (Determina el mes de Volumen Facturado) */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isMySale ? (
                          v.fechaFacturacion ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                                <span>FACTURADA</span>
                              </span>
                              <div className="text-[11px] font-mono text-slate-700 font-bold flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{formatDateDMY(v.fechaFacturacion)}</span>
                              </div>
                              <div className="flex items-center gap-2 pt-0.5 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInvoiceModalVehicle(v);
                                    setInvoiceDateInput(v.fechaFacturacion ? v.fechaFacturacion.slice(0, 10) : '');
                                  }}
                                  className="text-blue-700 hover:text-blue-900 hover:underline font-bold cursor-pointer"
                                  title="Editar fecha de facturación"
                                >
                                  Editar fecha
                                </button>
                                <span className="text-slate-300">•</span>
                                <button
                                  type="button"
                                  onClick={() => setPendingConfirmVehicle(v)}
                                  className="text-rose-600 hover:text-rose-800 hover:underline font-semibold cursor-pointer"
                                  title="Marcar como pendiente"
                                >
                                  Marcar pendiente
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                                <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                                <span>PENDIENTE DE FACTURACIÓN</span>
                              </span>
                              <div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInvoiceModalVehicle(v);
                                    setInvoiceDateInput(new Date().toISOString().split('T')[0]);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold cursor-pointer shadow-2xs transition-colors"
                                >
                                  <FileCheck className="w-3 h-3" />
                                  <span>MARCAR FACTURADA</span>
                                </button>
                              </div>
                            </div>
                          )
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Precio Venta & Comisión */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-extrabold text-sm text-slate-900 font-mono">
                          {formatCurrency(v.soldPrice || v.precio)}
                        </span>
                        {v.soldPrice && v.soldPrice !== v.precio && (
                          <div className="text-[10px] text-slate-400 line-through">
                            Lista: {formatCurrency(v.precio)}
                          </div>
                        )}
                        {isMySale && (
                          <div className="mt-1">
                            {v.comisionBaseCalculada !== undefined && v.comisionBaseCalculada !== null ? (
                              <div className="text-[11px] font-mono font-bold text-blue-700">
                                Com: {formatCurrency(v.comisionBaseCalculada)}
                                {v.tieneTomaUsado && v.comisionTomaCalculada ? (
                                  <span className="text-teal-700 ml-1">
                                    (+{formatCurrency(v.comisionTomaCalculada)})
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenMarkAsSold(v)}
                                className="text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1 cursor-pointer"
                                title="Completar datos para cálculo de comisión"
                              >
                                <span>Completar datos</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Asesor / Clasificación */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isMySale ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Vendida por mí
                          </span>
                        ) : isOtherSale ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            <Users className="w-3.5 h-3.5 text-blue-500" />
                            Otro asesor
                          </span>
                        ) : v.isHistorical ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            Fuera de stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            Sin clasificar
                          </span>
                        )}
                      </td>

                      {/* Situación (Ub) y Empresa */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-600">
                        <div>{v.ubicacion || '—'}</div>
                        <div className="text-[10px] text-slate-400">{v.empresa || 'Autonet'}</div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectVehicle(v)}
                            title="Ver ficha completa"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenMarkAsSold(v)}
                            title="Editar datos de la venta / Revertir a disponible"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 font-semibold transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Gestionar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: FECHA DE FACTURACIÓN */}
      {invoiceModalVehicle && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => e.target === e.currentTarget && setInvoiceModalVehicle(null)}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-sm uppercase tracking-wide">
                  FECHA DE FACTURACIÓN
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceModalVehicle(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="font-extrabold text-slate-900 text-sm">
                  {invoiceModalVehicle.marca} {invoiceModalVehicle.modelo} {invoiceModalVehicle.version}
                </div>
                <div className="text-slate-500 flex items-center gap-2">
                  <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">
                    {invoiceModalVehicle.patente}
                  </span>
                  <span>Venta: {formatDateDMY(invoiceModalVehicle.soldAt) || 'S/D'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Fecha de facturación real *</span>
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Fecha informada por Administración. Determina exclusivamente el mes en que sumará para el objetivo Volumen Facturado.
                </p>
                <input
                  type="date"
                  required
                  value={invoiceDateInput}
                  onChange={(e) => setInvoiceDateInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInvoiceModalVehicle(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!invoiceDateInput}
                  onClick={() => {
                    if (invoiceModalVehicle && invoiceDateInput) {
                      stockService.setVehicleFacturacion(invoiceModalVehicle.patente, invoiceDateInput);
                      setInvoiceModalVehicle(null);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  CONFIRMAR FACTURACIÓN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN: MARCAR COMO PENDIENTE */}
      {pendingConfirmVehicle && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => e.target === e.currentTarget && setPendingConfirmVehicle(null)}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-white" />
                <h3 className="font-extrabold text-sm uppercase tracking-wide">
                  Marcar como Pendiente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingConfirmVehicle(null)}
                className="p-1 rounded-lg text-amber-100 hover:text-white hover:bg-amber-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                ¿Confirmás marcar la unidad <strong className="font-bold text-slate-900">{pendingConfirmVehicle.patente}</strong> ({pendingConfirmVehicle.marca} {pendingConfirmVehicle.modelo}) como <strong className="text-amber-900 font-bold">Pendiente de Facturación</strong>?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                Se eliminará la fecha de facturación actual ({formatDateDMY(pendingConfirmVehicle.fechaFacturacion)}) y la unidad dejará de sumar para el objetivo Volumen hasta que se vuelva a registrar una fecha válida.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPendingConfirmVehicle(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pendingConfirmVehicle) {
                      stockService.setVehicleFacturacion(pendingConfirmVehicle.patente, null);
                      setPendingConfirmVehicle(null);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
                >
                  Confirmar y Quitar Fecha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
