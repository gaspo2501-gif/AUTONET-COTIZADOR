import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  deleteDoc,
  writeBatch, 
  onSnapshot, 
  serverTimestamp,
  runTransaction,
  deleteField,
  Unsubscribe
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Vehicle, UpdateHistoryRecord, VehicleStatus, DiscardedRecordDetail, ParserConfig } from '../types/stock';
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
    const sanitized: Record<string, any> = sanitizeForFirestore({
      ...vehicle,
      cloudUpdatedAt: serverTimestamp(),
      schemaVersion: 1,
    });
    if (!vehicle.fechaFacturacion) {
      sanitized.fechaFacturacion = deleteField();
    }
    await setDoc(docRef, sanitized, { merge: true });
  }

  /**
   * Actualiza o elimina la fecha de facturación de una operación en Firestore.
   */
  public async updateVehicleFacturacion(
    userId: string,
    patente: string,
    fechaFacturacion?: string | null
  ): Promise<void> {
    if (!db) throw new Error('Firestore no disponible');
    const docRef = this.getVehicleDoc(userId, patente);
    const cleanDate = fechaFacturacion && typeof fechaFacturacion === 'string' && fechaFacturacion.trim()
      ? fechaFacturacion.trim().slice(0, 10)
      : null;

    if (cleanDate) {
      await setDoc(docRef, sanitizeForFirestore({
        fechaFacturacion: cleanDate,
        cloudUpdatedAt: serverTimestamp(),
        fechaActualizacion: new Date().toISOString(),
      }), { merge: true });
    } else {
      await setDoc(docRef, {
        fechaFacturacion: deleteField(),
        cloudUpdatedAt: serverTimestamp(),
        fechaActualizacion: new Date().toISOString(),
      }, { merge: true });
    }
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

  // ==========================================
  // CONFIGURACIÓN DEL PARSER (MARCAS PERSONALIZADAS)
  // users/{uid}/config/parser
  // ==========================================

  public async getParserConfig(userId: string): Promise<ParserConfig> {
    if (!db) return { customBrands: [] };
    try {
      const configRef = doc(db, 'users', userId, 'config', 'parser');
      const snap = await getDoc(configRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          customBrands: Array.isArray(data.customBrands) ? data.customBrands : [],
        };
      }
    } catch (err) {
      console.warn('[FIRESTORE] Error obteniendo config del parser:', err);
    }
    return { customBrands: [] };
  }

  public async saveCustomBrand(userId: string, brandName: string): Promise<string[]> {
    if (!db) return [brandName];
    const cleanBrand = brandName.trim().toUpperCase();
    if (!cleanBrand) return [];

    try {
      const configRef = doc(db, 'users', userId, 'config', 'parser');
      const snap = await getDoc(configRef);
      const currentBrands: string[] = snap.exists() && Array.isArray(snap.data()?.customBrands)
        ? snap.data().customBrands
        : [];

      if (!currentBrands.includes(cleanBrand)) {
        const updatedBrands = [...currentBrands, cleanBrand];
        await setDoc(configRef, {
          customBrands: updatedBrands,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        return updatedBrands;
      }
      return currentBrands;
    } catch (err) {
      console.error('[FIRESTORE] Error guardando marca personalizada:', err);
      throw err;
    }
  }

  // ==========================================
  // COLECCIÓN TEMPORAL DE DESCARTES
  // users/{uid}/discarded_records
  // ==========================================

  public async saveDiscardedRecords(userId: string, records: DiscardedRecordDetail[]): Promise<void> {
    if (!db || records.length === 0) return;

    try {
      // Guardar en batches de hasta 400
      const batchSize = 400;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = records.slice(i, i + batchSize);
        chunk.forEach((rec, idx) => {
          const docId = rec.id || (rec.patenteDetectada 
            ? `DISC_${normalizePatenteDocId(rec.patenteDetectada)}` 
            : `DISC_${Date.now()}_${i + idx}`);
          const recRef = doc(db, 'users', userId, 'discarded_records', docId);
          batch.set(recRef, sanitizeForFirestore({
            ...rec,
            id: docId,
            source: 'pdf_parser',
            timestamp: new Date().toISOString(),
            cloudCreatedAt: serverTimestamp(),
          }));
        });
        await batch.commit();
      }
    } catch (err) {
      console.warn('[FIRESTORE] Error guardando descartes temporales:', err);
    }
  }

  public async getDiscardedRecords(userId: string): Promise<DiscardedRecordDetail[]> {
    if (!db) return [];
    try {
      const colRef = collection(db, 'users', userId, 'discarded_records');
      const snap = await getDocs(colRef);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as DiscardedRecordDetail));
    } catch (err) {
      console.warn('[FIRESTORE] Error leyendo registros descartados:', err);
      return [];
    }
  }

  public async removeDiscardedRecord(userId: string, recordId: string): Promise<void> {
    if (!db) return;
    try {
      const docRef = doc(db, 'users', userId, 'discarded_records', recordId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('[FIRESTORE] Error eliminando registro descartado:', err);
    }
  }
}

export const firestoreService = new FirestoreService();
