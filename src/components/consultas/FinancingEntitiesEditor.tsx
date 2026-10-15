import React from 'react';
import { Landmark, Plus, Trash2, RotateCcw } from 'lucide-react';
import { financingService, FinancingEntity, calcFinancing } from '../../services/financingService';
import { formatCurrency } from '../../utils/formatters';

/** Configuración de entidades de financiación (Configuración). */
export const FinancingEntitiesEditor: React.FC<{ onToast: (t: string, type?: 'success' | 'info' | 'warn') => void }> = ({ onToast }) => {
  const [list, setList] = React.useState<FinancingEntity[]>(() => financingService.getEntities());
  const [settings, setSettings] = React.useState(() => financingService.getSettings());
  const [newName, setNewName] = React.useState('');

  React.useEffect(
    () =>
      financingService.subscribe(() => {
        setList(financingService.getEntities());
        setSettings(financingService.getSettings());
      }),
    []
  );

  const update = (e: FinancingEntity, patch: Partial<FinancingEntity>) => financingService.saveEntity({ ...e, ...patch });

  const add = () => {
    const nombre = newName.trim().toUpperCase();
    if (!nombre) return;
    if (list.some((e) => e.nombre === nombre)) {
      onToast(`${nombre} ya está en la lista.`, 'warn');
      return;
    }
    financingService.saveEntity({ id: `ent-${Date.now().toString(36)}`, nombre, conGastos: false, otorgamientoPct: 4.83, prendaPct: 3, orden: list.length + 1 });
    setNewName('');
  };

  // Ejemplo con los datos de referencia (Ford Focus del mensaje modelo)
  const example = (e: FinancingEntity) =>
    calcFinancing({
      precioVehiculo: 16_900_000,
      transferencia: 828_100,
      montoPrestamo: 8_390_000,
      cuotas: 36,
      valorCuota: 420_000,
      entity: e,
      redondeo: settings.redondeoEntrega,
    });

  return (
    <section className="autonet-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[15px] font-extrabold text-slate-900 inline-flex items-center gap-2">
            <Landmark className="w-4 h-4 text-action-600" /> Entidades de financiación
          </h2>
          <p className="text-[12.5px] text-slate-500 mt-0.5 max-w-2xl">
            Con gastos: entrega mínima = auto + transferencia + otorgamiento (% del monto) + prenda (% de cuotas × valor de cuota) − monto prestado. Sin gastos:
            auto + transferencia − monto prestado.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            financingService.resetEntities();
            onToast('Se restauraron las entidades originales.', 'info');
          }}
          className="btn btn-sm btn-ghost"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restaurar
        </button>
      </div>

      <div className="overflow-x-auto scrollbar-thin -mx-1">
        <table className="w-full text-[13px] min-w-[620px]">
          <thead>
            <tr className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 text-left">
              <th className="px-2 py-2">Entidad</th>
              <th className="px-2 py-2">Gastos</th>
              <th className="px-2 py-2">Otorgamiento %</th>
              <th className="px-2 py-2">Prenda %</th>
              <th className="px-2 py-2 text-right">Ejemplo entrega*</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((e) => (
              <tr key={e.id}>
                <td className="px-2 py-2 font-bold text-slate-900">{e.nombre}</td>
                <td className="px-2 py-2">
                  <div className="inline-grid grid-cols-2 p-0.5 bg-slate-100 rounded-lg text-[11.5px] font-bold">
                    <button type="button" onClick={() => update(e, { conGastos: false })} className={`px-2.5 py-1 rounded-md ${!e.conGastos ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500'}`}>
                      Sin gastos
                    </button>
                    <button type="button" onClick={() => update(e, { conGastos: true })} className={`px-2.5 py-1 rounded-md ${e.conGastos ? 'bg-white shadow-sm text-amber-700' : 'text-slate-500'}`}>
                      Con gastos
                    </button>
                  </div>
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    disabled={!e.conGastos}
                    defaultValue={e.otorgamientoPct}
                    key={`o-${e.id}-${e.otorgamientoPct}`}
                    onBlur={(ev) => update(e, { otorgamientoPct: Math.max(0, Number(ev.target.value) || 0) })}
                    className="field !w-24 !py-1.5 tabular disabled:opacity-40"
                    aria-label={`Otorgamiento ${e.nombre}`}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    disabled={!e.conGastos}
                    defaultValue={e.prendaPct}
                    key={`p-${e.id}-${e.prendaPct}`}
                    onBlur={(ev) => update(e, { prendaPct: Math.max(0, Number(ev.target.value) || 0) })}
                    className="field !w-24 !py-1.5 tabular disabled:opacity-40"
                    aria-label={`Prenda ${e.nombre}`}
                  />
                </td>
                <td className="px-2 py-2 text-right font-mono font-bold tabular text-slate-900">{formatCurrency(example(e).entregaMinima)}</td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => financingService.removeEntity(e.id)}
                    className="btn btn-sm btn-ghost !px-1.5 hover:!text-brand-700"
                    title={`Quitar ${e.nombre}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400 mt-1">
        *Ejemplo: auto $16.900.000 + transferencia $828.100, préstamo $8.390.000 en 36 cuotas de $420.000.
      </p>

      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-end justify-between">
        <div className="flex gap-2 items-end">
          <label className="block">
            <span className="field-label">Agregar entidad</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Ej. MACRO" className="field !w-44" />
          </label>
          <button type="button" onClick={add} className="btn btn-secondary">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
        <label className="block">
          <span className="field-label">Redondear entrega mínima hacia arriba</span>
          <select
            className="field !w-56"
            value={settings.redondeoEntrega}
            onChange={(e) => financingService.saveSettings({ redondeoEntrega: Number(e.target.value) })}
          >
            <option value={0}>Sin redondeo (valor exacto)</option>
            <option value={1000}>A $1.000</option>
            <option value={10000}>A $10.000</option>
            <option value={50000}>A $50.000</option>
            <option value={100000}>A $100.000</option>
          </select>
        </label>
      </div>
    </section>
  );
};
