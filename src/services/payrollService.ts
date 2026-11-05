import { SyncedCollection } from './syncedCollection';

/**
 * SUELDO DE BOLSILLO (recibo de haberes)
 *
 * Validado con el recibo de 09/2026 (Mirage):
 *   Remunerativo = comisiones (+ asignación vacacional u otros del mes)
 *   Descuentos de ley = 19 % del remunerativo (jubilación 11, INSSJP 3, obra social 3, SMATA 2)
 *   Descuentos fijos  = diferencia de prepaga, celular, etc.
 *   No remunerativo   = transporte (días × valor)
 *   Neto = remunerativo − descuentos de ley − descuentos fijos + no remunerativo (redondeado al peso, hacia arriba)
 *
 * Cada asesor guarda su configuración (users/{uid}/payroll).
 */
export interface PayrollDeduction {
  id: string;
  label: string;
  /** 'pct' = % del remunerativo · 'fijo' = monto fijo por mes */
  tipo: 'pct' | 'fijo';
  valor: number;
}

export interface PayrollSettings {
  id: 'settings';
  /** Sueldo básico de convenio (tope mínimo garantizado, si corresponde). */
  basico: number;
  garantizaBasico: boolean;
  transporteDias: number;
  transporteValorDia: number;
  descuentos: PayrollDeduction[];
  updatedAt?: string;
  deleted?: boolean;
}

/** Datos que cambian cada mes. id = m-AAAA-MM */
export interface PayrollMonth {
  id: string;
  /** Comisiones de otras planillas/empresas que se cobran en el mismo recibo. */
  otrasComisiones?: number;
  /** Asignación vacacional, ajustes, etc. (remunerativo). */
  otrosRemunerativos?: number;
  /** Si se cargó, reemplaza el transporte calculado. */
  transporteMes?: number;
  updatedAt?: string;
  deleted?: boolean;
}

export const DEFAULT_PAYROLL: PayrollSettings = {
  id: 'settings',
  basico: 1_308_630.68,
  garantizaBasico: false,
  transporteDias: 42,
  transporteValorDia: 1_390,
  descuentos: [
    { id: 'jub', label: 'Jubilación', tipo: 'pct', valor: 11 },
    { id: 'inssjp', label: 'INSSJP (PAMI)', tipo: 'pct', valor: 3 },
    { id: 'os', label: 'Obra social', tipo: 'pct', valor: 3 },
    { id: 'smata', label: 'SMATA cuota solidaria', tipo: 'pct', valor: 2 },
    { id: 'prepaga', label: 'Diferencia prepaga', tipo: 'fijo', valor: 0 },
    { id: 'celular', label: 'Celular (Movistar)', tipo: 'fijo', valor: 0 },
  ],
};

const settingsStore = new SyncedCollection<PayrollSettings>('payroll', 'autonet_payroll_settings_v1');
const monthStore = new SyncedCollection<PayrollMonth>('payrollMonths', 'autonet_payroll_months_v1');

export const monthKey = (year: number, month: number) => `m-${year}-${String(month).padStart(2, '0')}`;

export interface NetSalaryResult {
  comisiones: number;
  otrasComisiones: number;
  totalComisiones: number;
  aplicaBasico: boolean;
  otrosRemunerativos: number;
  remunerativo: number;
  descuentos: { label: string; detalle: string; monto: number }[];
  totalDescuentos: number;
  noRemunerativo: number;
  neto: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcNetSalary(comisionesApp: number, s: PayrollSettings, m?: PayrollMonth | null): NetSalaryResult {
  const comisiones = Math.max(0, comisionesApp || 0);
  const otrasComisiones = Math.max(0, m?.otrasComisiones || 0);
  const suma = comisiones + otrasComisiones;
  const aplicaBasico = s.garantizaBasico && s.basico > suma;
  const totalComisiones = aplicaBasico ? s.basico : suma;
  const otrosRemunerativos = Math.max(0, m?.otrosRemunerativos || 0);
  const remunerativo = r2(totalComisiones + otrosRemunerativos);
  const descuentos = s.descuentos
    .filter((d) => d.valor > 0)
    .map((d) =>
      d.tipo === 'pct'
        ? { label: d.label, detalle: `${String(d.valor).replace('.', ',')} %`, monto: r2((remunerativo * d.valor) / 100) }
        : { label: d.label, detalle: 'fijo', monto: r2(d.valor) }
    );
  const totalDescuentos = r2(descuentos.reduce((a, d) => a + d.monto, 0));
  const noRemunerativo = r2(typeof m?.transporteMes === 'number' ? m.transporteMes : s.transporteDias * s.transporteValorDia);
  const neto = Math.ceil(r2(remunerativo - totalDescuentos + noRemunerativo));
  return { comisiones, otrasComisiones, totalComisiones, aplicaBasico, otrosRemunerativos, remunerativo, descuentos, totalDescuentos, noRemunerativo, neto };
}

export const payrollService = {
  getSettings(): PayrollSettings {
    const s = settingsStore.get('settings');
    return s ? { ...DEFAULT_PAYROLL, ...s, descuentos: s.descuentos?.length ? s.descuentos : DEFAULT_PAYROLL.descuentos } : DEFAULT_PAYROLL;
  },
  saveSettings(patch: Partial<PayrollSettings>) {
    settingsStore.upsert({ ...payrollService.getSettings(), ...patch, id: 'settings' });
  },
  getMonth(year: number, month: number): PayrollMonth | undefined {
    return monthStore.get(monthKey(year, month));
  },
  saveMonth(year: number, month: number, patch: Partial<PayrollMonth>) {
    const id = monthKey(year, month);
    monthStore.upsert({ ...(monthStore.get(id) || { id }), ...patch, id });
  },
  subscribe(l: () => void): () => void {
    const a = settingsStore.subscribe(() => l());
    const b = monthStore.subscribe(() => l());
    return () => {
      a();
      b();
    };
  },
};
