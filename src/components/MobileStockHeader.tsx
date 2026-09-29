import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  X, 
  SlidersHorizontal, 
  RotateCcw, 
  Check, 
  Sparkles,
  ArrowUpDown,
  Building2,
  MapPin,
  Calendar,
  Gauge,
  DollarSign
} from 'lucide-react';
import { StockFilters, Vehicle } from '../types/stock';
import { countActiveAdvancedFilters } from '../utils/stockSelectors';

interface MobileStockHeaderProps {
  filters: StockFilters;
  onFilterChange: (filters: StockFilters) => void;
  onResetFilters: () => void;
  availableVehicles: Vehicle[];
  totalResults: number;
  stockCounts: {
    activo: number;
    disponible: number;
    reservado: number;
    misVentas: number;
    ventasOtros: number;
    fueraStock: number;
    todos: number;
  };
  sortBy: 'disponibles_primero' | 'precio_asc' | 'precio_desc' | 'km_asc' | 'anio_desc';
  onSortChange: (sort: 'disponibles_primero' | 'precio_asc' | 'precio_desc' | 'km_asc' | 'anio_desc') => void;
}

export const MobileStockHeader: React.FC<MobileStockHeaderProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  availableVehicles,
  totalResults,
  stockCounts,
  sortBy,
  onSortChange,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(filters.searchQuery);

  // Sincronizar valor local con los filtros si cambian externamente
  useEffect(() => {
    setLocalSearch(filters.searchQuery);
  }, [filters.searchQuery]);

  // Debounce de 100ms para el buscador móvil (mantiene reactividad fluida)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.searchQuery) {
        onFilterChange({
          ...filters,
          searchQuery: localSearch,
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [localSearch, filters, onFilterChange]);

  // Empresas únicas en el stock
  const empresasDisponibles = useMemo(() => {
    const map = new Map<string, number>();
    availableVehicles.forEach((v) => {
      if (v.empresa) {
        map.set(v.empresa, (map.get(v.empresa) || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [availableVehicles]);

  // Ubicaciones operativas únicas en el stock
  const ubicacionesDisponibles = useMemo(() => {
    const map = new Map<string, number>();
    availableVehicles.forEach((v) => {
      if (v.ubicacion) {
        map.set(v.ubicacion, (map.get(v.ubicacion) || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [availableVehicles]);

  // Cálculo de filtros activos para el badge del botón [Filtros]
  const activeFiltersCount = useMemo(() => {
    let count = countActiveAdvancedFilters(filters);
    if (filters.estadoComercial && filters.estadoComercial !== 'activo') {
      count += 1;
    }
    if (sortBy !== 'disponibles_primero') {
      count += 1;
    }
    return count;
  }, [filters, sortBy]);

  const updateFilter = (key: keyof StockFilters, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const handleApplyPreset = (preset: 'vw_menos_50k' | 'pickups_4x4' | 'hasta_30m' | 'pendientes') => {
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
    } else if (preset === 'pendientes') {
      onFilterChange({
        ...filters,
        ubicacion: 'P',
        estadoComercial: 'activo',
      });
    }
    setDrawerOpen(false);
  };

  const handleClearAll = () => {
    setLocalSearch('');
    onResetFilters();
    onSortChange('disponibles_primero');
  };

  const commercialOptions: { label: string; value: StockFilters['estadoComercial']; count: number }[] = [
    { label: 'Stock Activo', value: 'activo', count: stockCounts.activo },
    { label: 'Disponibles', value: 'Disponible', count: stockCounts.disponible },
    { label: 'Reservados', value: 'Reservado', count: stockCounts.reservado },
    { label: 'Vendidas por mí', value: 'vendidas_propias', count: stockCounts.misVentas },
    { label: 'Vendidas por otros', value: 'vendidas_otros', count: stockCounts.ventasOtros },
    { label: 'Fuera de stock', value: 'fuera_de_stock', count: stockCounts.fueraStock },
    { label: 'Todos', value: 'todos', count: stockCounts.todos },
  ];

  return (
    <>
      {/* 
        BLOQUE SUPERIOR MÓVIL STICKY (<= 768px: md:hidden)
        top-16 coincide exactamente con la altura del header (64px / h-16)
      */}
      <div className="md:hidden sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs -mx-4 px-4 py-2.5 space-y-2">
        {/* 1. Buscador como elemento principal (mínimo 48px de alto, sticky, ancho completo) */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <input
            id="mobile-search-input"
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="BUSCAR PATENTE, MARCA O MODELO"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="w-full h-12 min-h-[48px] pl-10 pr-10 bg-slate-100/90 focus:bg-white text-slate-900 placeholder:text-slate-400 placeholder:font-bold placeholder:text-xs text-sm font-semibold rounded-xl border border-slate-200 focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition-all"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                updateFilter('searchQuery', '');
              }}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 active:scale-95 cursor-pointer"
              title="Borrar búsqueda"
              aria-label="Borrar búsqueda"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 2. Resumen compacto en una sola línea + botón [Filtros] */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {/* Resumen compacto y resultados */}
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 leading-tight">
              <span className="text-red-700 font-extrabold">{totalResults} resultados</span>
              {filters.searchQuery && (
                <span className="text-[11px] text-slate-400 font-medium truncate max-w-[120px]">
                  para &quot;{filters.searchQuery}&quot;
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
              {stockCounts.activo} activos · {stockCounts.disponible} disponibles · {stockCounts.reservado} reservados
            </div>
          </div>

          {/* Botón [Filtros] con badge de filtros activos */}
          <button
            id="mobile-open-filters-btn"
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer shadow-2xs ${
              activeFiltersCount > 0
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-extrabold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 3. DRAWER / MODAL MÓVIL DE FILTROS */}
      {drawerOpen && (
        <div 
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setDrawerOpen(false)}
        >
          <div 
            className="w-full max-h-[85vh] bg-white rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Drawer */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  Filtros de Stock
                </h3>
                {activeFiltersCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                    {activeFiltersCount} activo{activeFiltersCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                aria-label="Cerrar filtros"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido con scroll */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Sección A: Estado Comercial */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Estado Comercial
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {commercialOptions.map((opt) => {
                    const isSelected = (filters.estadoComercial || 'activo') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateFilter('estadoComercial', opt.value)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate mr-1">{opt.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          isSelected ? 'bg-red-700 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {opt.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sección B: Ordenamiento */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ordenamiento</span>
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => onSortChange(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-800 text-xs font-bold rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-red-600"
                >
                  <option value="disponibles_primero">Disponibles primero (Por defecto)</option>
                  <option value="precio_asc">Menor precio</option>
                  <option value="precio_desc">Mayor precio</option>
                  <option value="km_asc">Menor kilometraje</option>
                  <option value="anio_desc">Año más nuevo</option>
                </select>
              </div>

              {/* Sección C: Atajos Rápidos */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Atajos frecuentes</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('vw_menos_50k')}
                    className="p-2 text-left rounded-lg bg-slate-50 hover:bg-red-50 hover:text-red-700 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                  >
                    VW 2022+ (&lt;50k km)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('pickups_4x4')}
                    className="p-2 text-left rounded-lg bg-slate-50 hover:bg-red-50 hover:text-red-700 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                  >
                    Pickups 4x4 Diésel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('hasta_30m')}
                    className="p-2 text-left rounded-lg bg-slate-50 hover:bg-red-50 hover:text-red-700 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                  >
                    Hasta $30M
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('pendientes')}
                    className="p-2 text-left rounded-lg bg-slate-50 hover:bg-red-50 hover:text-red-700 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                  >
                    Pendientes (Ub: P)
                  </button>
                </div>
              </div>

              {/* Sección D: Empresa */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Empresa</span>
                </label>
                <select
                  value={filters.empresa || ''}
                  onChange={(e) => updateFilter('empresa', e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 text-xs font-medium rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-red-600"
                >
                  <option value="">Todas las empresas</option>
                  {empresasDisponibles.map(([emp, count]) => (
                    <option key={emp} value={emp}>
                      {emp} ({count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sección E: Ubicación */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ubicación</span>
                </label>
                <select
                  value={filters.ubicacion || ''}
                  onChange={(e) => updateFilter('ubicacion', e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 text-xs font-medium rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-red-600"
                >
                  <option value="">Todas las ubicaciones</option>
                  {ubicacionesDisponibles.map(([ub, count]) => (
                    <option key={ub} value={ub}>
                      {ub} ({count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sección F: Año */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Año (Mín - Máx)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={filters.anioMin || ''}
                    onChange={(e) => updateFilter('anioMin', e.target.value ? Number(e.target.value) : '')}
                    placeholder="Desde (ej: 2018)"
                    className="w-full bg-slate-50 text-slate-800 text-xs rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-red-600"
                  />
                  <input
                    type="number"
                    value={filters.anioMax || ''}
                    onChange={(e) => updateFilter('anioMax', e.target.value ? Number(e.target.value) : '')}
                    placeholder="Hasta (ej: 2024)"
                    className="w-full bg-slate-50 text-slate-800 text-xs rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-red-600"
                  />
                </div>
              </div>

              {/* Sección G: Kilometraje */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-slate-400" />
                  <span>Kilometraje Máximo</span>
                </label>
                <input
                  type="number"
                  value={filters.kmMax || ''}
                  onChange={(e) => updateFilter('kmMax', e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ej: 80000"
                  className="w-full bg-slate-50 text-slate-800 text-xs rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-red-600"
                />
              </div>

              {/* Sección H: Precio */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  <span>Precio Máximo ($)</span>
                </label>
                <input
                  type="number"
                  value={filters.precioMax || ''}
                  onChange={(e) => updateFilter('precioMax', e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ej: 30000000"
                  className="w-full bg-slate-50 text-slate-800 text-xs rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-red-600"
                />
              </div>
            </div>

            {/* Footer con acciones */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleClearAll}
                className="flex-1 py-3 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex-1 py-3 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Ver {totalResults} unidades</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
