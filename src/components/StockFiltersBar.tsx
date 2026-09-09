import React from 'react';
import { 
  Search, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  SlidersHorizontal,
  X,
  Sparkles,
  Building2,
  MapPin
} from 'lucide-react';
import { StockFilters, Vehicle } from '../types/stock';
import { getSituacionOperativaInfo } from '../utils/autonetHelpers';
import { calculateStockCounts, countActiveAdvancedFilters } from '../utils/stockSelectors';

interface StockFiltersBarProps {
  filters: StockFilters;
  onFilterChange: (filters: StockFilters) => void;
  onResetFilters: () => void;
  availableVehicles: Vehicle[];
  totalResults: number;
}

export const StockFiltersBar: React.FC<StockFiltersBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  availableVehicles,
  totalResults,
}) => {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // Marcas únicas en el stock actual
  const marcasDisponibles = React.useMemo(() => {
    const set = new Set<string>();
    availableVehicles.forEach((v) => {
      if (v.marca) set.add(v.marca);
    });
    return Array.from(set).sort();
  }, [availableVehicles]);

  // Modelos únicos basados en la marca seleccionada
  const modelosDisponibles = React.useMemo(() => {
    const set = new Set<string>();
    availableVehicles.forEach((v) => {
      if (!filters.marca || v.marca === filters.marca) {
        if (v.modelo) set.add(v.modelo);
      }
    });
    return Array.from(set).sort();
  }, [availableVehicles, filters.marca]);

  // Situaciones / Ubicaciones operativas únicas (Ub) en el stock
  const ubicacionesDisponibles = React.useMemo(() => {
    const map = new Map<string, number>();
    availableVehicles.forEach((v) => {
      if (v.ubicacion) {
        map.set(v.ubicacion, (map.get(v.ubicacion) || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [availableVehicles]);

  // Empresas únicas en el stock
  const empresasDisponibles = React.useMemo(() => {
    const map = new Map<string, number>();
    availableVehicles.forEach((v) => {
      if (v.empresa) {
        map.set(v.empresa, (map.get(v.empresa) || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [availableVehicles]);

  // Conteos centralizados desde la única fuente de verdad
  const commercialCounts = React.useMemo(() => {
    return calculateStockCounts(availableVehicles);
  }, [availableVehicles]);

  // Cantidad de filtros avanzados ACTIVOS (excluye búsqueda general y vista comercial)
  const activeAdvancedCount = React.useMemo(() => {
    return countActiveAdvancedFilters(filters);
  }, [filters]);

  const hasAnyFilterActive = React.useMemo(() => {
    return (
      activeAdvancedCount > 0 ||
      Boolean(filters.searchQuery && filters.searchQuery.trim()) ||
      (filters.estadoComercial && filters.estadoComercial !== 'activo')
    );
  }, [activeAdvancedCount, filters.searchQuery, filters.estadoComercial]);

  const updateFilter = (key: keyof StockFilters, value: any) => {
    const updated: StockFilters = { ...filters, [key]: value };
    // Si cambia de marca, resetear modelo si ya no pertenece
    if (key === 'marca' && value !== filters.marca) {
      updated.modelo = '';
    }
    onFilterChange(updated);
  };

  // Atajos rápidos para consultas frecuentes
  const applyQuickPreset = (preset: 'vw_menos_50k' | 'pickups_4x4' | 'hasta_30m' | 'todos_los_estados' | 'pendientes') => {
    if (preset === 'vw_menos_50k') {
      onFilterChange({
        ...filters,
        marca: 'Volkswagen',
        modelo: '',
        anioMin: 2022,
        kmMax: 50000,
        estadoComercial: 'Disponible',
      });
    } else if (preset === 'pickups_4x4') {
      onFilterChange({
        ...filters,
        traccion: '4x4',
        combustible: 'Diésel',
        estadoComercial: 'Disponible',
      });
    } else if (preset === 'hasta_30m') {
      onFilterChange({
        ...filters,
        precioMax: 30000000,
        estadoComercial: 'Disponible',
      });
    } else if (preset === 'todos_los_estados') {
      onFilterChange({
        ...filters,
        estadoComercial: 'todos',
      });
    } else if (preset === 'pendientes') {
      onFilterChange({
        ...filters,
        ubicacion: 'P',
        estadoComercial: 'activo',
      });
    }
  };

  const currentCommercial = filters.estadoComercial || 'activo';

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-3.5 sm:p-4 mb-5 transition-all">
      
      {/* 1. Selector de Vistas Comerciales (Switchers de estilo Autonet) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-3 border-b border-slate-100 scrollbar-none">
        <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline shrink-0">
          Vista:
        </span>
        
        <button
          type="button"
          id="tab-comercial-activo"
          onClick={() => updateFilter('estadoComercial', 'activo')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentCommercial === 'activo'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
          }`}
        >
          <span>Stock Activo</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
            currentCommercial === 'activo' ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'
          }`}>
            {commercialCounts.activo}
          </span>
        </button>

        <button
          type="button"
          id="tab-comercial-disponible"
          onClick={() => updateFilter('estadoComercial', 'Disponible')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentCommercial === 'Disponible'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
          }`}
        >
          <span>Disponibles</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
            currentCommercial === 'Disponible' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-200 text-slate-700'
          }`}>
            {commercialCounts.disponible}
          </span>
        </button>

        <button
          type="button"
          id="tab-comercial-reservado"
          onClick={() => updateFilter('estadoComercial', 'Reservado')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentCommercial === 'Reservado'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
          }`}
        >
          <span>Reservados</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
            currentCommercial === 'Reservado' ? 'bg-amber-700 text-amber-100' : 'bg-slate-200 text-slate-700'
          }`}>
            {commercialCounts.reservado}
          </span>
        </button>

        <button
          type="button"
          id="tab-comercial-mis-ventas"
          onClick={() => updateFilter('estadoComercial', 'vendidas_propias')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentCommercial === 'vendidas_propias'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
          }`}
        >
          <span>Vendidas por mí</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
            currentCommercial === 'vendidas_propias' ? 'bg-teal-800 text-teal-100' : 'bg-slate-200 text-slate-700'
          }`}>
            {commercialCounts.misVentas}
          </span>
        </button>

        <button
          type="button"
          id="tab-comercial-ventas-otros"
          onClick={() => updateFilter('estadoComercial', 'vendidas_otros')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentCommercial === 'vendidas_otros'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
          }`}
        >
          <span>Vendidas por otros</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
            currentCommercial === 'vendidas_otros' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-700'
          }`}>
            {commercialCounts.ventasOtros}
          </span>
        </button>

        <button
          type="button"
          id="tab-comercial-fuera-stock"
          onClick={() => updateFilter('estadoComercial', 'fuera_de_stock')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentCommercial === 'fuera_de_stock'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
          }`}
        >
          <span>Fuera de stock</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
            currentCommercial === 'fuera_de_stock' ? 'bg-slate-900 text-slate-300' : 'bg-slate-200 text-slate-700'
          }`}>
            {commercialCounts.fueraStock}
          </span>
        </button>

        <button
          type="button"
          id="tab-comercial-todos"
          onClick={() => updateFilter('estadoComercial', 'todos')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentCommercial === 'todos'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
          }`}
        >
          <span>Todos</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
            currentCommercial === 'todos' ? 'bg-slate-950 text-slate-300' : 'bg-slate-200 text-slate-700'
          }`}>
            {commercialCounts.todos}
          </span>
        </button>
      </div>

      {/* 2. Buscador general y Controles Principales */}
      <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="stock-search-input"
            type="text"
            value={filters.searchQuery}
            onChange={(e) => updateFilter('searchQuery', e.target.value)}
            placeholder="Buscar por patente, marca, modelo, versión..."
            className="w-full pl-9 pr-9 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-800 placeholder-slate-400 text-xs sm:text-sm rounded-lg border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
          />
          {filters.searchQuery && (
            <button
              onClick={() => updateFilter('searchQuery', '')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              title="Borrar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Acciones derecha: Botón Filtros (con badge estricto) y Limpiar */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="toggle-advanced-filters"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              showAdvanced || activeAdvancedCount > 0
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {activeAdvancedCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                {activeAdvancedCount}
              </span>
            )}
            {showAdvanced ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          {hasAnyFilterActive && (
            <button
              id="clear-filters-btn"
              onClick={onResetFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
              title="Restablecer todos los filtros a Stock Activo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Atajos rápidos de filtrado */}
      <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 mt-2.5 border-t border-slate-100 text-xs text-slate-500 scrollbar-none">
        <span className="flex items-center gap-1 font-bold text-slate-400 text-[10px] uppercase tracking-wider shrink-0">
          <Sparkles className="w-3 h-3 text-amber-500" /> Atajos:
        </span>
        <button
          type="button"
          onClick={() => applyQuickPreset('vw_menos_50k')}
          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[11px] font-medium transition-colors shrink-0"
        >
          VW 2022+ (&lt;50k km)
        </button>
        <button
          type="button"
          onClick={() => applyQuickPreset('pickups_4x4')}
          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[11px] font-medium transition-colors shrink-0"
        >
          Pickups 4x4 Diésel
        </button>
        <button
          type="button"
          onClick={() => applyQuickPreset('hasta_30m')}
          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[11px] font-medium transition-colors shrink-0"
        >
          Hasta $30M
        </button>
        <button
          type="button"
          onClick={() => applyQuickPreset('pendientes')}
          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[11px] font-medium transition-colors shrink-0"
        >
          Pendientes (Ub: P)
        </button>
      </div>

      {/* 4. Panel desplegable de Filtros Avanzados */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 rounded-xl">
          
          {/* Marca */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Marca
            </label>
            <select
              id="filter-marca"
              value={filters.marca}
              onChange={(e) => updateFilter('marca', e.target.value)}
              className="w-full bg-white text-slate-800 text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-600"
            >
              <option value="">Todas las marcas</option>
              {marcasDisponibles.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Modelo */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Modelo
            </label>
            <select
              id="filter-modelo"
              value={filters.modelo}
              onChange={(e) => updateFilter('modelo', e.target.value)}
              disabled={modelosDisponibles.length === 0}
              className="w-full bg-white text-slate-800 text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="">Todos los modelos</option>
              {modelosDisponibles.map((mod) => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
            </select>
          </div>

          {/* Rango de Año */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Año (Mín - Máx)
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="number"
                placeholder="Desde"
                value={filters.anioMin}
                onChange={(e) => updateFilter('anioMin', e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-white text-slate-800 text-xs rounded-lg border border-slate-200 px-2 py-2 outline-none focus:border-blue-600"
              />
              <input
                type="number"
                placeholder="Hasta"
                value={filters.anioMax}
                onChange={(e) => updateFilter('anioMax', e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-white text-slate-800 text-xs rounded-lg border border-slate-200 px-2 py-2 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Rango de Kilometraje */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Kilometraje Máximo
            </label>
            <input
              type="number"
              placeholder="Ej. 60000"
              value={filters.kmMax}
              onChange={(e) => updateFilter('kmMax', e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-white text-slate-800 text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-600"
            />
          </div>

          {/* Rango de Precio */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Precio Máximo ($)
            </label>
            <input
              type="number"
              placeholder="Ej. 25000000"
              value={filters.precioMax}
              onChange={(e) => updateFilter('precioMax', e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-white text-slate-800 text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-600"
            />
          </div>

          {/* Combustible */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Combustible
            </label>
            <select
              id="filter-combustible"
              value={filters.combustible}
              onChange={(e) => updateFilter('combustible', e.target.value)}
              className="w-full bg-white text-slate-800 text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-600"
            >
              <option value="">Todos</option>
              <option value="Nafta">Nafta</option>
              <option value="Diésel">Diésel</option>
              <option value="Híbrido">Híbrido</option>
              <option value="Eléctrico">Eléctrico</option>
            </select>
          </div>

          {/* Transmisión / Caja */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Transmisión
            </label>
            <select
              id="filter-caja"
              value={filters.caja}
              onChange={(e) => updateFilter('caja', e.target.value)}
              className="w-full bg-white text-slate-800 text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-600"
            >
              <option value="">Todas</option>
              <option value="Manual">Manual</option>
              <option value="Automática">Automática</option>
            </select>
          </div>

          {/* Tracción */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Tracción
            </label>
            <select
              id="filter-traccion"
              value={filters.traccion}
              onChange={(e) => updateFilter('traccion', e.target.value)}
              className="w-full bg-white text-slate-800 text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-600"
            >
              <option value="">Todas</option>
              <option value="4x2">4x2</option>
              <option value="4x4">4x4</option>
              <option value="AWD">AWD</option>
            </select>
          </div>

          {/* Situación Operativa / Localización (Ub) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-blue-600" />
                Situación (Ub)
              </span>
              {filters.ubicacion && (
                <button
                  type="button"
                  onClick={() => updateFilter('ubicacion', '')}
                  className="text-slate-400 hover:text-slate-600 text-[10px]"
                >
                  Borrar
                </button>
              )}
            </label>
            <select
              id="filter-ubicacion"
              value={filters.ubicacion || ''}
              onChange={(e) => updateFilter('ubicacion', e.target.value)}
              className="w-full bg-white text-slate-800 text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-600"
            >
              <option value="">Todas las situaciones</option>
              {ubicacionesDisponibles.map(([ub, count]) => {
                const info = getSituacionOperativaInfo(ub);
                return (
                  <option key={ub} value={ub}>
                    {info.label} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Empresa / Procedencia */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-500" />
                Empresa
              </span>
              {filters.empresa && (
                <button
                  type="button"
                  onClick={() => updateFilter('empresa', '')}
                  className="text-slate-400 hover:text-slate-600 text-[10px]"
                >
                  Borrar
                </button>
              )}
            </label>
            <select
              id="filter-empresa"
              value={filters.empresa || ''}
              onChange={(e) => updateFilter('empresa', e.target.value)}
              className="w-full bg-white text-slate-800 text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-600"
            >
              <option value="">Todas las empresas</option>
              {empresasDisponibles.map(([emp, count]) => (
                <option key={emp} value={emp}>
                  {emp} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Fotos Oficiales Autonet */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Fotos Autonet
            </label>
            <select
              id="filter-fotos"
              value={filters.fotosAutonet || 'todas'}
              onChange={(e) => updateFilter('fotosAutonet', e.target.value)}
              className="w-full bg-white text-slate-800 text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-600"
            >
              <option value="todas">Todas las unidades</option>
              <option value="con_fotos">Únicamente con fotos</option>
              <option value="sin_fotos">Sin fotos</option>
            </select>
          </div>

        </div>
      )}
    </div>
  );
};
