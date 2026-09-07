import React from 'react';
import { 
  Search, 
  Filter, 
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

  // Modelos únicos basados en la marca seleccionada (o todos si no hay marca elegida)
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

  // Empresas / Sociedades comerciales únicas en el stock
  const empresasDisponibles = React.useMemo(() => {
    const map = new Map<string, number>();
    availableVehicles.forEach((v) => {
      if (v.empresa) {
        map.set(v.empresa, (map.get(v.empresa) || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [availableVehicles]);

  // Contar cuántos filtros activos hay (excluyendo el default de estado si es 'Disponible')
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (filters.searchQuery.trim()) count++;
    if (filters.marca) count++;
    if (filters.modelo) count++;
    if (filters.anioMin !== '') count++;
    if (filters.anioMax !== '') count++;
    if (filters.kmMin !== '') count++;
    if (filters.kmMax !== '') count++;
    if (filters.precioMin !== '') count++;
    if (filters.precioMax !== '') count++;
    if (filters.combustible) count++;
    if (filters.caja) count++;
    if (filters.traccion) count++;
    if (filters.ubicacion) count++;
    if (filters.empresa) count++;
    if (filters.estado && filters.estado !== 'Disponible') count++;
    return count;
  }, [filters]);

  const updateFilter = (key: keyof StockFilters, value: any) => {
    const updated = { ...filters, [key]: value };
    // Si cambia de marca, resetear modelo si ya no pertenece
    if (key === 'marca' && value !== filters.marca) {
      updated.modelo = '';
    }
    onFilterChange(updated);
  };

  // Atajos rápidos para consultas frecuentes de clientes
  const applyQuickPreset = (preset: 'vw_menos_50k' | 'pickups_4x4' | 'hasta_30m' | 'todos_los_estados' | 'pendientes') => {
    if (preset === 'vw_menos_50k') {
      onFilterChange({
        ...filters,
        marca: 'Volkswagen',
        modelo: '',
        anioMin: 2022,
        kmMax: 50000,
        estado: 'Disponible',
      });
    } else if (preset === 'pickups_4x4') {
      onFilterChange({
        ...filters,
        traccion: '4x4',
        combustible: 'Diésel',
        estado: 'Disponible',
      });
    } else if (preset === 'hasta_30m') {
      onFilterChange({
        ...filters,
        precioMax: 30000000,
        estado: 'Disponible',
      });
    } else if (preset === 'todos_los_estados') {
      onFilterChange({
        ...filters,
        estado: 'Todos',
      });
    } else if (preset === 'pendientes') {
      onFilterChange({
        ...filters,
        ubicacion: 'P',
      });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 mb-6 transition-all">
      
      {/* Buscador general superior */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            id="stock-search-input"
            type="text"
            value={filters.searchQuery}
            onChange={(e) => updateFilter('searchQuery', e.target.value)}
            placeholder="Buscar por patente, marca, modelo, versión..."
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-800 placeholder-slate-400 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
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

        {/* Botones de acción derecha */}
        <div className="flex items-center gap-2">
          <button
            id="toggle-advanced-filters"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
              showAdvanced || activeFiltersCount > 0
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4 text-slate-500 ml-0.5" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500 ml-0.5" />
            )}
          </button>

          {(activeFiltersCount > 0 || filters.estado !== 'Disponible') && (
            <button
              id="clear-filters-btn"
              onClick={onResetFilters}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors"
              title="Limpiar todos los filtros"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* Consultas frecuentes / atajos para el asesor mientras habla con el cliente */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Atajos asesor:
        </span>
        
        <button
          onClick={() => applyQuickPreset('vw_menos_50k')}
          className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-medium transition-colors border border-slate-200/60"
        >
          Volkswagen &lt; 50.000 km (≥ 2022)
        </button>

        <button
          onClick={() => applyQuickPreset('pickups_4x4')}
          className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-medium transition-colors border border-slate-200/60"
        >
          Pick-ups 4x4 Diésel
        </button>

        <button
          onClick={() => applyQuickPreset('hasta_30m')}
          className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-medium transition-colors border border-slate-200/60"
        >
          Hasta $ 30.000.000
        </button>

        <button
          onClick={() => applyQuickPreset('pendientes')}
          className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors border ${
            filters.ubicacion === 'P'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-700 border-slate-200/60'
          }`}
        >
          Pendientes (P)
        </button>

        <button
          onClick={() => applyQuickPreset('todos_los_estados')}
          className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors border ${
            filters.estado === 'Todos'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
          }`}
        >
          Ver todo el stock (incluye Vendidos)
        </button>
      </div>

      {/* Panel desplegable de filtros detallados combinables */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
          
          {/* Marca */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Marca
            </label>
            <select
              id="filter-marca"
              value={filters.marca}
              onChange={(e) => updateFilter('marca', e.target.value)}
              className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="">Todas las marcas ({marcasDisponibles.length})</option>
              {marcasDisponibles.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Modelo */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Modelo {filters.marca ? `(${filters.marca})` : ''}
            </label>
            <select
              id="filter-modelo"
              value={filters.modelo}
              onChange={(e) => updateFilter('modelo', e.target.value)}
              className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="">Todos los modelos</option>
              {modelosDisponibles.map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </select>
          </div>

          {/* Rango de Año */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Año (Mín - Máx)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                id="filter-anio-min"
                type="number"
                placeholder="Desde ej. 2021"
                min="2010"
                max="2026"
                value={filters.anioMin}
                onChange={(e) => updateFilter('anioMin', e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-500 focus:bg-white"
              />
              <input
                id="filter-anio-max"
                type="number"
                placeholder="Hasta ej. 2024"
                min="2010"
                max="2026"
                value={filters.anioMax}
                onChange={(e) => updateFilter('anioMax', e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Kilometraje Máximo */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Kilometraje máximo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                id="filter-km-min"
                type="number"
                placeholder="Desde km"
                value={filters.kmMin}
                onChange={(e) => updateFilter('kmMin', e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-500 focus:bg-white"
              />
              <input
                id="filter-km-max"
                type="number"
                placeholder="Hasta ej. 50000"
                value={filters.kmMax}
                onChange={(e) => updateFilter('kmMax', e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Precio Máximo */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Presupuesto (Precio Máx en $)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                id="filter-precio-min"
                type="number"
                placeholder="Precio Mín $"
                step="1000000"
                value={filters.precioMin}
                onChange={(e) => updateFilter('precioMin', e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-500 focus:bg-white"
              />
              <input
                id="filter-precio-max"
                type="number"
                placeholder="Precio Máx $"
                step="1000000"
                value={filters.precioMax}
                onChange={(e) => updateFilter('precioMax', e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Combustible */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Combustible
            </label>
            <select
              id="filter-combustible"
              value={filters.combustible}
              onChange={(e) => updateFilter('combustible', e.target.value)}
              className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="">Cualquier combustible</option>
              <option value="Nafta">Nafta</option>
              <option value="Diésel">Diésel</option>
              <option value="Híbrido">Híbrido</option>
              <option value="GNC">GNC</option>
            </select>
          </div>

          {/* Caja y Tracción */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Caja / Transmisión
            </label>
            <select
              id="filter-caja"
              value={filters.caja}
              onChange={(e) => updateFilter('caja', e.target.value)}
              className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="">Cualquier caja</option>
              <option value="Automática">Automática</option>
              <option value="Manual">Manual</option>
            </select>
          </div>

          {/* Tracción y Estado */}
          <div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Tracción
                </label>
                <select
                  id="filter-traccion"
                  value={filters.traccion}
                  onChange={(e) => updateFilter('traccion', e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-2 py-2 outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="">Todas</option>
                  <option value="4x2">4x2</option>
                  <option value="4x4">4x4</option>
                  <option value="AWD">AWD</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Estado
                </label>
                <select
                  id="filter-estado"
                  value={filters.estado}
                  onChange={(e) => updateFilter('estado', e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-2 py-2 outline-none focus:border-blue-500 focus:bg-white font-medium"
                >
                  <option value="Disponible">Disponible (Default)</option>
                  <option value="Reservado">Reservado</option>
                  <option value="Vendido">Vendido</option>
                  <option value="Todos">Todos los estados</option>
                </select>
              </div>
            </div>
          </div>

          {/* Situación Operativa / Localización (Ub) */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                Situación en Stock (Ub)
              </span>
              {filters.ubicacion && (
                <button
                  type="button"
                  onClick={() => updateFilter('ubicacion', '')}
                  className="text-slate-400 hover:text-slate-600 text-[10px]"
                >
                  Limpiar
                </button>
              )}
            </label>
            <select
              id="filter-ubicacion"
              value={filters.ubicacion || ''}
              onChange={(e) => updateFilter('ubicacion', e.target.value)}
              className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="">Todas las situaciones ({availableVehicles.length})</option>
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
            <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                Empresa / Procedencia
              </span>
              {filters.empresa && (
                <button
                  type="button"
                  onClick={() => updateFilter('empresa', '')}
                  className="text-slate-400 hover:text-slate-600 text-[10px]"
                >
                  Limpiar
                </button>
              )}
            </label>
            <select
              id="filter-empresa"
              value={filters.empresa || ''}
              onChange={(e) => updateFilter('empresa', e.target.value)}
              className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="">Todas las empresas ({empresasDisponibles.length})</option>
              {empresasDisponibles.map(([emp, count]) => (
                <option key={emp} value={emp}>
                  {emp} ({count})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
