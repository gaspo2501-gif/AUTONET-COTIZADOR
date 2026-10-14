import React from 'react';
import { Search, Calculator, CornerDownLeft, ArrowRight } from 'lucide-react';
import { Vehicle } from '../types/stock';
import { matchesSearch } from '../utils/search';
import { formatCurrency, formatKm } from '../utils/formatters';
import { isActiveVehicle } from '../utils/stockSelectors';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { StatusBadge } from './ui/StatusBadge';
import { Highlight } from './ui/Highlight';
import { NAV_ITEMS, NavTab } from './layout/AppShell';
import { normalizeText } from '../utils/search';

interface CommandPaletteProps {
  vehicles: Vehicle[];
  onClose: () => void;
  onOpenVehicle: (v: Vehicle) => void;
  onQuoteVehicle: (v: Vehicle) => void;
  onNavigate: (tab: NavTab) => void;
}

/**
 * Buscador global (Ctrl/⌘ + K): encuentra cualquier unidad del stock (incluidas vendidas
 * e históricas) y salta a su ficha o a cotizarla, desde cualquier sección.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ vehicles, onClose, onOpenVehicle, onQuoteVehicle, onNavigate }) => {
  useModalBehavior(onClose);
  const [q, setQ] = React.useState('');
  const [cursor, setCursor] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const results = React.useMemo(() => {
    if (!q.trim()) return vehicles.filter(isActiveVehicle).slice(0, 6);
    const found = vehicles.filter((v) => matchesSearch(v, q));
    // Activos primero
    found.sort((a, b) => Number(isActiveVehicle(b)) - Number(isActiveVehicle(a)));
    return found.slice(0, 8);
  }, [vehicles, q]);

  const sections = React.useMemo(() => {
    const nq = normalizeText(q);
    if (!nq) return [];
    return NAV_ITEMS.filter((i) => normalizeText(i.label).includes(nq));
  }, [q]);

  const total = results.length + sections.length;
  React.useEffect(() => setCursor(0), [q]);
  React.useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const runAt = (idx: number, quote = false) => {
    if (idx < results.length) {
      const v = results[idx];
      onClose();
      quote ? onQuoteVehicle(v) : onOpenVehicle(v);
    } else {
      const s = sections[idx - results.length];
      if (s) {
        onClose();
        onNavigate(s.key);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center p-3 pt-[8vh] sm:pt-[12vh]" role="dialog" aria-modal="true" aria-label="Buscar unidad">
      <div className="absolute inset-0 bg-slate-950/50 anim-fade" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3 px-4 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(total - 1, c + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                runAt(cursor, e.ctrlKey || e.metaKey);
              }
            }}
            placeholder="Patente, marca, modelo o sección…"
            className="flex-1 h-14 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="kbd hidden sm:inline">Esc</span>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto scrollbar-thin p-2">
          {!q.trim() && <div className="px-3 pt-1 pb-2 text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Sugerencias del stock activo</div>}
          {results.length === 0 && sections.length === 0 && (
            <div className="px-3 py-10 text-center text-[13px] text-slate-500">
              Sin coincidencias para <strong className="text-slate-800">“{q}”</strong>
            </div>
          )}
          {results.map((v, i) => (
            <div
              key={v.patente || v.id}
              data-idx={i}
              onMouseMove={() => setCursor(i)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer ${cursor === i ? 'bg-action-50' : ''}`}
              onClick={() => runAt(i)}
            >
              <span className="plate shrink-0">
                <Highlight text={v.patente} query={q} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold text-slate-900 truncate">
                  <Highlight text={`${v.marca} ${v.modelo} ${v.version}`} query={q} />
                </div>
                <div className="text-[11.5px] text-slate-500 flex items-center gap-1.5">
                  <span>{v.anio}</span>·<span>{formatKm(v.kilometraje)}</span>·<span className="font-bold text-slate-700 tabular">{formatCurrency(v.precio, v.moneda)}</span>
                </div>
              </div>
              <span className="hidden sm:inline-flex"><StatusBadge vehicle={v} size="sm" /></span>
              {v.estado !== 'Vendido' && !v.isHistorical && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    runAt(i, true);
                  }}
                  className="btn btn-sm btn-primary !px-2"
                  title="Cotizar (Ctrl+Enter)"
                >
                  <Calculator className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {sections.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1.5 text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Ir a sección</div>
              {sections.map((s, j) => {
                const idx = results.length + j;
                return (
                  <div
                    key={s.key}
                    data-idx={idx}
                    onMouseMove={() => setCursor(idx)}
                    onClick={() => runAt(idx)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[13.5px] font-semibold text-slate-700 ${cursor === idx ? 'bg-action-50' : ''}`}
                  >
                    <s.icon className="w-4 h-4 text-slate-400" />
                    <span className="flex-1">{s.label}</span>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navegar
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="kbd">
              <CornerDownLeft className="w-2.5 h-2.5 inline" />
            </span>{' '}
            abrir ficha
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="kbd">Ctrl</span>+<span className="kbd">
              <CornerDownLeft className="w-2.5 h-2.5 inline" />
            </span>{' '}
            cotizar
          </span>
        </div>
      </div>
    </div>
  );
};
