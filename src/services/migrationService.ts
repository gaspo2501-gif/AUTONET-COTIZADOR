import { Vehicle, UpdateHistoryRecord } from '../types/stock';
import { firestoreService } from './firestoreService';
import { normalizePatenteDocId } from '../utils/firestoreSanitizer';
import { calculateStockCounts } from '../utils/stockSelectors';

export interface LocalStockInventory {
  hasLocalData: boolean;
  stockKey: string;
  historyKey: string;
  vehicles: Vehicle[];
  history: UpdateHistoryRecord[];
  counts: {
    total: number;
    activo: number;
    disponible: number;
    reservado: number;
    misVentas: number;
    ventasOtros: number;
    fueraStock: number;
    historialActualizaciones: number;
  };
}

export interface MigrationValidationResult {
  success: boolean;
  localCount: number;
  cloudCount: number;
  missingPatentes: string[];
  mismatchedStatuses: { patente: string; local: string; cloud: string }[];
  localCounts: ReturnType<typeof calculateStockCounts>;
  cloudCounts: ReturnType<typeof calculateStockCounts>;
  errorMessage?: string;
}

export const STOCK_STORAGE_KEY = 'autonet_stock_v2_real';
export const HISTORY_STORAGE_KEY = 'autonet_history_v2_real';
export const CLOUD_MIGRATION_FLAG_KEY = 'cloudMigrationCompleted';

class MigrationService {
  /**
   * Lee e inspecciona el inventario local real existente sin modificarlo.
   */
  public getLocalInventory(): LocalStockInventory {
    if (typeof window === 'undefined') {
      return {
        hasLocalData: false,
        stockKey: STOCK_STORAGE_KEY,
        historyKey: HISTORY_STORAGE_KEY,
        vehicles: [],
        history: [],
        counts: {
          total: 0,
          activo: 0,
          disponible: 0,
          reservado: 0,
          misVentas: 0,
          ventasOtros: 0,
          fueraStock: 0,
          historialActualizaciones: 0,
        },
      };
    }

    let vehicles: Vehicle[] = [];
    let history: UpdateHistoryRecord[] = [];

    try {
      const rawStock = localStorage.getItem(STOCK_STORAGE_KEY);
      if (rawStock) {
        const parsed = JSON.parse(rawStock);
        if (Array.isArray(parsed)) {
          vehicles = parsed;
        }
      }
    } catch (e) {
      console.error('Error al inspeccionar stock local:', e);
    }

    try {
      const rawHist = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (rawHist) {
        const parsed = JSON.parse(rawHist);
        if (Array.isArray(parsed)) {
          history = parsed;
        }
      }
    } catch (e) {
      console.error('Error al inspeccionar historial local:', e);
    }

    const counts = calculateStockCounts(vehicles);

    return {
      hasLocalData: vehicles.length > 0,
      stockKey: STOCK_STORAGE_KEY,
      historyKey: HISTORY_STORAGE_KEY,
      vehicles,
      history,
      counts: {
        total: counts.todos,
        activo: counts.activo,
        disponible: counts.disponible,
        reservado: counts.reservado,
        misVentas: counts.misVentas,
        ventasOtros: counts.ventasOtros,
        fueraStock: counts.fueraStock,
        historialActualizaciones: history.length,
      },
    };
  }

  /**
   * Comprueba si el usuario debe ver la oferta de migración inicial.
   * Reglas:
   * 1. Usuario autenticado.
   * 2. Existen datos locales reales (vehicles.length > 0).
   * 3. Firestore para este usuario está COMPLETAMENTE VACÍO.
   * 4. NO se ha marcado ya como migrado en cloud.
   */
  public async checkMigrationNeeded(userId: string): Promise<boolean> {
    const local = this.getLocalInventory();
    if (!local.hasLocalData) return false;

    const migrationMeta = await firestoreService.getMigrationMeta(userId);
    if (migrationMeta?.migrationCompleted) {
      return false;
    }

    const hasData = await firestoreService.hasUserData(userId);
    // Solo si Firestore está completamente vacío ofrecemos la migración inicial
    return !hasData;
  }

  /**
   * Genera el archivo descargable de backup seguro antes de migrar.
   */
  public generateBackupJson(): { filename: string; content: string } {
    const inventory = this.getLocalInventory();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const filename = `autonet-backup-${year}-${month}-${day}-${hours}${minutes}.json`;

    const backupPayload = {
      schemaVersion: 1,
      migrationVersion: 1,
      exportedAt: now.toISOString(),
      localStorageKeys: {
        stockKey: STOCK_STORAGE_KEY,
        historyKey: HISTORY_STORAGE_KEY,
      },
      counts: inventory.counts,
      datos: {
        vehicles: inventory.vehicles,
        history: inventory.history,
      },
    };

    return {
      filename,
      content: JSON.stringify(backupPayload, null, 2),
    };
  }

  /**
   * Descarga el backup obligatorio en el navegador del usuario.
   */
  public triggerBackupDownload(): void {
    const backup = this.generateBackupJson();
    const blob = new Blob([backup.content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backup.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Ejecuta la migración a Firestore por lotes seguros y valida rigurosamente post-escritura.
   */
  public async executeMigration(
    userId: string,
    onProgress?: (progressText: string) => void
  ): Promise<MigrationValidationResult> {
    const inventory = this.getLocalInventory();
    if (!inventory.hasLocalData) {
      throw new Error('No se detectaron datos locales para migrar.');
    }

    // Doble verificación: no sobreescribir si Firestore ya tiene datos
    const alreadyHasData = await firestoreService.hasUserData(userId);
    if (alreadyHasData) {
      throw new Error('Firestore ya contiene stock registrado. La migración inicial ha sido cancelada para evitar sobreescritura.');
    }

    if (onProgress) onProgress(`Guardando ${inventory.vehicles.length} vehículos en lotes...`);
    await firestoreService.batchSaveVehicles(userId, inventory.vehicles);

    if (inventory.history.length > 0) {
      if (onProgress) onProgress(`Guardando ${inventory.history.length} registros de historial...`);
      await firestoreService.batchSaveHistory(userId, inventory.history);
    }

    if (onProgress) onProgress('Verificando datos guardados en Firestore...');
    // Verificación Post-Migración leyendo directo de Cloud
    const cloudVehicles = await firestoreService.fetchAllVehicles(userId);

    const validation = this.validateMigration(inventory.vehicles, cloudVehicles);

    if (validation.success) {
      if (onProgress) onProgress('Registrando confirmación de migración en Cloud...');
      await firestoreService.setMigrationCompleted(userId, cloudVehicles.length);

      // Marcar bandera local de migración SIN BORRAR NI ALTERAR los keys anteriores
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(CLOUD_MIGRATION_FLAG_KEY, 'true');
        } catch (e) {
          // ignore
        }
      }
    }

    return validation;
  }

  /**
   * Valida la concordancia exacta entre el estado local y los documentos leídos de Firestore.
   */
  public validateMigration(
    localVehicles: Vehicle[],
    cloudVehicles: Vehicle[]
  ): MigrationValidationResult {
    const localMap = new Map<string, Vehicle>();
    localVehicles.forEach((v) => {
      const docId = normalizePatenteDocId(v.patente);
      if (docId) localMap.set(docId, v);
    });

    const cloudMap = new Map<string, Vehicle>();
    cloudVehicles.forEach((v) => {
      const docId = normalizePatenteDocId(v.patente);
      if (docId) cloudMap.set(docId, v);
    });

    const missingPatentes: string[] = [];
    const mismatchedStatuses: { patente: string; local: string; cloud: string }[] = [];

    // Comprobar que cada patente local existe en la nube
    for (const [docId, localVehicle] of localMap.entries()) {
      const cloudVehicle = cloudMap.get(docId);
      if (!cloudVehicle) {
        missingPatentes.push(localVehicle.patente);
      } else if (cloudVehicle.estado !== localVehicle.estado) {
        mismatchedStatuses.push({
          patente: localVehicle.patente,
          local: localVehicle.estado,
          cloud: cloudVehicle.estado,
        });
      }
    }

    const localCounts = calculateStockCounts(localVehicles);
    const cloudCounts = calculateStockCounts(cloudVehicles);

    const success = 
      missingPatentes.length === 0 && 
      mismatchedStatuses.length === 0 &&
      cloudVehicles.length >= localMap.size;

    return {
      success,
      localCount: localVehicles.length,
      cloudCount: cloudVehicles.length,
      missingPatentes,
      mismatchedStatuses,
      localCounts,
      cloudCounts,
      errorMessage: success
        ? undefined
        : `Faltan ${missingPatentes.length} patentes o hay ${mismatchedStatuses.length} diferencias de estado.`,
    };
  }
}

export const migrationService = new MigrationService();
