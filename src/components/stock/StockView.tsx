import React from 'react';
import { Search, X, SlidersHorizontal, LayoutGrid, List, ArrowUpDown, SearchX, RotateCcw } from 'lucide-react';
import { CommercialFilter, StockFilters, Vehicle, VehicleStatus } from '../../types/stock';
import { applyStockFilters, countActiveAdvancedFilters, StockCounts } from '../../utils/stockSelectors';
import { sortVehicles, SORT_OPTIONS, StockSortKey, isSortKey } from '../../utils/stockSort';
import { normalizePatent } from '../../utils/vehicleIdentity';
import { getSituacionOperativaInfo } from '../../utils/autonetHelpers';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { VehicleCard } from '../VehicleCard';
import { MobileCompactVehicleCard } from '../MobileCompactVehicleCard';
import { VehicleTable } from '../VehicleTable';
import { EmptyState } from '../ui/EmptyState';
import { FilterPanel } from './FilterPanel';

interface StockViewProps {
  vehicles: Vehicle[];
  filters: StockFilters;
  onFiltersChange: React.Dispatch<React.SetStateAction<StockFilters>>;
  onResetFilters: () => void;
  defaultFilters: StockFilters;
  stockCounts: StockCounts;
  onSelect: (v: Vehicle) => void;
  onQuote: (v: Vehicle) => void;
  onStatusChange: (v: Vehicle | string, s: VehicleStatus) => void;
  onOpenMarkAsSold: (v: Vehicle) => void;
}

const COMMERCIAL_TABS: { value: CommercialFilter; label: string; countKey: keyof StockCounts; dot: string }[] = [
  { value: 'activo', label: 'Stock activo', countKey: 'activo', dot: 'bg-action-600' },
  { value: 'Disponible', label: 'Disponibles', countKey: 'disponible', dot: 'bg-emerald-500' },
  { value: 'Reservado', label: 'Reservados', countKey: 'reservado', dot: 'bg-amber-500' },
  { value: 'vendidas_propias', label: 'Vendidas por mí', countKey: 'misVentas', dot: 'bg-teal-600' },
  { value: 'vendidas_otros', label: 'Vendidas por otros', countKey: 'ventasOtros', dot: 'bg-indigo-500' },
  { value: 'fuera_de_stock', label: 'Fuera de stock', countKey: 'fueraStock', dot: 'bg-slate-400' },
  { value: 'todos', label: 'Todos', countKey: 'todos', dot: 'bg-slate-800' },
];

type Quick = { key: string; label: string; isActive: (f: StockFilters) => boolean; toggle: (f: StockFilters) => StockFilters };
const THIS_YEAR = new Date().getFullYear();
const QUICK_FILTERS: Quick[] = [
  { key: '0km', label: '0 km', isActive: (f) => f.kmMax === 0, toggle: (f) => ({ ...f, kmMax: f.kmMax === 0 ? '' : 0 }) },
  {
    key: 'recent',
    label: `${THIS_YEAR - 2} en adelante`,
    isActive: (f) => f.anioMin === THIS_YEAR - 2,
    toggle: (f) => ({ ...f, anioMin: f.anioMin === THIS_YEAR - 2 ? '' : THIS_YEAR - 2 }),
  },
  { key: 'hasta20', label: 'Hasta $20M', isActive: (f) => f.precioMax === 20_000_000, toggle: (f) => ({ ...f, precioMax: f.precioMax === 20_000_000 ? '' : 20_000_000 }) },
  { key: 'hasta30', label: 'Hasta $30M', isActive: (f) => f.precioMax === 30_000_000, toggle: (f) => ({ ...f, precioMax: f.precioMax === 30_000_000 ? '' : 30_000_000 }) },
  { key: 'auto', label: 'Automáticos', isActive: (f) => f.caja === 'Automática', toggle: (f) => ({ ...f, caja: f.caja === 'Automática' ? '' : 'Automática' }) },
  { key: '4x4', label: '4x4', isActive: (f) => f.traccion === '4x4', toggle: (f) => ({ ...f, traccion: f.traccion === '4x4' ? '' : '4x4' }) },
  { key: 'diesel', label: 'Diésel', isActive: (f) => f.combustible === 'Diésel', toggle: (f) => ({ ...f, combustible: f.combustible === 'Diésel' ? '' : 'Diésel' }) },
  { key: 'pend', label: 'Pendientes (Ub P)', isActive: (f) => f.ubicacion === 'P', toggle: (f) => ({ ...f, ubicacion: f.ubicacion === 'P' ? '' : 'P' }) },
];

const money = (n: number) => `$${n.toLocaleString('es-AR')}`;

function describeActiveFilters(f: StockFilters, defaults: StockFilters): { key: string; label: string; clear: (f: StockFilters) => StockFilters }[] {
  const out: { key: string; label: string; clear: (f: StockFilters) => StockFilters }[] = [];
  if (f.marca) out.push({ key: 'marca', label: f.marca, clear: (x) => ({ ...x, marca: '', modelo: '' }) });
  if (f.modelo) out.push({ key: 'modelo', label: f.modelo, clear: (x) => ({ ...x, modelo: '' }) });
  if (f.anioMin !== '' && f.anioMax !== '') out.push({ key: 'anio', label: `Año ${f.anioMin}–${f.anioMax}`, clear: (x) => ({ ...x, anioMin: '', anioMax: '' }) });
  else if (f.anioMin !== '') out.push({ key: 'anio', label: `Desde ${f.anioMin}`, clear: (x) => ({ ...x, anioMin: '' }) });
  else if (f.anioMax !== '') out.push({ key: 'anio', label: `Hasta ${f.anioMax}`, clear: (x) => ({ ...x, anioMax: '' }) });
  if (f.precioMin !== '' && f.precioMax !== '') out.push({ key: 'precio', label: `${money(f.precioMin)} – ${money(f.precioMax)}`, clear: (x) => ({ ...x, precioMin: '', precioMax: '' }) });
  else if (f.precioMin !== '') out.push({ key: 'precio', label: `Desde ${money(f.precioMin)}`, clear: (x) => ({ ...x, precioMin: '' }) });
  else if (f.precioMax !== '') out.push({ key: 'precio', label: `Hasta ${money(f.precioMax)}`, clear: (x) => ({ ...x, precioMax: '' }) });
  if (f.kmMin !== '') out.push({ key: 'kmMin', label: `Desde ${Number(f.kmMin).toLocaleString('es-AR')} km`, clear: (x) => ({ ...x, kmMin: '' }) });
  if (f.kmMax !== '') out.push({ key: 'kmMax', label: f.kmMax === 0 ? '0 km' : `Hasta ${Number(f.kmMax).toLocaleString('es-AR')} km`, clear: (x) => ({ ...x, kmMax: '' }) });
  if (f.combustible) out.push({ key: 'comb', label: f.combustible, clear: (x) => ({ ...x, combustible: '' }) });
  if (f.caja) out.push({ key: 'caja', label: f.caja, clear: (x) => ({ ...x, caja: '' }) });
  if (f.traccion) out.push({ key: 'trac', label: f.traccion, clear: (x) => ({ ...x, traccion: '' }) });
  if (f.ubicacion) out.push({ key: 'ub', label: `Ub: ${getSituacionOperativaInfo(f.ubicacion).shortLabel}`, clear: (x) => ({ ...x, ubicacion: '' }) });
  if (f.empresa) out.push({ key: 'emp', label: f.empresa, clear: (x) => ({ ...x, empresa: '' }) });
  if (f.fotosAutonet && f.fotosAutonet !== 'todas')
    out.push({ key: 'fotos', label: f.fotosAutonet === 'con_fotos' ? 'Con fotos web' : 'Sin fotos web', clear: (x) => ({ ...x, fotosAutonet: defaults.fotosAutonet }) });
  return out;
}

export const StockView: React.FC<StockViewProps> = ({
  vehicles,
  filters,
  onFiltersChange,
  onResetFilters,
  defaultFilters,
  stockCounts,
  onSelect,
  onQuote,
  onStatusChange,
  onOpenMarkAsSold,
}) => {
  const [sortBy, setSortBy] = usePersistentState<StockSortKey>('autonet_ui_sort_v2', 'disponibles_primero', isSortKey);
  const [viewMode, setViewMode] = usePersistentState<'cards' | 'table'>('autonet_ui_view_v2', 'cards', (v): v is 'cards' | 'table' => v === 'cards' || v === 'table');
  const [showFilters, setShowFilters] = React.useState(false);
  const [limit, setLimit] = React.useState(36);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Búsqueda: el input responde instantáneo, el filtrado se aplica con un pequeño debounce
  const [searchText, setSearchText] = React.useState(filters.searchQuery);
  const debouncedSearch = useDebouncedValue(searchText, 120);
  React.useEffect(() => {
    if (debouncedSearch !== filters.searchQuery) onFiltersChange((prev) => ({ ...prev, searchQuery: debouncedSearch }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  React.useEffect(() => {
    if (filters.searchQuery !== searchText && filters.searchQuery !== debouncedSearch) setSearchText(filters.searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.searchQuery]);

  // Atajo de teclado "/" para enfocar el buscador
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visibleVehicles = React.useMemo(() => sortVehicles(applyStockFilters(vehicles, filters), sortBy), [vehicles, filters, sortBy]);

  // Vehículos de la vista comercial (sin filtros avanzados) para opciones del panel
  const scopeVehicles = React.useMemo(
    () => applyStockFilters(vehicles, { ...defaultFilters, estadoComercial: filters.estadoComercial }),
    [vehicles, defaultFilters, filters.estadoComercial]
  );

  React.useEffect(() => setLimit(36), [filters, sortBy]);

  // Scroll infinito
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setLimit((l) => l + 36);
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleVehicles.length, limit, viewMode]);

  const shown = visibleVehicles.slice(0, limit);
  const advancedCount = countActiveAdvancedFilters(filters);
  const activeChips = describeActiveFilters(filters, defaultFilters);
  const commercial = filters.estadoComercial || 'activo';
  const query = filters.searchQuery;
  const hasAnything = advancedCount > 0 || Boolean(query.trim()) || commercial !== 'activo';

  const setCommercial = (value: CommercialFilter) => onFiltersChange((prev) => ({ ...prev, estadoComercial: value }));
  const clearAdvanced = () =>
    onFiltersChange((prev) => ({ ...defaultFilters, searchQuery: prev.searchQuery, estadoComercial: prev.estadoComercial }));
  const resetAll = () => {
    setSearchText('');
    onResetFilters();
  };

  const SortSelect = (
    <label className="relative inline-flex items-center">
      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
      <select
        id="stock-sort-select"
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as StockSortKey)}
        className="field !w-auto !py-2 !pl-8 !pr-8 !text-[12.5px] !font-bold appearance-none bg-[length:12px] bg-[right_0.6rem_center] bg-no-repeat"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        aria-label="Ordenar resultados"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-4">
      {/* ============ BARRA DE BÚSQUEDA (sticky en celular) ============ */}
      <div className="sticky top-14 lg:static z-20 -mx-4 sm:mx-0 px-4 sm:px-0 py-2.5 sm:py-0 bg-canvas/95 backdrop-blur-md sm:bg-transparent sm:backdrop-blur-none border-b border-slate-200/70 sm:border-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-[18px] h-[18px] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchRef}
              id="stock-search-input"
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchText('');
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Patente, marca, modelo, año, color…"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              className="w-full h-11 sm:h-12 pl-11 pr-10 sm:pr-24 rounded-2xl bg-white border border-slate-200 shadow-[var(--shadow-card)] text-[15px] font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-action-600 focus:ring-4 focus:ring-action-600/10 transition [&::-webkit-search-cancel-button]:hidden"
            />
            {searchText ? (
              <button
                type="button"
                onClick={() => {
                  setSearchText('');
                  searchRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Borrar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <span className="hidden sm:inline absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                Presioná <span className="kbd">/</span>
              </span>
            )}
          </div>
          <button
            id="toggle-advanced-filters"
            type="button"
            onClick={() => setShowFilters(true)}
            className={`btn h-11 sm:h-12 !rounded-2xl !px-3.5 sm:!px-4 border ${
              advancedCount > 0 ? 'bg-action-50 border-action-200 text-action-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-[18px] h-[18px]" />
            <span className="hidden sm:inline">Filtros</span>
            {advancedCount > 0 && (
              <span className="min-w-5 h-5 px-1 rounded-full bg-action-600 text-white text-[11px] font-black flex items-center justify-center">{advancedCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* ============ VISTAS COMERCIALES ============ */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Estado comercial">
        {COMMERCIAL_TABS.map((t) => {
          const active = commercial === t.value;
          const count = stockCounts[t.countKey];
          if (count === 0 && !active && (t.value === 'vendidas_otros' || t.value === 'fuera_de_stock')) return null;
          return (
            <button
              key={t.value}
              id={`tab-comercial-${t.value}`}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCommercial(t.value)}
              className={`shrink-0 inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl text-[12.5px] font-bold border transition-all ${
                active ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${t.dot}`} />
              {t.label}
              <span className={`tabular text-[11px] px-1.5 py-0.5 rounded-md ${active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ============ ATAJOS + FILTROS ACTIVOS ============ */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {activeChips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onFiltersChange((prev) => c.clear(prev))}
            className="chip shrink-0"
            data-active="true"
            title="Quitar filtro"
          >
            {c.label}
            <X className="w-3.5 h-3.5 opacity-60" />
          </button>
        ))}
        {QUICK_FILTERS.filter((q) => !q.isActive(filters)).map((q) => (
          <button key={q.key} type="button" onClick={() => onFiltersChange((prev) => q.toggle(prev))} className="chip shrink-0 !text-slate-500 !border-dashed">
            + {q.label}
          </button>
        ))}
        {hasAnything && (
          <button id="clear-filters-btn" type="button" onClick={resetAll} className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold text-brand-700 hover:underline px-2">
            <RotateCcw className="w-3.5 h-3.5" /> Limpiar todo
          </button>
        )}
      </div>

      {/* ============ RESUMEN + ORDEN + VISTA ============ */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-[13px] text-slate-600" aria-live="polite">
          <strong className="text-slate-900 tabular text-[15px]">{visibleVehicles.length}</strong>{' '}
          {visibleVehicles.length === 1 ? 'unidad' : 'unidades'}
          {query.trim() && (
            <>
              {' '}
              para <span className="font-bold text-slate-900">“{query.trim()}”</span>
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          {SortSelect}
          <div className="hidden md:flex items-center p-0.5 bg-slate-200/60 rounded-xl">
            <button
              id="view-mode-cards-btn"
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg ${viewMode === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              title="Vista tarjetas"
              aria-pressed={viewMode === 'cards'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              id="view-mode-table-btn"
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              title="Vista tabla"
              aria-pressed={viewMode === 'table'}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ============ RESULTADOS ============ */}
      {visibleVehicles.length === 0 ? (
        <EmptyState
          icon={<SearchX className="w-6 h-6" />}
          title="No hay unidades con esos criterios"
          description={
            query.trim()
              ? 'Probá con menos palabras, otra forma de escribir el modelo o solo los números de la patente.'
              : 'Quitá algún filtro o volvé al stock activo completo.'
          }
          action={
            <button type="button" onClick={resetAll} className="btn btn-primary">
              <RotateCcw className="w-4 h-4" /> Ver todo el stock activo
            </button>
          }
        />
      ) : (
        <>
          {/* Celular */}
          <div className="md:hidden flex flex-col gap-2.5">
            {shown.map((v) => (
              <MobileCompactVehicleCard key={normalizePatent(v.patente) || v.id} vehicle={v} onSelect={onSelect} onQuote={onQuote} query={query} />
            ))}
          </div>

          {/* Escritorio */}
          <div className="hidden md:block">
            {viewMode === 'cards' ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {shown.map((v) => (
                  <VehicleCard
                    key={normalizePatent(v.patente) || v.id}
                    vehicle={v}
                    onSelect={onSelect}
                    onStatusChange={onStatusChange}
                    onQuote={onQuote}
                    onOpenMarkAsSold={onOpenMarkAsSold}
                    query={query}
                  />
                ))}
              </div>
            ) : (
              <VehicleTable
                vehicles={shown}
                onSelect={onSelect}
                onStatusChange={onStatusChange}
                onQuote={onQuote}
                onOpenMarkAsSold={onOpenMarkAsSold}
                query={query}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />
            )}
          </div>

          {visibleVehicles.length > limit && (
            <div ref={sentinelRef} className="py-4 text-center">
              <button type="button" onClick={() => setLimit((l) => l + 36)} className="btn btn-secondary">
                Mostrar más ({visibleVehicles.length - limit} restantes)
              </button>
            </div>
          )}
        </>
      )}

      {showFilters && (
        <FilterPanel
          filters={filters}
          onChange={(f) => onFiltersChange(f)}
          onClearAdvanced={clearAdvanced}
          onClose={() => setShowFilters(false)}
          scopeVehicles={scopeVehicles}
          resultCount={visibleVehicles.length}
        />
      )}
    </div>
  );
};
