import React from 'react';
import { ShieldCheck, Download, Loader2, AlertCircle } from 'lucide-react';
import { BoletoData, BoletoUifData } from '../../types/boleto';
import { uifPdfService, defaultUif } from '../../services/uifPdfService';

/**
 * Datos extra de la PLANILLA UIF (Res. 200/2024) que pide CREDINET.
 * Solo aparece cuando el boleto tiene una financiación activa de Credinet.
 * El resto (nombre, DNI, CUIL, nacimiento, estado civil, domicilio, teléfono, email, actividad)
 * se toma de los datos del cliente del boleto.
 */
export const UifSection: React.FC<{
  data: BoletoData;
  onChange: (updater: (prev: BoletoData) => BoletoData) => void;
}> = ({ data, onChange }) => {
  const u = defaultUif(data);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const missing = uifPdfService.missing(data);

  const set = (field: keyof BoletoUifData, value: string) =>
    onChange((prev) => ({ ...prev, uif: { ...(prev.uif || {}), [field]: value } }));

  const download = async () => {
    setLoading(true);
    setError(null);
    try {
      await uifPdfService.download(data);
    } catch (e: any) {
      setError(e?.message || 'No se pudo generar la planilla UIF.');
    } finally {
      setLoading(false);
    }
  };

  const input = (field: keyof BoletoUifData, label: string, opts: { placeholder?: string; type?: string; span?: string; upper?: boolean } = {}) => (
    <label className={`block ${opts.span || ''}`}>
      <span className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{label}</span>
      <input
        type={opts.type || 'text'}
        value={(u[field] as string) || ''}
        onChange={(e) => set(field, e.target.value)}
        placeholder={opts.placeholder}
        className={`w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 ${opts.upper === false ? '' : 'uppercase'} font-semibold`}
      />
    </label>
  );

  return (
    <div className="bg-white p-4 rounded-xl border-2 border-sky-200 shadow-xs" id="uif-credinet">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-900 font-bold">
          <ShieldCheck className="w-4 h-4 text-sky-600" />
          <span className="uppercase tracking-wide text-xs">6. Planilla UIF – Credinet (Res. 200/2024)</span>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-bold text-xs shadow-xs cursor-pointer"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          <span>Descargar planilla UIF</span>
        </button>
      </div>

      <p className="text-[11px] text-slate-500 mb-3">
        Se completa el documento original de Credinet con los datos del cliente de arriba más estos datos. PEP y Sujeto Obligado salen con el
        “SI” tachado y la fecha de confección es la de hoy.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {input('nacionalidad', 'Nacionalidad')}
        {input('lugarNacimiento', 'Lugar de nacimiento', { placeholder: 'Ej. Neuquén' })}
        <label className="block">
          <span className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Sexo</span>
          <select
            value={u.sexo || ''}
            onChange={(e) => set('sexo', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
          >
            <option value="">Elegir…</option>
            <option value="MASCULINO">Masculino</option>
            <option value="FEMENINO">Femenino</option>
            <option value="X">X</option>
          </select>
        </label>
        {input('pais', 'País (domicilio)')}
        {input('calle', 'Calle', { span: 'md:col-span-3', placeholder: 'Se toma del domicilio del cliente' })}
        {input('numero', 'Número')}

        {input('contactoNombre', 'Contacto de referencia (nombre y apellido)', { span: 'md:col-span-2' })}
        {input('contactoVinculo', 'Vínculo', { placeholder: 'Ej. Hermano/a' })}
        {input('contactoTelefono', 'Teléfono del contacto', { placeholder: '299 …' })}

        {input('empresa', 'Empresa donde trabaja', { span: 'md:col-span-2' })}
        {input('cargo', 'Cargo actual')}
        {input('cargoDesde', 'En el cargo desde', { type: 'date' })}
        {input('fechaIngreso', 'Ingreso a la empresa', { type: 'date' })}
        {input('emailLaboral', 'E-mail laboral', { upper: false, type: 'email' })}
        {input('telefonoLaboral', 'Teléfono laboral / interno', { span: 'md:col-span-2' })}
      </div>

      {missing.length > 0 && (
        <div className="mt-3 flex items-start gap-2 text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
          <span>Faltan para la planilla: {missing.join(', ')}. Se puede descargar igual y completar a mano.</span>
        </div>
      )}
      {error && <div className="mt-2 text-[12px] text-red-700 font-semibold">{error}</div>}
    </div>
  );
};
