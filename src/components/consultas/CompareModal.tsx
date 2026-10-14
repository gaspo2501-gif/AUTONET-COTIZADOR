import React from 'react';
import { X, Copy, Check, MessageCircle, Trash2 } from 'lucide-react';
import { Vehicle } from '../../types/stock';
import { formatCurrency, formatKm } from '../../utils/formatters';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { whatsappLink } from '../../services/messageTemplates';
import { ADVISOR_INFO } from '../../constants/advisor';

interface Props {
  vehicles: Vehicle[];
  onClose: () => void;
  onRemove: (v: Vehicle) => void;
  onClear: () => void;
}

function buildCompareMessage(vs: Vehicle[]): string {
  const lines = vs.map((v, i) => {
    const link = v.urlAutonetOriginal?.startsWith('http') ? `\n   🔗 ${v.urlAutonetOriginal}` : '';
    return `*${i + 1}) ${v.marca} ${v.modelo} ${v.version}*\n   📅 ${v.anio} · 🛣️ ${formatKm(v.kilometraje)} · ⛽ ${v.combustible} · ${v.caja}\n   💰 *${formatCurrency(v.precio, v.moneda)}*${link}`;
  });
  return `¡Hola! Te paso las opciones que hablamos para que las compares:\n\n${lines.join('\n\n')}\n\n¿Cuál te gustaría ver primero?\n\n━━━━━━━━━━━━━━━━━━━━━\n${ADVISOR_INFO.nombre} | ${ADVISOR_INFO.cargo}\n📞 ${ADVISOR_INFO.telefono}`;
}

const ROWS: { label: string; get: (v: Vehicle) => string; best?: 'min' | 'max'; num?: (v: Vehicle) => number | null }[] = [
  { label: 'Precio', get: (v) => formatCurrency(v.precio, v.moneda), best: 'min', num: (v) => v.precio ?? null },
  { label: 'Año', get: (v) => String(v.anio), best: 'max', num: (v) => v.anio },
  { label: 'Kilometraje', get: (v) => formatKm(v.kilometraje), best: 'min', num: (v) => (typeof v.kilometraje === 'number' ? v.kilometraje : null) },
  { label: 'Combustible', get: (v) => v.combustible },
  { label: 'Transmisión', get: (v) => v.caja },
  { label: 'Tracción', get: (v) => v.traccion },
  { label: 'Color', get: (v) => v.color || '—' },
  { label: 'Patente', get: (v) => v.patente },
];

export const CompareModal: React.FC<Props> = ({ vehicles, onClose, onRemove, onClear }) => {
  useModalBehavior(onClose);
  const [copied, setCopied] = React.useState(false);
  const msg = buildCompareMessage(vehicles);

  const bestIdx = (row: (typeof ROWS)[number]) => {
    if (!row.best || !row.num || vehicles.length < 2) return -1;
    const nums = vehicles.map(row.num);
    if (nums.some((n) => n === null)) return -1;
    const target = row.best === 'min' ? Math.min(...(nums as number[])) : Math.max(...(nums as number[]));
    return nums.filter((n) => n === target).length === 1 ? nums.indexOf(target) : -1;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Comparar unidades">
      <div className="absolute inset-0 bg-slate-950/55 anim-fade" onClick={onClose} />
      <div className="relative w-full sm:max-w-4xl max-h-[92vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col anim-sheet sm:anim-fade">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Comparar unidades</h3>
            <p className="text-[12px] text-slate-500">En verde, la mejor opción de cada fila.</p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 overflow-auto scrollbar-thin">
          <table className="w-full text-[13px] border-collapse min-w-[520px]">
            <thead>
              <tr>
                <th className="w-28" />
                {vehicles.map((v) => (
                  <th key={v.patente} className="p-3 text-left align-top">
                    <div className="font-extrabold text-slate-900 leading-tight">
                      {v.marca} {v.modelo}
                    </div>
                    <div className="text-[11.5px] font-medium text-slate-500 line-clamp-2">{v.version}</div>
                    <button type="button" onClick={() => onRemove(v)} className="mt-1 text-[11px] font-bold text-slate-400 hover:text-brand-700 inline-flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Quitar
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const best = bestIdx(row);
                return (
                  <tr key={row.label} className="border-t border-slate-100">
                    <td className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{row.label}</td>
                    {vehicles.map((v, i) => (
                      <td key={v.patente} className={`px-3 py-2.5 tabular font-semibold ${i === best ? 'text-emerald-700 bg-emerald-50' : 'text-slate-800'}`}>
                        {row.get(v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer className="px-5 py-3.5 border-t border-slate-100 flex flex-wrap items-center gap-2 safe-bottom">
          <a href={whatsappLink(msg)} target="_blank" rel="noopener noreferrer" className="btn bg-emerald-600 hover:bg-emerald-700 text-white">
            <MessageCircle className="w-4 h-4" /> Enviar comparación
          </a>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(msg);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {
                /* nada */
              }
            }}
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar mensaje'}
          </button>
          <button type="button" onClick={onClear} className="btn btn-ghost ml-auto">
            Vaciar comparación
          </button>
        </footer>
      </div>
    </div>
  );
};
