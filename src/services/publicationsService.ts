import { SyncedCollection } from './syncedCollection';
import { normalizePatent } from '../utils/vehicleIdentity';

export interface PublicationRecord {
  /** Patente normalizada */
  id: string;
  ultimaVez: string; // ISO
  veces: number;
  updatedAt?: string;
  deleted?: boolean;
}

const store = new SyncedCollection<PublicationRecord>('publications', 'autonet_publications_v1');

export const publicationsService = {
  getMap(): Map<string, PublicationRecord> {
    return new Map(store.getAll().map((p) => [p.id, p]));
  },
  subscribe: (l: () => void) => store.subscribe(() => l()),
  markPublished(patente: string) {
    const id = normalizePatent(patente);
    const prev = store.get(id);
    store.upsert({ id, ultimaVez: new Date().toISOString(), veces: (prev?.veces || 0) + 1 });
  },
  unmark(patente: string) {
    store.remove(normalizePatent(patente));
  },
};
