import React from 'react';
import { UserRound } from 'lucide-react';
import { advisorProfileService } from '../services/advisorProfileService';
import { DEFAULT_ADVISOR_INFO } from '../constants/advisor';

/**
 * Primer ingreso de un usuario: pide nombre y teléfono con los que se firman
 * los mensajes de WhatsApp, los presupuestos y las historias.
 */
export const AdvisorSetupModal: React.FC<{ email?: string | null }> = ({ email }) => {
  // Si en este dispositivo ya había datos de asesor guardados (versión anterior), se proponen
  const legacy = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('autonet_advisor_settings_v1') || 'null') as { nombre?: string; telefono?: string } | null;
    } catch {
      return null;
    }
  }, []);
  const [nombre, setNombre] = React.useState(legacy?.nombre || '');
  const [telefono, setTelefono] = React.useState(legacy?.telefono || '');
  const [cargo, setCargo] = React.useState(DEFAULT_ADVISOR_INFO.cargo);
  const ok = nombre.trim().length >= 3 && telefono.replace(/\D/g, '').length >= 8;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    advisorProfileService.save({ nombre: nombre.trim(), cargo: cargo.trim() || DEFAULT_ADVISOR_INFO.cargo, telefono: telefono.trim(), email: email || undefined });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <form onSubmit={save} className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-5 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <UserRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold">Tus datos de asesor</h2>
              <p className="text-[12px] text-slate-300">{email ? `Sesión: ${email}` : 'Primer ingreso'}</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-3.5">
          <p className="text-[12.5px] text-slate-600">
            Con estos datos se firman tus mensajes de WhatsApp, presupuestos e historias. Tus boletos, presupuestos, ventas y comisiones quedan solo en tu
            usuario.
          </p>
          <label className="block">
            <span className="field-label">Nombre y apellido</span>
            <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Martín Gómez" className="field" />
          </label>
          <label className="block">
            <span className="field-label">Teléfono / WhatsApp</span>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" placeholder="Ej. 2994123456" className="field font-mono" />
          </label>
          <label className="block">
            <span className="field-label">Cargo</span>
            <input value={cargo} onChange={(e) => setCargo(e.target.value)} className="field" />
          </label>
          <button type="submit" disabled={!ok} className="btn btn-primary w-full !py-2.5 disabled:opacity-50">
            Guardar y empezar
          </button>
          <p className="text-[11px] text-slate-400 text-center">Después se cambian en Configuración.</p>
        </div>
      </form>
    </div>
  );
};
