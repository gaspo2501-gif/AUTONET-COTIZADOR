import React from 'react';
import { X, RotateCcw, MapPin, Building2 } from 'lucide-react';
import { StockFilters, Vehicle } from '../../types/stock';
import { getSituacionOperativaInfo } from '../../utils/autonetHelpers';
import { countActiveAdvancedFilters } from '../../utils/stockSelectors';
import { useModalBehavior } from '../../hooks/useModalBehavior';

interface FilterPanelProps {
  filters: StockFilters;
  onChange: (f: StockFilters) => void;
  onClearAdvanced: () => void;
  onClose: () => void;
  /** Vehículos de la vista comercial actual (para opciones y conteos) */
  scopeVehicles: Vehicle[];
  resultCount: number;
}

const fmtMillions = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M` : `$${n.toLocaleString('es-AR')}`);

/** Input de dinero con separador de miles argentino */
export const MoneyInput: React.FC<{ value: number | ''; onChange: (v: number | '') => void; placeholder?: string; id?: string }> = ({ value, onChange, placeholder, id }) => (
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[13px] font-semibold">$</span>
    <input
      id={id}
      inputMode="numeric"
      className="field pl-7 tabular"
      placeholder={placeholder}
      value={value === '' ? '' : value.toLocaleString('es-AR')}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9]/g, '');
        onChange(digits ? Number(digits) : '');
      }}
    />
  </div>
);

const Section: React.FC<{ title: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
  <section className="py-4 border-b border-slate-100 last:border-0">
    <div className="flex items-center justify-between mb-2.5">
      <h4 className="field-label !mb-0">{title}</h4>
      {action}
    </div>
    {children}
  </section>
);

const ChipGroup: React.FC<{
  options: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((o) => (
      <button key={o.value} type="button" className="chip" data-active={value === o.value} onClick={() => onChange(value === o.value ? '' : o.value)}>
        {o.label}
        {o.count !== undefined && <span className="text-[10px] text-slate-400 font-bold tabular">{o.count}</span>}
      </button>
    ))}
  </div>
);

export const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onChange, onClearAdvanced, onClose, scopeVehicles, resultCount }) => {
  useModalBehavior(onClose);
  const set = <K extends keyof StockFilters>(key: K, value: StockFilters[K]) => {
    const next = { ...filters, [key]: value };
    if (key === 'marca' && value !== filters.marca) next.modelo = '';
    onChange(next);
  };

  const countBy = React.useCallback(
    (fn: (v: Vehicle) => string | undefined | null) => {
      const m = new Map<string, number>();
      scopeVehicles.forEach((v) => {
        const k = fn(v);
        if (k) m.set(k, (m.get(k) || 0) + 1);
      });
      return m;
    },
    [scopeVehicles]
  );

  const brands = React.useMemo(() => [...countBy((v) => v.marca).entries()].sort((a, b) => b[1] - a[1]), [countBy]);
  const models = React.useMemo(
    () =>
      [...countBy((v) => (!filters.marca || v.marca === filters.marca ? v.modelo : null)).entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')),
    [countBy, filters.marca]
  );
  const years = React.useMemo(() => Array.from(new Set<number>(scopeVehicles.map((v) => v.anio).filter(Boolean))).sort((a, b) => b - a), [scopeVehicles]);
  const ubs = React.useMemo(() => [...countBy((v) => v.ubicacion).entries()].sort((a, b) => b[1] - a[1]), [countBy]);
  const empresas = React.useMemo(() => [...countBy((v) => v.empresa).entries()].sort((a, b) => b[1] - a[1]), [countBy]);
  const fuels = countBy((v) => v.combustible);
  const gears = countBy((v) => v.caja);
  const tractions = countBy((v) => v.traccion);

  const activeCount = countActiveAdvancedFilters(filters);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Filtros de stock">
      <div className="absolute inset-0 bg-slate-950/45 anim-fade" onClick={onClose} />
      <div className="absolute bottom-0 inset-x-0 max-h-[88vh] rounded-t-3xl anim-sheet sm:anim-drawer sm:rounded-none sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:max-h-none bg-white flex flex-col shadow-[var(--shadow-sheet)]">
        <div className="sm:hidden flex justify-center pt-2.5">
          <span className="w-10 h-1.5 rounded-full bg-slate-200" />
        </div>
        <header className="px-5 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Filtros</h3>
            <p className="text-[12px] text-slate-500">
              {activeCount > 0 ? `${activeCount} filtro${activeCount > 1 ? 's' : ''} activo${activeCount > 1 ? 's' : ''}` : 'Refiná la búsqueda de unidades'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Cerrar filtros">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-5">
          <Section
            title="Marca"
            action={
              filters.marca ? (
                <button type="button" className="text-[11px] font-bold text-action-700" onClick={() => set('marca', '')}>
                  Quitar
                </button>
              ) : null
            }
          >
            <ChipGroup value={filters.marca} onChange={(v) => set('marca', v)} options={brands.map(([b, c]) => ({ value: b, label: b, count: c }))} />
          </Section>

          <Section title="Modelo">
            <select id="filter-modelo" className="field" value={filters.modelo} onChange={(e) => set('modelo', e.target.value)} disabled={models.length === 0}>
              <option value="">{filters.marca ? `Todos los modelos ${filters.marca}` : 'Todos los modelos'}</option>
              {models.map(([m, c]) => (
                <option key={m} value={m}>
                  {m} ({c})
                </option>
              ))}
            </select>
          </Section>

          <Section title="Precio">
            <div className="grid grid-cols-2 gap-2">
              <MoneyInput id="filter-precio-min" value={filters.precioMin} onChange={(v) => set('precioMin', v)} placeholder="Desde" />
              <MoneyInput id="filter-precio-max" value={filters.precioMax} onChange={(v) => set('precioMax', v)} placeholder="Hasta" />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[15_000_000, 20_000_000, 30_000_000, 40_000_000, 60_000_000].map((n) => (
                <button key={n} type="button" className="chip !py-1 !text-[11px]" data-active={filters.precioMax === n && filters.precioMin === ''} onClick={() => onChange({ ...filters, precioMin: '', precioMax: filters.precioMax === n ? '' : n })}>
                  Hasta {fmtMillions(n)}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Año">
            <div className="grid grid-cols-2 gap-2">
              <select className="field" value={filters.anioMin} onChange={(e) => set('anioMin', e.target.value ? Number(e.target.value) : '')} aria-label="Año desde">
                <option value="">Desde</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select className="field" value={filters.anioMax} onChange={(e) => set('anioMax', e.target.value ? Number(e.target.value) : '')} aria-label="Año hasta">
                <option value="">Hasta</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </Section>

          <Section title="Kilometraje máximo">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                { v: 0, l: '0 km' },
                { v: 30000, l: '30.000' },
                { v: 60000, l: '60.000' },
                { v: 100000, l: '100.000' },
                { v: 150000, l: '150.000' },
              ].map((o) => (
                <button key={o.v} type="button" className="chip !py-1 !text-[11px]" data-active={filters.kmMax === o.v} onClick={() => set('kmMax', filters.kmMax === o.v ? '' : o.v)}>
                  {o.l}
                </button>
              ))}
            </div>
            <input
              className="field tabular"
              inputMode="numeric"
              placeholder="Otro valor (km)"
              value={filters.kmMax === '' ? '' : Number(filters.kmMax).toLocaleString('es-AR')}
              onChange={(e) => {
                const d = e.target.value.replace(/[^0-9]/g, '');
                set('kmMax', d ? Number(d) : '');
              }}
            />
          </Section>

          <Section title="Combustible">
            <ChipGroup
              value={filters.combustible}
              onChange={(v) => set('combustible', v)}
              options={['Nafta', 'Diésel', 'GNC', 'Híbrido', 'Eléctrico'].filter((f) => fuels.get(f) || filters.combustible === f).map((f) => ({ value: f, label: f, count: fuels.get(f) || 0 }))}
            />
          </Section>

          <div className="grid grid-cols-2 gap-x-4">
            <Section title="Transmisión">
              <ChipGroup value={filters.caja} onChange={(v) => set('caja', v)} options={['Manual', 'Automática'].map((g) => ({ value: g, label: g === 'Automática' ? 'Automática' : 'Manual', count: gears.get(g) || 0 }))} />
            </Section>
            <Section title="Tracción">
              <ChipGroup value={filters.traccion} onChange={(v) => set('traccion', v)} options={['4x2', '4x4', 'AWD'].filter((t) => tractions.get(t) || filters.traccion === t).map((t) => ({ value: t, label: t, count: tractions.get(t) || 0 }))} />
            </Section>
          </div>

          <Section
            title={
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Situación (Ub)
              </span>
            }
          >
            <select id="filter-ubicacion" className="field" value={filters.ubicacion || ''} onChange={(e) => set('ubicacion', e.target.value)}>
              <option value="">Todas las situaciones</option>
              {ubs.map(([ub, c]) => (
                <option key={ub} value={ub}>
                  {getSituacionOperativaInfo(ub).label} ({c})
                </option>
              ))}
            </select>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Empresa
              </span>
            }
          >
            <select id="filter-empresa" className="field" value={filters.empresa || ''} onChange={(e) => set('empresa', e.target.value)}>
              <option value="">Todas las empresas</option>
              {empresas.map(([emp, c]) => (
                <option key={emp} value={emp}>
                  {emp} ({c})
                </option>
              ))}
            </select>
          </Section>

          <Section title="Fotos en la web de Autonet">
            <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-xl text-[12px] font-bold">
              {(
                [
                  ['todas', 'Todas'],
                  ['con_fotos', 'Con fotos'],
                  ['sin_fotos', 'Sin fotos'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set('fotosAutonet', v)}
                  className={`py-1.5 rounded-lg transition-colors ${(filters.fotosAutonet || 'todas') === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </Section>
        </div>

        <footer className="px-5 py-3.5 border-t border-slate-100 flex items-center gap-2 safe-bottom">
          <button type="button" onClick={onClearAdvanced} disabled={activeCount === 0} className="btn btn-secondary">
            <RotateCcw className="w-4 h-4" /> Limpiar
          </button>
          <button type="button" onClick={onClose} className="btn btn-primary flex-1 !py-2.5">
            Ver {resultCount} {resultCount === 1 ? 'unidad' : 'unidades'}
          </button>
        </footer>
      </div>
    </div>
  );
};
