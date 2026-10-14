import React from 'react';
import { FileText, Search, Plus, Copy, Check, Eye, Calculator, Trash2, MessageCircle, Clock, User, Phone, AlertTriangle, X } from 'lucide-react';
import { CommercialBudget, quoteService } from '../../services/quoteService';
import { Vehicle } from '../../types/stock';
import { formatCurrency } from '../../utils/formatters';
import { normalizeText } from '../../utils/search';
import { isSameVehicle } from '../../utils/vehicleIdentity';
import { EmptyState } from '../ui/EmptyState';
import { StatusBadge } from '../ui/StatusBadge';

interface BudgetsViewProps {
  vehicles: Vehicle[];
  onOpenBudget: (b: CommercialBudget) => void;
  onQuoteVehicle: (v: Vehicle) => void;
  onNewQuote: () => void;
  onToast: (text: string, type?: 'success' | 'info' | 'warn') => void;
}

type Scope = 'todos' | 'vigentes' | 'vencidos';

const dayKey = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Hoy';
  if (same(d, yest)) return 'Ayer';
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
};

const timeLeft = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

const Kpi: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: string }> = ({ label, value, hint, tone = 'text-slate-900' }) => (
  <div className="autonet-card px-4 py-3.5">
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
    <div className={`text-2xl font-extrabold tabular mt-0.5 ${tone}`}>{value}</div>
    {hint && <div className="text-[11.5px] text-slate-500 mt-0.5">{hint}</div>}
  </div>
);

export const BudgetsView: React.FC<BudgetsViewProps> = ({ vehicles, onOpenBudget, onQuoteVehicle, onNewQuote, onToast }) => {
  const [budgets, setBudgets] = React.useState<CommercialBudget[]>(() => quoteService.getBudgetHistory());
  const [q, setQ] = React.useState('');
  const [scope, setScope] = React.useState<Scope>('todos');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [, forceTick] = React.useState(0);

  React.useEffect(() => quoteService.subscribeBudgets(setBudgets), []);
  // Refresca "vence en…" cada minuto
  React.useEffect(() => {
    const t = setInterval(() => forceTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const isValid = (b: CommercialBudget) => new Date(b.fechaVencimiento).getTime() > now;

  const stats = React.useMemo(() => {
    const month = new Date();
    const thisMonth = budgets.filter((b) => {
      const d = new Date(b.fechaEmision);
      return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
    });
    const clients = new Set(budgets.map((b) => normalizeText(b.datosCliente?.nombre || '')).filter(Boolean));
    return {
      total: budgets.length,
      vigentes: budgets.filter(isValid).length,
      mes: thisMonth.length,
      clientes: clients.size,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets]);

  const filtered = React.useMemo(() => {
    const nq = normalizeText(q);
    return budgets.filter((b) => {
      if (scope === 'vigentes' && !isValid(b)) return false;
      if (scope === 'vencidos' && isValid(b)) return false;
      if (!nq) return true;
      const v = b.vehiculo;
      const hay = normalizeText(
        `${b.numeroPresupuesto} ${v.patente} ${v.marca} ${v.modelo} ${v.version} ${v.anio} ${b.datosCliente?.nombre || ''} ${b.datosCliente?.telefono || ''}`
      );
      return nq.split(/\s+/).every((t) => hay.includes(t));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets, q, scope]);

  const groups = React.useMemo(() => {
    const map = new Map<string, CommercialBudget[]>();
    filtered.forEach((b) => {
      const k = dayKey(b.fechaEmision);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(b);
    });
    return [...map.entries()];
  }, [filtered]);

  const findVehicle = (b: CommercialBudget) => vehicles.find((v) => isSameVehicle(v, b.vehiculo.patente));

  const copyWhatsApp = async (b: CommercialBudget) => {
    const text = quoteService.formatBudgetWhatsAppMessage(b);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(b.id);
      setTimeout(() => setCopiedId(null), 2000);
      onToast('Mensaje de WhatsApp copiado al portapapeles.', 'success');
    } catch {
      onToast('No se pudo copiar automáticamente. Abrí el presupuesto y copiá desde ahí.', 'warn');
    }
  };

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="lg:hidden">
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Presupuestos</h1>
          <p className="text-[13px] text-slate-500">Todo lo que le enviaste a tus clientes, listo para reenviar o retomar.</p>
        </div>
        <p className="hidden lg:block text-[13px] text-slate-500">Todo lo que le enviaste a tus clientes, listo para reenviar o retomar.</p>
        <button type="button" onClick={onNewQuote} className="btn btn-primary self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Nueva cotización
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Vigentes ahora" value={stats.vigentes} hint="Validez de 24 h" tone="text-emerald-600" />
        <Kpi label="Este mes" value={stats.mes} hint="Presupuestos emitidos" />
        <Kpi label="Clientes" value={stats.clientes} hint="Con nombre cargado" />
        <Kpi label="Total guardados" value={stats.total} hint="En este dispositivo" />
      </div>

      {/* Búsqueda + segmentado */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente, teléfono, patente, modelo o N°…"
            className="field !h-11 !rounded-xl pl-10"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Borrar">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 p-1 bg-slate-200/60 rounded-xl text-[12.5px] font-bold sm:w-80">
          {(
            [
              ['todos', 'Todos'],
              ['vigentes', 'Vigentes'],
              ['vencidos', 'Vencidos'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setScope(v)} className={`py-2 rounded-lg ${scope === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Listado */}
      {budgets.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="Todavía no emitiste presupuestos"
          description="Cotizá cualquier unidad del stock y tocá “Generar presupuesto”. Quedará guardado acá para reenviarlo cuando quieras."
          action={
            <button type="button" onClick={onNewQuote} className="btn btn-primary">
              <Calculator className="w-4 h-4" /> Cotizar una unidad
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search className="w-6 h-6" />} title="Sin resultados" description="No hay presupuestos que coincidan con la búsqueda." />
      ) : (
        <div className="space-y-6">
          {groups.map(([day, list]) => (
            <section key={day}>
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 first-letter:uppercase">{day}</h3>
              <div className="autonet-card divide-y divide-slate-100 overflow-hidden">
                {list.map((b) => {
                  const valid = isValid(b);
                  const left = timeLeft(b.fechaVencimiento);
                  const current = findVehicle(b);
                  const priceChanged = current && current.precio !== null && current.precio !== undefined && current.precio !== b.precioVehiculo;
                  const notAvailable = current && (current.estado === 'Vendido' || current.isHistorical);
                  const waLink = quoteService.buildWhatsAppLink(b.datosCliente?.telefono, quoteService.formatBudgetWhatsAppMessage(b));
                  return (
                    <article key={b.id} className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5 hover:bg-slate-50/60 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11.5px] font-bold text-slate-500">{b.numeroPresupuesto}</span>
                          {valid ? (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                              <Clock className="w-3 h-3" /> Vence en {left}
                            </span>
                          ) : (
                            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Vencido</span>
                          )}
                          {current && <StatusBadge vehicle={current} size="sm" />}
                        </div>
                        <div className="mt-1 text-[15px] font-extrabold text-slate-900 truncate">
                          {b.vehiculo.marca} {b.vehiculo.modelo} <span className="font-semibold text-slate-500">{b.vehiculo.version}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-slate-600">
                          <span className="plate !text-[0.65rem]">{b.vehiculo.patente}</span>
                          <span>{b.vehiculo.anio}</span>
                          {b.datosCliente?.nombre ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                              <User className="w-3.5 h-3.5 text-slate-400" /> {b.datosCliente.nombre}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Sin cliente</span>
                          )}
                          {b.datosCliente?.telefono && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-slate-400" /> {b.datosCliente.telefono}
                            </span>
                          )}
                        </div>
                        {(priceChanged || notAvailable) && (
                          <div className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {notAvailable
                              ? 'La unidad ya no está disponible.'
                              : `El precio cambió: hoy ${formatCurrency(current!.precio, current!.moneda)}.`}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between lg:justify-end gap-4">
                        <div className="text-left lg:text-right">
                          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Total estimado</div>
                          <div className="text-lg font-extrabold tabular text-slate-950">{formatCurrency(b.totalEstimado)}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => onOpenBudget(b)} className="btn btn-sm btn-secondary" title="Ver, imprimir o editar cliente">
                            <Eye className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Ver</span>
                          </button>
                          {waLink ? (
                            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white" title="Abrir chat de WhatsApp con el mensaje listo">
                              <MessageCircle className="w-3.5 h-3.5" /> <span className="hidden sm:inline">WhatsApp</span>
                            </a>
                          ) : (
                            <button type="button" onClick={() => copyWhatsApp(b)} className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white" title="Copiar mensaje de WhatsApp">
                              {copiedId === b.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span className="hidden sm:inline">{copiedId === b.id ? 'Copiado' : 'Copiar'}</span>
                            </button>
                          )}
                          {current && !notAvailable && (
                            <button type="button" onClick={() => onQuoteVehicle(current)} className="btn btn-sm btn-ghost" title="Recotizar con datos actuales">
                              <Calculator className="w-4 h-4" />
                            </button>
                          )}
                          {confirmDelete === b.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                quoteService.deleteBudget(b.id);
                                setConfirmDelete(null);
                                onToast(`Presupuesto ${b.numeroPresupuesto} eliminado.`, 'info');
                              }}
                              onBlur={() => setConfirmDelete(null)}
                              className="btn btn-sm btn-brand"
                              autoFocus
                            >
                              Confirmar
                            </button>
                          ) : (
                            <button type="button" onClick={() => setConfirmDelete(b.id)} className="btn btn-sm btn-ghost hover:!text-brand-700" title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
