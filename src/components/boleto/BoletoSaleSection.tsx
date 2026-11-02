import React from 'react';
import { BadgeCheck, Flame } from 'lucide-react';
import { BoletoData, BoletoVentaData } from '../../types/boleto';
import { Vehicle } from '../../types/stock';
import { saleOptionsFromBoleto } from '../../services/boletoSaleService';
import { formatCurrency } from '../../utils/formatters';

type Iva = 21 | 10.5;

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; yes?: string; no?: string; tone?: string }> = ({
  value,
  onChange,
  yes = 'SÍ',
  no = 'NO',
  tone = 'bg-emerald-600',
}) => (
  <div className="inline-flex rounded-lg p-0.5 bg-slate-200 text-[11px] font-bold">
    <button type="button" onClick={() => onChange(false)} className={`px-2.5 py-1 rounded-md ${!value ? 'bg-slate-800 text-white' : 'text-slate-600'}`}>
      {no}
    </button>
    <button type="button" onClick={() => onChange(true)} className={`px-2.5 py-1 rounded-md ${value ? `${tone} text-white` : 'text-slate-600'}`}>
      {yes}
    </button>
  </div>
);

const IvaPick: React.FC<{ value: Iva; onChange: (v: Iva) => void }> = ({ value, onChange }) => (
  <div className="inline-flex rounded-lg p-0.5 bg-slate-200 text-[11px] font-bold">
    {([21, 10.5] as Iva[]).map((r) => (
      <button key={r} type="button" onClick={() => onChange(r)} className={`px-2.5 py-1 rounded-md ${value === r ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600'}`}>
        {r === 21 ? '21%' : '10,5%'}
      </button>
    ))}
  </div>
);

/** Datos con los que la venta se registra sola al generar el boleto. */
export const BoletoSaleSection: React.FC<{
  vehicle: Vehicle;
  data: BoletoData;
  onChange: (updater: (prev: BoletoData) => BoletoData) => void;
}> = ({ vehicle, data, onChange }) => {
  const set = (patch: Partial<BoletoVentaData>) => onChange((prev) => ({ ...prev, venta: { ...(prev.venta || {}), ...patch } }));
  const registrar = data.venta?.registrar !== false;
  const o = saleOptionsFromBoleto(data, vehicle);
  const origenCritico =
    typeof data.venta?.esCritico === 'boolean'
      ? 'elegido en este boleto'
      : typeof vehicle.criticoManual === 'boolean'
        ? 'marcada a mano en el stock'
        : vehicle.criticoPdf
          ? 'según el PDF de stock'
          : 'no figura como crítica en el PDF';

  return (
    <div id="boleto-registro-venta" className={`bg-white p-4 rounded-xl border-2 ${registrar ? 'border-emerald-200' : 'border-slate-200'} shadow-xs`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-900 font-bold">
          <BadgeCheck className="w-4 h-4 text-emerald-600" />
          <span className="uppercase tracking-wide text-xs">Registro automático de la venta</span>
        </div>
        <Toggle value={registrar} onChange={(v) => set({ registrar: v })} yes="REGISTRAR" no="NO REGISTRAR" />
      </div>

      {registrar ? (
        <>
          <p className="text-[11.5px] text-slate-500 mb-3">
            Al descargar o imprimir el boleto, la unidad queda en <strong>Mis ventas</strong> como venta propia con estos datos. Si lo volvés a generar, se
            actualiza.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[12.5px]">
            <Row label="Precio de venta">
              <span className="font-mono font-bold">{formatCurrency(o.precioRealVenta)}</span>
            </Row>
            <Row label="IVA de la operación">
              <IvaPick value={o.ivaVenta} onChange={(v) => set({ ivaVenta: v })} />
            </Row>
            <Row
              label={
                <span className="inline-flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-600" /> Unidad crítica
                  <span className="text-[10.5px] text-slate-400 font-normal">({origenCritico})</span>
                </span>
              }
            >
              <Toggle value={o.esCritico} onChange={(v) => set({ esCritico: v })} tone="bg-amber-500" />
            </Row>
            <Row label="Credinet / Wunder">
              <span className={`font-bold ${o.usaCredinet ? 'text-sky-700' : 'text-slate-500'}`}>
                {o.usaCredinet ? 'SÍ (financiación activa)' : 'NO'}
              </span>
            </Row>
            <Row label="Toma de usado">
              <span className={`font-bold ${o.tieneTomaUsado ? 'text-slate-900' : 'text-slate-500'}`}>
                {o.tieneTomaUsado ? `${o.marcaModeloTomaUsado || 'SÍ'} · ${formatCurrency(o.valorTomaUsado || 0)}` : 'NO'}
              </span>
            </Row>
            {o.tieneTomaUsado && (
              <Row label="IVA del usado">
                <IvaPick value={o.ivaTomaUsado || 21} onChange={(v) => set({ ivaTomaUsado: v })} />
              </Row>
            )}
            <Row label="Comisión base estimada">
              <span className="font-mono font-bold text-emerald-700">
                {formatCurrency(Math.round((o.comisionBaseCalculada || 0) + (o.comisionTomaCalculada || 0)))}
              </span>
            </Row>
          </div>
        </>
      ) : (
        <p className="text-[11.5px] text-slate-500">La venta no se va a registrar (boleto de prueba o de otra persona).</p>
      )}
    </div>
  );
};

const Row: React.FC<{ label: React.ReactNode; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-100 last:border-0">
    <span className="text-slate-600 font-semibold">{label}</span>
    {children}
  </div>
);
