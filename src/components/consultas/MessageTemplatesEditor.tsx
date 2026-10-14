import React from 'react';
import { MessageCircle, Plus, Trash2, RotateCcw, Save } from 'lucide-react';
import { messageTemplates, MessageTemplate, TEMPLATE_PLACEHOLDERS } from '../../services/messageTemplates';
import { Vehicle } from '../../types/stock';

/** Editor de mensajes listos (Configuración). */
export const MessageTemplatesEditor: React.FC<{ sampleVehicle?: Vehicle; onToast: (t: string, type?: 'success' | 'info' | 'warn') => void }> = ({
  sampleVehicle,
  onToast,
}) => {
  const [list, setList] = React.useState<MessageTemplate[]>(() => messageTemplates.getAll());
  const [editingId, setEditingId] = React.useState<string>(() => messageTemplates.getAll()[0]?.id || '');
  const [draft, setDraft] = React.useState<MessageTemplate | null>(() => messageTemplates.getAll()[0] || null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => messageTemplates.subscribe(setList), []);

  const select = (t: MessageTemplate) => {
    setEditingId(t.id);
    setDraft({ ...t });
  };

  const insert = (key: string) => {
    if (!draft) return;
    const el = textRef.current;
    const token = `{${key}}`;
    const start = el?.selectionStart ?? draft.texto.length;
    const end = el?.selectionEnd ?? draft.texto.length;
    const texto = draft.texto.slice(0, start) + token + draft.texto.slice(end);
    setDraft({ ...draft, texto });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = () => {
    if (!draft || !draft.nombre.trim() || !draft.texto.trim()) {
      onToast('Poné un nombre y un texto al mensaje.', 'warn');
      return;
    }
    messageTemplates.save({ ...draft, nombre: draft.nombre.trim() });
    onToast(`Mensaje "${draft.nombre.trim()}" guardado.`, 'success');
  };

  const addNew = () => {
    const t: MessageTemplate = { id: `tpl-${Date.now().toString(36)}`, nombre: 'Nuevo mensaje', texto: 'Hola! Te paso el *{unidad}* {anio} a {precio}.\n\n{firma}', orden: list.length + 1 };
    setEditingId(t.id);
    setDraft(t);
  };

  const preview = draft && sampleVehicle ? messageTemplates.render(draft.texto, sampleVehicle) : '';

  return (
    <section className="autonet-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[15px] font-extrabold text-slate-900 inline-flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-emerald-600" /> Mensajes listos para WhatsApp
          </h2>
          <p className="text-[12.5px] text-slate-500 mt-0.5">Aparecen en la ficha de cada unidad con los datos ya completos.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={addNew} className="btn btn-sm btn-secondary">
            <Plus className="w-3.5 h-3.5" /> Nuevo
          </button>
          <button
            type="button"
            onClick={() => {
              messageTemplates.resetToDefaults();
              const first = messageTemplates.getAll()[0];
              if (first) select(first);
              onToast('Se restauraron los mensajes originales.', 'info');
            }}
            className="btn btn-sm btn-ghost"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-4">
        <div className="flex lg:flex-col gap-1.5 overflow-x-auto scrollbar-none">
          {list.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => select(t)}
              className={`shrink-0 text-left px-3 py-2 rounded-lg text-[13px] font-semibold ${editingId === t.id ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {t.nombre}
            </button>
          ))}
          {draft && !list.some((t) => t.id === draft.id) && (
            <span className="shrink-0 px-3 py-2 rounded-lg text-[13px] font-semibold bg-brand-50 text-brand-700">{draft.nombre} (sin guardar)</span>
          )}
        </div>

        {draft && (
          <div className="space-y-3 min-w-0">
            <div>
              <label className="field-label" htmlFor="tpl-nombre">Nombre</label>
              <input id="tpl-nombre" className="field" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />
            </div>
            <div>
              <label className="field-label" htmlFor="tpl-texto">Texto</label>
              <textarea id="tpl-texto" ref={textRef} rows={8} className="field font-mono !text-[12.5px] leading-relaxed" value={draft.texto} onChange={(e) => setDraft({ ...draft, texto: e.target.value })} />
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-[11px] text-slate-400 mr-1 self-center">Insertar dato:</span>
                {TEMPLATE_PLACEHOLDERS.map((p) => (
                  <button key={p.key} type="button" onClick={() => insert(p.key)} className="chip !py-0.5 !px-2 !text-[11px]" title={p.label}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {preview && (
              <div>
                <div className="field-label">Vista previa con {sampleVehicle?.marca} {sampleVehicle?.modelo}</div>
                <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-relaxed text-slate-700 bg-emerald-50/50 border border-emerald-100 rounded-lg p-3 max-h-56 overflow-y-auto">{preview}</pre>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={save} className="btn btn-primary">
                <Save className="w-4 h-4" /> Guardar mensaje
              </button>
              {list.some((t) => t.id === draft.id) && list.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    messageTemplates.remove(draft.id);
                    const next = messageTemplates.getAll()[0];
                    if (next) select(next);
                    onToast('Mensaje eliminado.', 'info');
                  }}
                  className="btn btn-ghost hover:!text-brand-700"
                >
                  <Trash2 className="w-4 h-4" /> Eliminar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
