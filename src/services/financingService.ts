import { SyncedCollection } from './syncedCollection';

/**
 * ENTIDADES DE FINANCIACIÓN Y CÁLCULO DE ENTREGA MÍNIMA
 *
 * Entidades CON gastos (Santander, BBVA, Galicia):
 *   otorgamiento = monto a prestar × 4,83 %
 *   inscripción de prenda = (cuotas × valor de cuota) × 3 %
 *   entrega mínima = (auto + transferencia + otorgamiento + prenda) − monto prestado
 *
 * Entidades SIN gastos (BNA, BPN, Credinet):
 *   entrega mínima = (auto + transferencia) − monto prestado
 *
 * Los porcentajes se editan por entidad en Configuración.
 */

export interface FinancingEntity {
  id: string;
  nombre: string;
  conGastos: boolean;
  /** % sobre el monto a prestar (ej. 4.83) */
  otorgamientoPct: number;
  /** % sobre cuotas × valor de cuota (ej. 3) */
  prendaPct: number;
  orden?: number;
  updatedAt?: string;
  deleted?: boolean;
}

export interface FinancingSettings {
  id: 'settings';
  /** Redondeo hacia arriba de la entrega mínima (0 = sin redondeo). */
  redondeoEntrega: number;
  updatedAt?: string;
  deleted?: boolean;
}

export const DEFAULT_ENTITIES: FinancingEntity[] = [
  { id: 'credinet', nombre: 'CREDINET', conGastos: false, otorgamientoPct: 0, prendaPct: 0, orden: 1 },
  { id: 'bna', nombre: 'BNA', conGastos: false, otorgamientoPct: 0, prendaPct: 0, orden: 2 },
  { id: 'bpn', nombre: 'BPN', conGastos: false, otorgamientoPct: 0, prendaPct: 0, orden: 3 },
  { id: 'santander', nombre: 'SANTANDER', conGastos: true, otorgamientoPct: 4.83, prendaPct: 3, orden: 4 },
  { id: 'bbva', nombre: 'BBVA', conGastos: true, otorgamientoPct: 4.83, prendaPct: 3, orden: 5 },
  { id: 'galicia', nombre: 'GALICIA', conGastos: true, otorgamientoPct: 4.83, prendaPct: 3, orden: 6 },
];

const DEFAULT_SETTINGS: FinancingSettings = { id: 'settings', redondeoEntrega: 10000 };

const entitiesStore = new SyncedCollection<FinancingEntity>('financingEntities', 'autonet_financing_entities_v1', {
  sort: (a, b) => (a.orden ?? 99) - (b.orden ?? 99),
});
const settingsStore = new SyncedCollection<FinancingSettings>('financingSettings', 'autonet_financing_settings_v1');

export interface FinancingInput {
  precioVehiculo: number;
  transferencia: number;
  montoPrestamo: number;
  cuotas?: number;
  valorCuota?: number;
  entity?: Pick<FinancingEntity, 'conGastos' | 'otorgamientoPct' | 'prendaPct'> | null;
  redondeo?: number;
}

export interface FinancingResult {
  otorgamiento: number;
  prenda: number;
  gastosTotales: number;
  totalConGastos: number;
  entregaExacta: number;
  entregaMinima: number;
  /** Falta cuotas/valor de cuota para calcular la prenda en una entidad con gastos. */
  faltanDatosPrenda: boolean;
  /** El préstamo cubre todo: no hay entrega. */
  sinEntrega: boolean;
}

export function calcFinancing(i: FinancingInput): FinancingResult {
  const precio = Math.max(0, i.precioVehiculo || 0);
  const transf = Math.max(0, i.transferencia || 0);
  const monto = Math.max(0, i.montoPrestamo || 0);
  const cuotas = Math.max(0, i.cuotas || 0);
  const valorCuota = Math.max(0, i.valorCuota || 0);
  const conGastos = Boolean(i.entity?.conGastos);

  const otorgamiento = conGastos ? Math.round(monto * ((i.entity?.otorgamientoPct || 0) / 100)) : 0;
  const prenda = conGastos ? Math.round(cuotas * valorCuota * ((i.entity?.prendaPct || 0) / 100)) : 0;
  const gastosTotales = otorgamiento + prenda;
  const totalConGastos = precio + transf + gastosTotales;
  const entregaExacta = totalConGastos - monto;
  const step = i.redondeo && i.redondeo > 0 ? i.redondeo : 0;
  const entregaMinima = entregaExacta <= 0 ? 0 : step ? Math.ceil(entregaExacta / step) * step : entregaExacta;

  return {
    otorgamiento,
    prenda,
    gastosTotales,
    totalConGastos,
    entregaExacta,
    entregaMinima,
    faltanDatosPrenda: conGastos && monto > 0 && (cuotas <= 0 || valorCuota <= 0),
    sinEntrega: entregaExacta <= 0,
  };
}

const norm = (s: string) => s.trim().toUpperCase();

export const financingService = {
  getEntities(): FinancingEntity[] {
    const own = entitiesStore.getAll();
    return own.length ? own : DEFAULT_ENTITIES;
  },
  findEntity(nombre: string): FinancingEntity | undefined {
    const n = norm(nombre || '');
    return financingService.getEntities().find((e) => norm(e.nombre) === n);
  },
  subscribe(l: () => void): () => void {
    const a = entitiesStore.subscribe(() => l());
    const b = settingsStore.subscribe(() => l());
    return () => {
      a();
      b();
    };
  },
  saveEntity(e: FinancingEntity) {
    if (entitiesStore.getAll().length === 0) DEFAULT_ENTITIES.forEach((d) => d.id !== e.id && entitiesStore.upsert(d));
    entitiesStore.upsert({ ...e, nombre: norm(e.nombre) });
  },
  removeEntity(id: string) {
    if (entitiesStore.getAll().length === 0) DEFAULT_ENTITIES.forEach((d) => d.id !== id && entitiesStore.upsert(d));
    entitiesStore.remove(id);
  },
  resetEntities() {
    entitiesStore.getAll().forEach((e) => entitiesStore.remove(e.id));
  },
  getSettings(): FinancingSettings {
    return settingsStore.get('settings') || DEFAULT_SETTINGS;
  },
  saveSettings(s: Partial<FinancingSettings>) {
    settingsStore.upsert({ ...financingService.getSettings(), ...s, id: 'settings' });
  },
};
