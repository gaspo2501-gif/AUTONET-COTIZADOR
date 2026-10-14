import React from 'react';
import { CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warn';
export interface ToastItem {
  id: number;
  text: string;
  type: ToastType;
}

const ICONS = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
  info: <Sparkles className="w-5 h-5 text-sky-400 shrink-0" />,
  warn: <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />,
};

export function useToasts() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const seq = React.useRef(0);
  const dismiss = React.useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const show = React.useCallback(
    (text: string, type: ToastType = 'success') => {
      const id = ++seq.current;
      setToasts((prev) => [...prev.slice(-2), { id, text, type }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );
  return { toasts, show, dismiss };
}

export const Toaster: React.FC<{ toasts: ToastItem[]; onDismiss: (id: number) => void }> = ({ toasts, onDismiss }) => (
  <div
    className="fixed z-[60] inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] lg:top-auto lg:inset-x-auto lg:right-6 lg:bottom-6 flex flex-col items-stretch lg:items-end gap-2 pointer-events-none"
    aria-live="polite"
    role="status"
  >
    {toasts.map((t) => (
      <div
        key={t.id}
        className="pointer-events-auto animate-in fade-in slide-in-from-top-2 lg:slide-in-from-bottom-5 flex items-start gap-2.5 pl-3.5 pr-2 py-3 rounded-2xl bg-slate-900 text-white shadow-2xl ring-1 ring-white/10 text-[13px] font-medium lg:max-w-md"
      >
        {ICONS[t.type]}
        <span className="flex-1 leading-snug pt-0.5">{t.text}</span>
        <button type="button" onClick={() => onDismiss(t.id)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10" aria-label="Cerrar aviso">
          <X className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>
);
