import React from 'react';
import { Wallet, Settings2, Plus, Trash2, ChevronDown } from 'lucide-react';
import { payrollService, calcNetSalary, PayrollDeduction } from '../../services/payrollService';

const money = (n: number) => `$ ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 }).format(n)}`;
const parseMoney = (s: string) => {
  const clean = s.replace(/[^\d,]/g, '').replace(',', '.');
  return clean ? Number(clean) : 0;
};

const MoneyField: React.FC<{ value: number; onChange: (n: number) => void; placeholder?: string; className?: string }> = ({ value, onChange, placeholder, className }) => {
  const [text, setText] = React.useState(value ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value) : '');
  React.useEffect(() => {
    setText(value ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value) : '');
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(parseMoney(text))}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={`field !py-1.5 font-mono tabular ${className || ''}`}
    />
  );
};

/**
 * SUELDO DE BOLSILLO: comisiones del mes → recibo de haberes → neto.
 */
export const NetSalaryCard: React.FC<{ year: number; month: number; monthLabel: string; comisiones: number; simulatedComisiones?: number }> = ({
  year,
  month,
  monthLabel,
  comisiones,
  simulatedComisiones,
}) => {
  const [, setTick] = React.useState(0);
  React.useEffect(() => payrollService.subscribe(() => setTick((t) => t + 1)), []);
  const [showConfig, setShowConfig] = React.useState(false);

  const settings = payrollService.getSettings();
  const m = payrollService.getMonth(year, month);
  const r = calcNetSalary(comisiones, settings, m);
  const sim = typeof simulatedComisiones === 'number' && Math.round(simulatedComisiones) !== Math.round(comisiones) ? calcNetSalary(simulatedComisiones, settings, m) : null;
  const fijosSinCargar = settings.descuentos.some((d) => d.tipo === 'fijo' && !d.valor);

  const setDed = (id: string, patch: Partial<PayrollDeduction>) =>
    payrollService.saveSettings({ descuentos: settings.descuentos.map((d) => (d.id === id ? { ...d, ...patch } : d)) });

  const Row = ({ label, detail, value, sign, strong }: { label: string; detail?: string; value: number; sign?: '+' | '−'; strong?: boolean }) => (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${strong ? 'border-t border-slate-200 mt-1 pt-2' : ''}`}>
      <span className={strong ? 'font-extrabold text-slate-900' : 'text-slate-600'}>
        {label}
        {detail && <span className="text-slate-400 font-normal"> · {detail}</span>}
      </span>
      <span className={`font-mono tabular whitespace-nowrap ${strong ? 'font-extrabold text-slate-900' : sign === '−' ? 'text-rose-700' : 'text-slate-800'}`}>
        {sign ? `${sign} ` : ''}
        {money(value)}
      </span>
    </div>
  );

  return (
    <div id="sueldo-bolsillo" className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base inline-flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-600" /> Sueldo de bolsillo · {monthLabel}
          </h3>
          <p className="text-[12px] text-slate-500 mt-0.5">Comisiones del mes llevadas al recibo de haberes: descuentos de ley, descuentos fijos y transporte.</p>
        </div>
        <button type="button" onClick={() => setShowConfig((o) => !o)} className="btn btn-sm btn-secondary">
          <Settings2 className="w-3.5 h-3.5" /> Descuentos del recibo
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        <div className="text-[13px]">
          <Row label="Comisiones + premios (app)" value={r.comisiones} />
          {r.otrasComisiones > 0 && <Row label="Otras comisiones del recibo" value={r.otrasComisiones} sign="+" />}
          {r.aplicaBasico && <Row label="Se paga el básico garantizado" detail="las comisiones no lo alcanzan" value={r.totalComisiones} />}
          {r.otrosRemunerativos > 0 && <Row label="Otros remunerativos" detail="vacaciones, ajustes" value={r.otrosRemunerativos} sign="+" />}
          <Row label="Remunerativo" value={r.remunerativo} strong />
          {r.descuentos.map((d) => (
            <React.Fragment key={d.label}>
              <Row label={d.label} detail={d.detalle} value={d.monto} sign="−" />
            </React.Fragment>
          ))}
          <Row label="Transporte (no remunerativo)" value={r.noRemunerativo} sign="+" />
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-dashed border-slate-200">
            <label className="block">
              <span className="field-label">Otras comisiones del mes</span>
              <MoneyField value={m?.otrasComisiones || 0} onChange={(n) => payrollService.saveMonth(year, month, { otrasComisiones: n })} placeholder="Otras planillas" />
            </label>
            <label className="block">
              <span className="field-label">Otros remunerativos</span>
              <MoneyField value={m?.otrosRemunerativos || 0} onChange={(n) => payrollService.saveMonth(year, month, { otrosRemunerativos: n })} placeholder="Ej. vacaciones" />
            </label>
            <label className="block">
              <span className="field-label">Transporte del mes</span>
              <MoneyField
                value={typeof m?.transporteMes === 'number' ? m.transporteMes : settings.transporteDias * settings.transporteValorDia}
                onChange={(n) => payrollService.saveMonth(year, month, { transporteMes: n })}
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl bg-emerald-950 text-white p-4 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Neto de bolsillo estimado</div>
            <div className="font-mono font-black text-3xl mt-1 tabular">{money(r.neto)}</div>
            <div className="text-[11.5px] text-emerald-200/80 mt-1">Descuentos: {money(r.totalDescuentos)}</div>
          </div>
          {sim && (
            <div className="mt-4 pt-3 border-t border-emerald-800">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Con la simulación</div>
              <div className="font-mono font-black text-xl tabular">{money(sim.neto)}</div>
              <div className={`text-[12px] font-bold ${sim.neto >= r.neto ? 'text-emerald-300' : 'text-rose-300'}`}>
                {sim.neto >= r.neto ? '+' : '−'} {money(Math.abs(sim.neto - r.neto))} de bolsillo
              </div>
            </div>
          )}
          {fijosSinCargar && (
            <div className="mt-3 text-[11px] text-amber-200 bg-amber-900/40 rounded-lg px-2.5 py-1.5">Cargá tus descuentos fijos (prepaga, celular) en "Descuentos del recibo".</div>
          )}
        </div>
      </div>

      {showConfig && (
        <div className="mt-5 pt-4 border-t border-slate-200 space-y-4 text-[12.5px]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="field-label">Sueldo básico de convenio</span>
              <MoneyField value={settings.basico} onChange={(n) => payrollService.saveSettings({ basico: n })} />
            </label>
            <label className="block">
              <span className="field-label">Transporte: días</span>
              <input
                type="number"
                min={0}
                defaultValue={settings.transporteDias}
                key={`d-${settings.transporteDias}`}
                onBlur={(e) => payrollService.saveSettings({ transporteDias: Math.max(0, Number(e.target.value) || 0) })}
                className="field !py-1.5 font-mono"
              />
            </label>
            <label className="block">
              <span className="field-label">Transporte: valor por día</span>
              <MoneyField value={settings.transporteValorDia} onChange={(n) => payrollService.saveSettings({ transporteValorDia: n })} />
            </label>
          </div>
          <label className="flex items-center gap-2 font-semibold text-slate-700">
            <input type="checkbox" checked={settings.garantizaBasico} onChange={(e) => payrollService.saveSettings({ garantizaBasico: e.target.checked })} />
            Si las comisiones no llegan al básico, se cobra el básico
          </label>

          <div>
            <div className="field-label mb-1.5">Descuentos del recibo</div>
            <div className="space-y-2">
              {settings.descuentos.map((d) => (
                <div key={d.id} className="grid grid-cols-[1fr_110px_140px_32px] gap-2 items-center">
                  <input
                    defaultValue={d.label}
                    key={`l-${d.id}-${d.label}`}
                    onBlur={(e) => setDed(d.id, { label: e.target.value.trim() || d.label })}
                    className="field !py-1.5"
                  />
                  <select value={d.tipo} onChange={(e) => setDed(d.id, { tipo: e.target.value as 'pct' | 'fijo' })} className="field !py-1.5">
                    <option value="pct">% del remun.</option>
                    <option value="fijo">Monto fijo</option>
                  </select>
                  <MoneyField value={d.valor} onChange={(n) => setDed(d.id, { valor: n })} placeholder={d.tipo === 'pct' ? '%' : '$'} />
                  <button
                    type="button"
                    onClick={() => payrollService.saveSettings({ descuentos: settings.descuentos.filter((x) => x.id !== d.id) })}
                    className="btn btn-sm btn-ghost !px-1.5"
                    title="Quitar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                payrollService.saveSettings({ descuentos: [...settings.descuentos, { id: `d-${Date.now().toString(36)}`, label: 'Nuevo descuento', tipo: 'fijo', valor: 0 }] })
              }
              className="btn btn-sm btn-secondary mt-2"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar descuento
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
