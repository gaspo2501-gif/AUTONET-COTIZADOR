import React from 'react';
import { FileCheck2, Search, Download, Pencil, Trash2, AlertTriangle, Loader2, X, Building2 } from 'lucide-react';
import { boletoHistoryService, BoletoRecord } from '../../services/boletoHistoryService';
import { boletoPdfService } from '../../services/boletoPdfService';
import { BOLETO_TEMPLATES_CONFIG } from '../../config/boletoTemplates';
import { formatCurrency } from '../../utils/formatters';
import { normalizeText } from '../../utils/search';
import { EmptyState } from '../ui/EmptyState';

interface BoletosViewProps {
  onReopen: (rec: BoletoRecord) => void;
  onToast: (text: string, type?: 'success' | 'info' | 'warn') => void;
}

const monthLabel = (iso: string) => {
  const s = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const COMPANY_TONE: Record<string, string> = {
  MIRAGE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  IRUNA: 'bg-sky-50 text-sky-700 border-sky-200',
  OIL_BULL: 'bg-amber-50 text-amber-800 border-amber-200',
  AKIRA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const BoletosView: React.FC<BoletosViewProps> = ({ onReopen, onToast }) => {
  const [list, setList] = React.useState<BoletoRecord[]>(() => boletoHistoryService.getAll());
  const [q, setQ] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);

  React.useEffect(() => boletoHistoryService.subscribe(setList), []);

  const filtered = React.useMemo(() => {
    const nq = normalizeText(q);
    if (!nq) return list;
    return list.filter((b) => {
      const hay = normalizeText(
        `${b.clienteNombre} ${b.clienteDni || ''} ${b.vehiculo.patente} ${b.vehiculo.marca} ${b.vehiculo.modelo} ${b.vehiculo.version} ${b.companyKey}`
      );
      return nq.split(/\s+/).every((t) => hay.includes(t));
    });
  }, [list, q]);

  const groups = React.useMemo(() => {
    const m = new Map<string, BoletoRecord[]>();
    filtered.forEach((b) => {
      const k = monthLabel(b.createdAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(b);
    });
    return [...m.entries()];
  }, [filtered]);

  const download = async (b: BoletoRecord) => {
    try {
      setBusyId(b.id);
      const bytes = await boletoPdfService.generateBoletoPdf(b.companyKey, b.data);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = boletoPdfService.getSanitizedFilename(b.companyKey, b.clienteNombre || 'CLIENTE', b.vehiculo.patente || 'UNIDAD');
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e: any) {
      onToast(`No se pudo generar el PDF: ${e?.message || 'error desconocido'}`, 'warn');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="lg:hidden">
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Boletos</h1>
      </div>
      <p className="text-[13px] text-slate-500 -mt-3 lg:mt-0">
        Cada boleto que generás queda guardado con todos sus datos: lo podés volver a descargar idéntico o abrirlo para corregir algo.
      </p>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por comprador, DNI, patente, modelo o empresa…" className="field !h-11 !rounded-xl pl-10" />
        {q && (
          <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Borrar">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<FileCheck2 className="w-6 h-6" />}
          title="Todavía no generaste boletos desde esta versión"
          description="Desde una cotización o un presupuesto tocá “Generar boleto”. Al descargarlo o imprimirlo queda guardado acá."
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search className="w-6 h-6" />} title="Sin resultados" description="No hay boletos que coincidan con la búsqueda." />
      ) : (
        <div className="space-y-6">
          {groups.map(([month, items]) => (
            <section key={month}>
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                {month} · {items.length} boleto{items.length > 1 ? 's' : ''}
              </h3>
              <div className="autonet-card divide-y divide-slate-100 overflow-hidden">
                {items.map((b) => (
                  <article key={b.id} className="p-4 sm:px-5 flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md border ${COMPANY_TONE[b.companyKey] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          <Building2 className="w-3 h-3" /> {BOLETO_TEMPLATES_CONFIG[b.companyKey]?.displayName || b.companyKey}
                        </span>
                        <span className="text-[11.5px] text-slate-500">
                          {new Date(b.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {b.generadoConAdvertencias && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700" title="Se generó con datos incompletos o advertencias">
                            <AlertTriangle className="w-3 h-3" /> con avisos
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[15px] font-extrabold text-slate-900 truncate">{b.clienteNombre}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-slate-600">
                        {b.clienteDni && <span>DNI {Number(b.clienteDni).toLocaleString('es-AR')}</span>}
                        <span className="plate !text-[0.65rem]">{b.vehiculo.patente}</span>
                        <span className="truncate">
                          {b.vehiculo.marca} {b.vehiculo.modelo} {b.vehiculo.anio}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-4">
                      <div className="md:text-right">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Total operación</div>
                        <div className="text-lg font-extrabold tabular text-slate-950">{formatCurrency(b.total)}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => download(b)} disabled={busyId === b.id} className="btn btn-sm btn-primary" title="Descargar el PDF otra vez">
                          {busyId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">PDF</span>
                        </button>
                        <button type="button" onClick={() => onReopen(b)} className="btn btn-sm btn-secondary" title="Abrir para corregir y volver a generar">
                          <Pencil className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Abrir</span>
                        </button>
                        {confirmDelete === b.id ? (
                          <button
                            type="button"
                            autoFocus
                            onBlur={() => setConfirmDelete(null)}
                            onClick={() => {
                              boletoHistoryService.remove(b.id);
                              setConfirmDelete(null);
                              onToast('Boleto quitado del historial.', 'info');
                            }}
                            className="btn btn-sm btn-brand"
                          >
                            Confirmar
                          </button>
                        ) : (
                          <button type="button" onClick={() => setConfirmDelete(b.id)} className="btn btn-sm btn-ghost hover:!text-brand-700" title="Quitar del historial">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
