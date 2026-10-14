import { BoletoCompanyKey, BoletoData } from '../types/boleto';
import { todayISO } from '../utils/dates';
import { SyncedCollection } from './syncedCollection';

export interface BoletoRecord {
  id: string;
  createdAt: string;
  companyKey: BoletoCompanyKey;
  vehiculo: { patente: string; marca: string; modelo: string; version: string; anio: number; empresa?: string };
  clienteNombre: string;
  clienteDni?: string;
  total: number;
  /** Datos completos para volver a generar el PDF idéntico. */
  data: BoletoData;
  generadoConAdvertencias?: boolean;
  updatedAt?: string;
  deleted?: boolean;
}

const store = new SyncedCollection<BoletoRecord>('boletos', 'autonet_boletos_v1', {
  max: 300,
  sort: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
});

const DRAFT_PREFIX = 'autonet_boleto_draft_v1_';

export const boletoHistoryService = {
  getAll: () => store.getAll(),
  subscribe: (l: (list: BoletoRecord[]) => void) => store.subscribe(l),
  remove: (id: string) => store.remove(id),

  /** Registra un boleto generado. Si el mismo comprador y unidad ya tenían uno hoy, lo reemplaza. */
  save(rec: Omit<BoletoRecord, 'id' | 'createdAt'>): BoletoRecord {
    const today = todayISO();
    const existing = store
      .getAll()
      .find((b) => b.vehiculo.patente === rec.vehiculo.patente && b.clienteDni === rec.clienteDni && b.createdAt.slice(0, 10) === today);
    const id = existing?.id || `BOL-${Date.now().toString(36).toUpperCase()}`;
    return store.upsert({ ...rec, id, createdAt: existing?.createdAt || new Date().toISOString() });
  },

  // ---- Borradores (solo en este dispositivo) ----
  loadDraft(patente: string): { data: BoletoData; savedAt: string } | null {
    try {
      const raw = localStorage.getItem(DRAFT_PREFIX + patente);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  saveDraft(patente: string, data: BoletoData): void {
    try {
      localStorage.setItem(DRAFT_PREFIX + patente, JSON.stringify({ data, savedAt: new Date().toISOString() }));
    } catch {
      /* sin espacio */
    }
  },
  clearDraft(patente: string): void {
    try {
      localStorage.removeItem(DRAFT_PREFIX + patente);
    } catch {
      /* nada */
    }
  },
};
