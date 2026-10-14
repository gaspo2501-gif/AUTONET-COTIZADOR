import React from 'react';
import { MessageCircle, Copy, Check, Sparkles, GitCompare, ChevronRight } from 'lucide-react';
import { Vehicle } from '../../types/stock';
import { messageTemplates, whatsappLink, MessageTemplate } from '../../services/messageTemplates';
import { findSimilarVehicles } from '../../utils/similarVehicles';
import { formatCurrency, formatKm } from '../../utils/formatters';

interface Props {
  vehicle: Vehicle;
  allVehicles: Vehicle[];
  onOpenVehicle?: (v: Vehicle) => void;
  isComparing?: boolean;
  onToggleCompare?: (v: Vehicle) => void;
  compareFull?: boolean;
}

/** Mensajes listos + unidades parecidas + comparar, dentro de la ficha. */
export const VehicleQuickPanel: React.FC<Props> = ({ vehicle, allVehicles, onOpenVehicle, isComparing, onToggleCompare, compareFull }) => {
  const [templates, setTemplates] = React.useState<MessageTemplate[]>(() => messageTemplates.getAll());
  const [selected, setSelected] = React.useState<string>(() => messageTemplates.getAll()[0]?.id || '');
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => messageTemplates.subscribe(setTemplates), []);

  const tpl = templates.find((t) => t.id === selected) || templates[0];
  const text = tpl ? messageTemplates.render(tpl.texto, vehicle) : '';
  const similar = React.useMemo(() => findSimilarVehicles(vehicle, allVehicles), [vehicle, allVehicles]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* el usuario puede seleccionar el texto a mano */
    }
  };

  return (
    <div className="space-y-4">
      {/* Mensajes listos */}
      <section className="rounded-xl border border-slate-200 overflow-hidden">
        <header className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider inline-flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> Mensajes listos
          </h4>
          <span className="text-[11px] text-slate-400">Se editan en Configuración</span>
        </header>
        <div className="p-3 space-y-2.5">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {templates.map((t) => (
              <button key={t.id} type="button" className="chip shrink-0 !py-1 !text-[11.5px]" data-active={t.id === tpl?.id} onClick={() => setSelected(t.id)}>
                {t.nombre}
              </button>
            ))}
          </div>
          <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-relaxed text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-3 max-h-48 overflow-y-auto select-text">
            {text}
          </pre>
          <div className="flex flex-wrap gap-2">
            <a href={whatsappLink(text)} target="_blank" rel="noopener noreferrer" className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white">
              <MessageCircle className="w-3.5 h-3.5" /> Abrir en WhatsApp
            </a>
            <button type="button" onClick={copy} className="btn btn-sm btn-secondary">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            {onToggleCompare && (
              <button
                type="button"
                onClick={() => onToggleCompare(vehicle)}
                disabled={!isComparing && compareFull}
                className={`btn btn-sm ${isComparing ? 'bg-action-50 text-action-700 border-action-200' : 'btn-ghost'}`}
                title={compareFull && !isComparing ? 'Ya elegiste 3 unidades para comparar' : 'Sumar a la comparación'}
              >
                <GitCompare className="w-3.5 h-3.5" /> {isComparing ? 'En comparación' : 'Comparar'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Unidades parecidas */}
      {similar.length > 0 && (
        <section className="rounded-xl border border-slate-200 overflow-hidden">
          <header className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Para ofrecer también
            </h4>
          </header>
          <div className="divide-y divide-slate-100">
            {similar.map((s) => (
              <button key={s.patente} type="button" onClick={() => onOpenVehicle?.(s)} className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-slate-50">
                <span className="plate shrink-0 !text-[0.65rem]">{s.patente}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-slate-900 truncate">
                    {s.marca} {s.modelo} <span className="font-medium text-slate-500">{s.version}</span>
                  </span>
                  <span className="block text-[11.5px] text-slate-500">
                    {s.anio} · {formatKm(s.kilometraje)} · {s.caja}
                  </span>
                </span>
                <span className="text-[13px] font-extrabold tabular text-slate-900 shrink-0">{formatCurrency(s.precio, s.moneda)}</span>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
