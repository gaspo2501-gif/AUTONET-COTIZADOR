import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { authService } from './authService';
import { sanitizeForFirestore } from '../utils/firestoreSanitizer';

/**
 * COLECCIÓN PERSONAL SINCRONIZADA (local primero, nube después)
 *
 * - Siempre funciona sin conexión: lee y escribe en localStorage al instante.
 * - Si hay sesión de Firebase, replica en users/{uid}/{name} y escucha cambios
 *   de otros dispositivos (PC ↔ celular).
 * - Los borrados son "suaves" (deleted: true) para que un dispositivo que
 *   estaba sin conexión no vuelva a subir algo que se borró en otro.
 * - Si el mismo registro cambió en dos lados, gana el de updatedAt más reciente.
 */
export interface SyncedItem {
  id: string;
  updatedAt?: string;
  deleted?: boolean;
}

type Listener<T> = (items: T[]) => void;

export class SyncedCollection<T extends SyncedItem> {
  private listeners: Listener<T>[] = [];
  private cache: T[] | null = null;
  private uid: string | null = null;
  private unsubCloud: (() => void) | null = null;

  constructor(
    private readonly name: string,
    private readonly storageKey: string,
    private readonly options: { max?: number; sort?: (a: T, b: T) => number } = {}
  ) {
    authService.subscribe((user, initializing) => {
      if (initializing) return;
      if (user?.uid && user.uid !== this.uid) this.connect(user.uid);
      if (!user) this.disconnect();
    });
  }

  // ---------- Lectura ----------
  private readRaw(): T[] {
    if (this.cache) return this.cache;
    try {
      const raw = localStorage.getItem(this.storageKey);
      this.cache = raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  /** Registros visibles (sin los borrados), ordenados. */
  public getAll(): T[] {
    const list = this.readRaw().filter((i) => !i.deleted);
    return this.options.sort ? [...list].sort(this.options.sort) : list;
  }

  public get(id: string): T | undefined {
    return this.getAll().find((i) => i.id === id);
  }

  public subscribe(listener: Listener<T>): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // ---------- Escritura ----------
  private writeRaw(list: T[], notify = true): void {
    let next = list;
    const max = this.options.max;
    if (max && next.length > max) {
      const sorted = this.options.sort ? [...next].sort(this.options.sort) : next;
      next = sorted.slice(0, max);
    }
    this.cache = next;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(next));
    } catch (e) {
      console.error(`[${this.name}] No se pudo guardar en el dispositivo:`, e);
    }
    if (notify) {
      const visible = this.getAll();
      this.listeners.forEach((l) => l(visible));
    }
  }

  public upsert(item: T): T {
    const stamped = { ...item, updatedAt: new Date().toISOString() } as T;
    const list = this.readRaw();
    const idx = list.findIndex((i) => i.id === item.id);
    const next = idx >= 0 ? list.map((i, k) => (k === idx ? stamped : i)) : [stamped, ...list];
    this.writeRaw(next);
    this.push(stamped);
    return stamped;
  }

  public update(id: string, patch: Partial<T>): T | undefined {
    const current = this.readRaw().find((i) => i.id === id);
    if (!current) return undefined;
    return this.upsert({ ...current, ...patch, id } as T);
  }

  public remove(id: string): void {
    const current = this.readRaw().find((i) => i.id === id);
    if (!current) return;
    this.upsert({ ...current, deleted: true } as T);
  }

  // ---------- Nube ----------
  private push(item: T): void {
    if (!this.uid || !db || !isFirebaseConfigured) return;
    setDoc(doc(db, 'users', this.uid, this.name, item.id), sanitizeForFirestore(item)).catch((e: unknown) =>
      console.warn(`[${this.name}] Sin sincronizar (se reintentará al volver a conectar):`, e)
    );
  }

  private connect(uid: string): void {
    this.disconnect();
    this.uid = uid;
    if (!db || !isFirebaseConfigured) return;
    let firstSnapshot = true;
    this.unsubCloud = onSnapshot(
      collection(db, 'users', uid, this.name),
      (snap: any) => {
        const remote = new Map<string, T>();
        snap.forEach((d: any) => {
          const data = d.data() as T;
          if (data?.id) remote.set(data.id, data);
        });
        const local = this.readRaw();
        const merged = new Map<string, T>();
        const toPush: T[] = [];
        const ts = (i?: T) => (i?.updatedAt ? Date.parse(i.updatedAt) || 0 : 0);

        local.forEach((l) => {
          const r = remote.get(l.id);
          if (!r) {
            merged.set(l.id, l);
            if (firstSnapshot) toPush.push(l); // registros creados antes de iniciar sesión
          } else if (ts(l) > ts(r)) {
            merged.set(l.id, l);
            toPush.push(l);
          } else {
            merged.set(l.id, r);
          }
        });
        remote.forEach((r, id) => {
          if (!merged.has(id)) merged.set(id, r);
        });

        firstSnapshot = false;
        this.writeRaw([...merged.values()]);
        toPush.forEach((i) => this.push(i));
      },
      (err: unknown) => console.warn(`[${this.name}] Error de sincronización:`, err)
    );
  }

  private disconnect(): void {
    if (this.unsubCloud) {
      try {
        this.unsubCloud();
      } catch {
        /* nada */
      }
    }
    this.unsubCloud = null;
    this.uid = null;
  }
}
