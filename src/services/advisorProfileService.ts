import { SyncedCollection } from './syncedCollection';
import { ADVISOR_INFO, applyAdvisorProfile } from '../constants/advisor';

/**
 * PERFIL DEL ASESOR (uno por usuario)
 * Nombre, cargo y teléfono con los que se firman mensajes de WhatsApp, presupuestos e historias.
 * Se guarda en users/{uid}/profile/me, así cada asesor tiene el suyo.
 */
export interface AdvisorProfile {
  id: 'me';
  nombre: string;
  cargo: string;
  telefono: string;
  email?: string;
  sucursal?: string;
  updatedAt?: string;
  deleted?: boolean;
}

const store = new SyncedCollection<AdvisorProfile>('profile', 'autonet_advisor_profile_v1');

const sync = () => applyAdvisorProfile(store.get('me') || null);
sync();
store.subscribe(sync);

export const advisorProfileService = {
  get(): AdvisorProfile | undefined {
    return store.get('me');
  },
  /** Datos efectivos (perfil guardado o los de arranque). */
  current() {
    return { nombre: ADVISOR_INFO.nombre, cargo: ADVISOR_INFO.cargo, telefono: ADVISOR_INFO.telefono };
  },
  save(p: Omit<AdvisorProfile, 'id'>) {
    store.upsert({ ...p, id: 'me' });
  },
  /** Ya llegó el perfil de la nube y el usuario todavía no cargó sus datos. */
  needsSetup(): boolean {
    return store.synced && !store.get('me');
  },
  subscribe(l: () => void): () => void {
    return store.subscribe(() => l());
  },
};
