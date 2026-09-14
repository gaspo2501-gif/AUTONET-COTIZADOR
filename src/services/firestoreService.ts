import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  writeBatch, 
  onSnapshot, 
  serverTimestamp,
  runTransaction,
  Unsubscribe
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Vehicle, UpdateHistoryRecord, VehicleStatus } from '../types/stock';
import { sanitizeForFirestore, normalizePatenteDocId } from '../utils/firestoreSanitizer';

export type SyncStatus = 'syncing' | 'synced' | 'offline' | 'error';

export interface CloudMigrationMeta {
  migrationCompleted: boolean;
  migratedAt?: string;
  schemaVersion: number;
  totalVehicles?: number;
  migrationVersion?: number;
}

class FirestoreService {
  /**
   * Obtiene la ruta de la colección de vehículos para un usuario.
   */
  private getVehiclesCollection(userId: string) {
    if (!db) throw new Error('Firestore no está inicializado.');
    return collection(db, 'users', userId, 'vehicles');
  }

  /**
   * Obtiene la referencia al documento de un vehículo por su patente.
   */
  private getVehicleDoc(userId: string, patente: string) {
    if (!db) throw new Error('Firestore no está inicializado.');
    const docId = normalizePatenteDocId(patente);
    return doc(db, 'users', userId, 'vehicles', docId);
  }

  /**
   * Obtiene la ruta de la colección de historial de actualizaciones para un usuario.
   */
  private getHistoryCollection(userId: string) {
    if (!db) throw new Error('Firestore no está inicializado.');
    return collection(db, 'users', userId, 'updateHistory');
  }

  /**
   * Obtiene la referencia a los metadatos de migración del usuario.
   */
  public getMigrationMetaDoc(userId: string) {
    if (!db) throw new Error('Firestore no está inicializado.');
    return doc(db, 'users', userId, 'meta', 'migration');
  }

  /**
   * Comprueba si Firestore ya contiene datos para el usuario.
   */
  public async hasUserData(userId: string): Promise<boolean> {
    if (!isFirebaseConfigured || !db) return false;
    try {
      const snap = await getDocs(this.getVehiclesCollection(userId));
      return !snap.empty;
    } catch (e) {
      console.error('Error al comprobar datos en Firestore:', e);
      return false;
    }
  }

  /**
   * Lee todos los vehículos directamente de Firestore (una sola vez).
   */
  public async fetchAllVehicles(userId: string): Promise<Vehicle[]> {
    if (!isFirebaseConfigured || !db) return [];
    const snap = await getDocs(this.getVehiclesCollection(userId));
    const list: Vehicle[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as Vehicle;
      list.push(data);
    });
    return list;
  }

  /**
   * Lee el historial de actualizaciones directamente de Firestore.
   */
  public async fetchUpdateHistory(userId: string): Promise<UpdateHistoryRecord[]> {
    if (!isFirebaseConfigured || !db) return [];
    const snap = await getDocs(this.getHistoryCollection(userId));
    const list: UpdateHistoryRecord[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as UpdateHistoryRecord);
    });
    // Ordenar desc por fecha
    return list.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

  /**
   * Lee el estado de metadatos de migración de Firestore.
   */
  public async getMigrationMeta(userId: string): Promise<CloudMigrationMeta | null> {
    if (!isFirebaseConfigured || !db) return null;
    try {
      const snap = await getDoc(this.getMigrationMetaDoc(userId));
      if (snap.exists()) {
        return snap.data() as CloudMigrationMeta;
      }
      return null;
    } catch (e) {
      console.error('Error al leer meta de migración:', e);
      return null;
    }
  }

  /**
   * Suscribe en tiempo real a los vehículos de un usuario mediante onSnapshot.
   */
  public subscribeToVehicles(
    userId: string, 
    onData: (vehicles: Vehicle[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured || !db) {
      return () => {};
    }
    const q = this.getVehiclesCollection(userId);
    return onSnapshot(
      q,
      (snapshot) => {
        const vehicles: Vehicle[] = [];
        snapshot.forEach((docSnap) => {
          vehicles.push(docSnap.data() as Vehicle);
        });
        onData(vehicles);
      },
      (error) => {
        console.error('Error en onSnapshot de vehículos:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Suscribe en tiempo real al historial de actualizaciones.
   */
  public subscribeToHistory(
    userId: string,
    onData: (history: UpdateHistoryRecord[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured || !db) {
      return () => {};
    }
    const q = this.getHistoryCollection(userId);
    return onSnapshot(
      q,
      (snapshot) => {
        const list: UpdateHistoryRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as UpdateHistoryRecord);
        });
        const sorted = list.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        onData(sorted);
      },
      (error) => {
        console.error('Error en onSnapshot de historial:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Guarda o actualiza un vehículo con transacción/sanitización y cloudUpdatedAt.
   */
  public async saveVehicle(userId: string, vehicle: Vehicle): Promise<void> {
    if (!db) throw new Error('Firestore no disponible');
    const docRef = this.getVehicleDoc(userId, vehicle.patente);
    const sanitized = sanitizeForFirestore({
      ...vehicle,
      cloudUpdatedAt: serverTimestamp(),
      schemaVersion: 1,
    });
    await setDoc(docRef, sanitized, { merge: true });
  }

  /**
   * Modifica el estado comercial de un vehículo usando runTransaction para evitar carreras.
   */
  public async updateVehicleStatusTransaction(
    userId: string,
    patente: string,
    mutator: (current: Vehicle | null) => Vehicle
  ): Promise<Vehicle> {
    if (!db) throw new Error('Firestore no disponible');
    const docRef = this.getVehicleDoc(userId, patente);

    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      const current = snap.exists() ? (snap.data() as Vehicle) : null;
      const updated = mutator(current);
      const sanitized = sanitizeForFirestore({
        ...updated,
        cloudUpdatedAt: serverTimestamp(),
        schemaVersion: 1,
      });
      transaction.set(docRef, sanitized, { merge: true });
      return updated;
    });
  }

  /**
   * Guarda un lote de vehículos dividiéndolos en sub-lotes de máximo 400 operaciones (límite seguro Firestore 500).
   */
  public async batchSaveVehicles(userId: string, vehicles: Vehicle[]): Promise<void> {
    if (!db) throw new Error('Firestore no disponible');
    const BATCH_SIZE = 400;

    for (let i = 0; i < vehicles.length; i += BATCH_SIZE) {
      const chunk = vehicles.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((v) => {
        const docRef = this.getVehicleDoc(userId, v.patente);
        const payload = sanitizeForFirestore({
          ...v,
          cloudUpdatedAt: serverTimestamp(),
          schemaVersion: 1,
        });
        batch.set(docRef, payload, { merge: true });
      });

      await batch.commit();
    }
  }

  /**
   * Guarda un lote de registros de historial.
   */
  public async batchSaveHistory(userId: string, history: UpdateHistoryRecord[]): Promise<void> {
    if (!db) throw new Error('Firestore no disponible');
    const BATCH_SIZE = 400;

    for (let i = 0; i < history.length; i += BATCH_SIZE) {
      const chunk = history.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((record) => {
        const docRef = doc(db!, 'users', userId, 'updateHistory', record.id);
        const payload = sanitizeForFirestore({
          ...record,
          cloudCreatedAt: serverTimestamp(),
          schemaVersion: 1,
        });
        batch.set(docRef, payload, { merge: true });
      });

      await batch.commit();
    }
  }

  /**
   * Guarda un registro individual de historial de actualización de stock.
   */
  public async addHistoryRecord(userId: string, record: UpdateHistoryRecord): Promise<void> {
    if (!db) throw new Error('Firestore no disponible');
    const docRef = doc(db, 'users', userId, 'updateHistory', record.id);
    const payload = sanitizeForFirestore({
      ...record,
      cloudCreatedAt: serverTimestamp(),
      schemaVersion: 1,
    });
    await setDoc(docRef, payload);
  }

  /**
   * Registra la confirmación final de la migración.
   */
  public async setMigrationCompleted(userId: string, totalVehicles: number): Promise<void> {
    if (!db) throw new Error('Firestore no disponible');
    const metaRef = this.getMigrationMetaDoc(userId);
    await setDoc(metaRef, {
      migrationCompleted: true,
      migratedAt: new Date().toISOString(),
      schemaVersion: 1,
      migrationVersion: 1,
      totalVehicles,
      cloudCreatedAt: serverTimestamp(),
    }, { merge: true });
  }
}

export const firestoreService = new FirestoreService();
