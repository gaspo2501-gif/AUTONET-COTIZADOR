import { INITIAL_STOCK } from '../data/initialStock';
import { DiffResult, UpdateHistoryRecord, Vehicle, VehicleStatus } from '../types/stock';
import { autonetService, AutonetSyncResult } from './autonetService';
import {
  normalizePlate,
  isValidPlate,
  isCorruptStoredVehicle,
  KNOWN_BRANDS,
  cleanVersion,
  parseVehicleDescription,
  BANNED_VERSION_PREFIX_REGEX,
} from './pdfService';
import { normalizeMileage } from '../utils/formatters';
import { firestoreService, SyncStatus } from './firestoreService';
import { authService } from './authService';
import { isFirebaseConfigured } from './firebase';
import { normalizePatenteDocId } from '../utils/firestoreSanitizer';

const STOCK_STORAGE_KEY = 'autonet_stock_v2_real';
const HISTORY_STORAGE_KEY = 'autonet_history_v2_real';

type StockListener = (vehicles: Vehicle[]) => void;
type HistoryListener = (history: UpdateHistoryRecord[]) => void;
type SyncStatusListener = (status: SyncStatus) => void;

class StockService {
  private listeners: StockListener[] = [];
  private historyListeners: HistoryListener[] = [];
  private syncStatusListeners: SyncStatusListener[] = [];
  private memoryStock: Vehicle[] | null = null;
  private memoryHistory: UpdateHistoryRecord[] | null = null;
  
  // Sincronización cloud activa
  private currentUserId: string | null = null;
  private isCloudActive: boolean = false;
  private syncStatus: SyncStatus = 'offline';
  private unsubs: (() => void)[] = [];

  constructor() {
    this.ensureInitialized();
    this.setupAuthSync();
  }

  private setupAuthSync(): void {
    authService.subscribe((user, isInitializing) => {
      if (isInitializing) return;

      if (user) {
        this.currentUserId = user.uid;
        this.initCloudSync(user.uid);
      } else {
        this.currentUserId = null;
        this.stopCloudSync();
      }
    });
  }

  private setSyncStatus(status: SyncStatus): void {
    this.syncStatus = status;
    this.syncStatusListeners.forEach((l) => l(status));
  }

  public getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  public subscribeSyncStatus(listener: SyncStatusListener): () => void {
    this.syncStatusListeners.push(listener);
    listener(this.syncStatus);
    return () => {
      this.syncStatusListeners = this.syncStatusListeners.filter((l) => l !== listener);
    };
  }

  public isUsingCloud(): boolean {
    return this.isCloudActive;
  }

  /**
   * Conecta los listeners en tiempo real con Cloud Firestore para el usuario autenticado.
   */
  public initCloudSync(userId: string): void {
    this.stopCloudSync();
    this.currentUserId = userId;

    if (!isFirebaseConfigured) {
      this.setSyncStatus('offline');
      return;
    }

    this.setSyncStatus('syncing');

    // Listener en tiempo real de vehículos
    const unsubVehicles = firestoreService.subscribeToVehicles(
      userId,
      (cloudVehicles) => {
        // Solo si Firestore tiene datos para este usuario activamos Firestore como Fuente Principal de Verdad
        if (cloudVehicles.length > 0) {
          this.isCloudActive = true;
          this.memoryStock = cloudVehicles;
          this.setSyncStatus('synced');
          this.notify();
        } else {
          // Si Firestore está vacío, el usuario puede estar en la PC antes de migrar
          this.setSyncStatus('synced');
        }
      },
      (error) => {
        console.error('[StockService] Error en snapshot de vehículos Firestore:', error);
        this.setSyncStatus(navigator.onLine ? 'error' : 'offline');
      }
    );

    // Listener en tiempo real de historial
    const unsubHistory = firestoreService.subscribeToHistory(
      userId,
      (cloudHistory) => {
        if (cloudHistory.length > 0) {
          this.memoryHistory = cloudHistory;
          this.notifyHistory();
        }
      },
      (error) => {
        console.error('[StockService] Error en snapshot de historial Firestore:', error);
      }
    );

    this.unsubs.push(unsubVehicles, unsubHistory);

    // Detección de conectividad del navegador
    if (typeof window !== 'undefined') {
      const handleOnline = () => this.setSyncStatus('synced');
      const handleOffline = () => this.setSyncStatus('offline');
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      this.unsubs.push(() => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      });
    }
  }

  public stopCloudSync(): void {
    this.unsubs.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {
        // ignore
      }
    });
    this.unsubs = [];
    this.isCloudActive = false;
    this.setSyncStatus('offline');
  }

  private ensureInitialized(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem('autonet_stock_v1');
      localStorage.removeItem('autonet_history_v1');
    } catch {
      // ignore
    }

    const existing = localStorage.getItem(STOCK_STORAGE_KEY);
    if (!existing) {
      this.saveLocalStockOnly(INITIAL_STOCK);
      return;
    }

    try {
      const parsed = JSON.parse(existing) as Vehicle[];
      const hasOldMock = parsed.some((v) => v.id === 'AUT-101' && v.version.includes('1.4 TSI Highline AT'));
      if (hasOldMock || parsed.length < 50) {
        this.saveLocalStockOnly(INITIAL_STOCK);
        return;
      }

      const lacksWebSync = !parsed.some((v) => v.sincronizadoAutonetWeb);
      if (lacksWebSync) {
        const initialMap = new Map<string, Vehicle>();
        INITIAL_STOCK.forEach((v) => initialMap.set(v.id, v));

        const merged = parsed.map((p) => {
          const fresh = initialMap.get(p.id);
          if (!fresh) return p;
          return {
            ...p,
            fotoPrincipal: fresh.fotoPrincipal || p.fotoPrincipal,
            fotos: fresh.fotos && fresh.fotos.length > 0 ? fresh.fotos : p.fotos,
            urlAutonetOriginal: fresh.urlAutonetOriginal || p.urlAutonetOriginal,
            precioPublicadoWeb: fresh.precioPublicadoWeb || p.precioPublicadoWeb,
            sincronizadoAutonetWeb: fresh.sincronizadoAutonetWeb,
            fechaSincronizacionWeb: fresh.fechaSincronizacionWeb,
            descripcionWeb: fresh.descripcionWeb || p.descripcionWeb,
            autonetWebId: fresh.autonetWebId || p.autonetWebId,
          };
        });
        this.saveLocalStockOnly(merged);
      }
    } catch {
      this.saveLocalStockOnly(INITIAL_STOCK);
    }
  }

  public subscribe(listener: StockListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public subscribeHistory(listener: HistoryListener): () => void {
    this.historyListeners.push(listener);
    return () => {
      this.historyListeners = this.historyListeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const data = this.getAllVehicles();
    this.listeners.forEach((listener) => listener(data));
  }

  private notifyHistory(): void {
    const data = this.getUpdateHistory();
    this.historyListeners.forEach((listener) => listener(data));
  }

  /**
   * Guarda únicamente en localStorage (utilizado para estado local previo a la migración).
   * NO borra ni altera keys no correspondientes.
   */
  private saveLocalStockOnly(vehicles: Vehicle[]): void {
    this.memoryStock = vehicles;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(vehicles));
      } catch (e) {
        console.error('Error writing stock to localStorage:', e);
      }
    }
    this.notify();
  }

  /**
   * Guarda un vehículo individual de forma persistente.
   * Si cloud está activo, escribe directamente en Firestore.
   * Si cloud no está activo, actualiza localStorage.
   */
  private async persistVehicle(updatedVehicle: Vehicle): Promise<void> {
    if (this.isCloudActive && this.currentUserId) {
      await firestoreService.saveVehicle(this.currentUserId, updatedVehicle);
      // El onSnapshot actualizará la memoria y notificará
    } else {
      const stock = this.getAllVehicles();
      const index = stock.findIndex((v) => v.id === updatedVehicle.id || v.patente === updatedVehicle.patente);
      if (index !== -1) {
        stock[index] = updatedVehicle;
      } else {
        stock.push(updatedVehicle);
      }
      this.saveLocalStockOnly(stock);
    }
  }

  public getAllVehicles(): Vehicle[] {
    if (this.isCloudActive && this.memoryStock) {
      return this.memoryStock;
    }

    if (typeof window === 'undefined') {
      return this.memoryStock || INITIAL_STOCK;
    }
    try {
      const data = localStorage.getItem(STOCK_STORAGE_KEY);
      if (!data) {
        this.saveLocalStockOnly(INITIAL_STOCK);
        return INITIAL_STOCK;
      }
      const parsed = JSON.parse(data) as Vehicle[];
      this.memoryStock = parsed;
      return parsed;
    } catch (e) {
      console.error('Error reading stock from storage:', e);
      return this.memoryStock || INITIAL_STOCK;
    }
  }

  public getVehicleById(id: string): Vehicle | undefined {
    return this.getAllVehicles().find((v) => v.id === id);
  }

  public getVehicleByPatente(patente: string): Vehicle | undefined {
    const cleanPatente = normalizePlate(patente);
    return this.getAllVehicles().find(
      (v) => normalizePlate(v.patente) === cleanPatente
    );
  }

  /**
   * Cambia el estado de un vehículo.
   */
  public updateVehicleStatus(id: string, nuevoEstado: VehicleStatus, esManual: boolean = true): Vehicle | null {
    const stock = this.getAllVehicles();
    const index = stock.findIndex((v) => v.id === id);
    if (index === -1) return null;

    const current = stock[index];
    const today = new Date().toISOString().split('T')[0];
    const updated: Vehicle = {
      ...current,
      estado: nuevoEstado,
      estadoModificadoManualmente: esManual ? (nuevoEstado === 'Vendido') : current.estadoModificadoManualmente,
      saleOwner: nuevoEstado === 'Vendido' ? (current.saleOwner ?? null) : current.saleOwner,
      soldAt: nuevoEstado === 'Vendido' ? (current.soldAt || today) : current.soldAt,
      soldPrice: nuevoEstado === 'Vendido' ? (current.soldPrice ?? current.precio) : current.soldPrice,
      fechaActualizacion: new Date().toISOString(),
    };

    if (this.isCloudActive && this.currentUserId) {
      firestoreService.saveVehicle(this.currentUserId, updated).catch((err) => {
        console.error('Error al guardar cambio de estado en Firestore:', err);
      });
      // Optimistic update
      stock[index] = updated;
      this.memoryStock = stock;
      this.notify();
    } else {
      stock[index] = updated;
      this.saveLocalStockOnly(stock);
    }

    return updated;
  }

  /**
   * Registra una unidad como vendida indicando si fue venta propia o de otro vendedor.
   */
  public markVehicleAsSold(
    id: string,
    options: {
      saleOwner: 'self' | 'other';
      soldAt?: string;
      soldPrice?: number;
      observaciones?: string;
    }
  ): Vehicle | null {
    const stock = this.getAllVehicles();
    const index = stock.findIndex((v) => v.id === id);
    if (index === -1) return null;

    const current = stock[index];
    const today = new Date().toISOString().split('T')[0];
    const updated: Vehicle = {
      ...current,
      estado: 'Vendido',
      estadoModificadoManualmente: true,
      saleOwner: options.saleOwner,
      soldAt: options.soldAt || current.soldAt || today,
      soldPrice: options.soldPrice ?? current.soldPrice ?? current.precio,
      observaciones: options.observaciones
        ? `${current.observaciones ? current.observaciones + '\n' : ''}[Venta ${options.saleOwner === 'self' ? 'Propia' : 'Otro'}]: ${options.observaciones}`
        : current.observaciones,
      fechaActualizacion: new Date().toISOString(),
    };

    if (this.isCloudActive && this.currentUserId) {
      firestoreService.saveVehicle(this.currentUserId, updated).catch((err) => {
        console.error('Error al marcar vehículo vendido en Firestore:', err);
      });
      stock[index] = updated;
      this.memoryStock = stock;
      this.notify();
    } else {
      stock[index] = updated;
      this.saveLocalStockOnly(stock);
    }

    return updated;
  }

  /**
   * Modifica los datos de una venta existente.
   */
  public updateSaleInfo(
    id: string,
    options: {
      saleOwner: 'self' | 'other' | null;
      soldAt?: string;
      soldPrice?: number;
    }
  ): Vehicle | null {
    const stock = this.getAllVehicles();
    const index = stock.findIndex((v) => v.id === id);
    if (index === -1) return null;

    const current = stock[index];
    const updated: Vehicle = {
      ...current,
      saleOwner: options.saleOwner,
      soldAt: options.soldAt ?? current.soldAt,
      soldPrice: options.soldPrice ?? current.soldPrice,
      fechaActualizacion: new Date().toISOString(),
    };

    if (this.isCloudActive && this.currentUserId) {
      firestoreService.saveVehicle(this.currentUserId, updated).catch((err) => {
        console.error('Error al actualizar venta en Firestore:', err);
      });
      stock[index] = updated;
      this.memoryStock = stock;
      this.notify();
    } else {
      stock[index] = updated;
      this.saveLocalStockOnly(stock);
    }

    return updated;
  }

  /**
   * Revierte un vehículo vendido o fuera de stock a Disponible.
   */
  public revertVehicleToAvailable(id: string): Vehicle | null {
    const stock = this.getAllVehicles();
    const index = stock.findIndex((v) => v.id === id);
    if (index === -1) return null;

    const current = stock[index];
    const updated: Vehicle = {
      ...current,
      estado: 'Disponible',
      estadoModificadoManualmente: false,
      saleOwner: null,
      soldAt: undefined,
      soldPrice: undefined,
      fechaActualizacion: new Date().toISOString(),
    };

    if (this.isCloudActive && this.currentUserId) {
      firestoreService.saveVehicle(this.currentUserId, updated).catch((err) => {
        console.error('Error al revertir vehículo a disponible en Firestore:', err);
      });
      stock[index] = updated;
      this.memoryStock = stock;
      this.notify();
    } else {
      stock[index] = updated;
      this.saveLocalStockOnly(stock);
    }

    return updated;
  }

  public getActiveStock(): Vehicle[] {
    return this.getAllVehicles().filter(
      (v) => !v.isHistorical && (v.estado === 'Disponible' || v.estado === 'Reservado')
    );
  }

  public getMySales(): Vehicle[] {
    return this.getAllVehicles().filter((v) => v.estado === 'Vendido' && v.saleOwner === 'self');
  }

  public getAllSales(): Vehicle[] {
    return this.getAllVehicles().filter((v) => v.estado === 'Vendido');
  }

  public getOutOfStockVehicles(): Vehicle[] {
    return this.getAllVehicles().filter((v) => v.isHistorical || v.estado === 'fuera_de_stock');
  }

  public updateVehicle(id: string, updates: Partial<Vehicle>): Vehicle | null {
    const stock = this.getAllVehicles();
    const index = stock.findIndex((v) => v.id === id);
    if (index === -1) return null;

    const current = stock[index];
    const updated: Vehicle = {
      ...current,
      ...updates,
      fechaActualizacion: new Date().toISOString(),
    };

    if (this.isCloudActive && this.currentUserId) {
      firestoreService.saveVehicle(this.currentUserId, updated).catch((err) => {
        console.error('Error al actualizar vehículo en Firestore:', err);
      });
      stock[index] = updated;
      this.memoryStock = stock;
      this.notify();
    } else {
      stock[index] = updated;
      this.saveLocalStockOnly(stock);
    }

    return updated;
  }

  public async syncWithAutonetWeb(): Promise<AutonetSyncResult> {
    const current = this.getAllVehicles();
    const { updatedStock, result } = await autonetService.syncStockWithAutonetWeb(current);

    if (this.isCloudActive && this.currentUserId) {
      await firestoreService.batchSaveVehicles(this.currentUserId, updatedStock);
      this.memoryStock = updatedStock;
      this.notify();
    } else {
      this.saveLocalStockOnly(updatedStock);
    }
    return result;
  }

  /**
   * Aplica un lote de actualización confirmado por el asesor comercial.
   * Regla de Stock Activo Fiel: El stock activo pasa a ser exactamente el del PDF.
   * Las unidades que ya no figuran pasan automáticamente al registro histórico
   * (fuera_de_stock / conservando ventas o reservas).
   */
  public applyBatchUpdate(diff: DiffResult): UpdateHistoryRecord {
    const currentStock = this.getAllVehicles();
    const updatedMap = new Map<string, Vehicle>();

    currentStock.forEach((v) => {
      const corruptCheck = isCorruptStoredVehicle(v);
      if (corruptCheck.isCorrupt) {
        return;
      }
      const key = normalizePlate(v.patente);
      if (key && isValidPlate(key)) {
        updatedMap.set(key, { ...v });
      }
    });

    const nowIso = new Date().toISOString();

    diff.items.forEach((item) => {
      const key = normalizePlate(item.patente);
      if (!key || !isValidPlate(key)) {
        return;
      }

      if (item.tipo === 'nuevo' && item.vehiculoNuevo) {
        const newVehicle: Vehicle = {
          id: item.vehiculoNuevo.id || `AUT-${Math.floor(100 + Math.random() * 900)}`,
          marca: item.vehiculoNuevo.marca || 'Sin Marca',
          modelo: item.vehiculoNuevo.modelo || 'Sin Modelo',
          version: cleanVersion(item.vehiculoNuevo.version || ''),
          anio: item.vehiculoNuevo.anio || new Date().getFullYear(),
          color: item.vehiculoNuevo.color || 'A confirmar',
          kilometraje: normalizeMileage(item.vehiculoNuevo.kilometraje) ?? 0,
          precio: item.vehiculoNuevo.precio || 0,
          moneda: item.vehiculoNuevo.moneda || 'ARS',
          patente: key,
          combustible: item.vehiculoNuevo.combustible || 'Nafta',
          caja: item.vehiculoNuevo.caja || 'Manual',
          traccion: item.vehiculoNuevo.traccion || '4x2',
          estado: 'Disponible',
          observaciones: item.vehiculoNuevo.observaciones || 'Ingreso incorporado automáticamente mediante actualización de lista.',
          fotoPrincipal: '',
          fotos: [],
          urlAutonetOriginal: item.vehiculoNuevo.urlAutonetOriginal,
          ubicacion: item.vehiculoNuevo.ubicacion || 'Neuquén',
          empresa: item.vehiculoNuevo.empresa || 'Autonet',
          fechaToma: item.vehiculoNuevo.fechaToma,
          categoriaOrigen: item.vehiculoNuevo.categoriaOrigen,
          tipoVehiculo: item.vehiculoNuevo.tipoVehiculo,
          ubCode: item.vehiculoNuevo.ubCode,
          ubLabel: item.vehiculoNuevo.ubLabel,
          fechaIncorporacion: nowIso,
          fechaActualizacion: nowIso,
          origenDato: 'autonet_pdf',
          provinciaRadicacion: 'Neuquén',
          isHistorical: false,
        };
        updatedMap.set(key, newVehicle);
      } else if (item.tipo === 'modificado' && updatedMap.has(key)) {
        const existing = updatedMap.get(key)!;
        const newProps: Partial<Vehicle> = {
          fechaActualizacion: nowIso,
          isHistorical: false,
        };

        if (item.cambios && item.cambios.length > 0) {
          item.cambios.forEach((c) => {
            if (c.campo === 'precio') {
              newProps.precio =
                typeof c.valorNuevo === 'number'
                  ? c.valorNuevo
                  : Number(String(c.valorNuevo).replace(/[^0-9]/g, '')) || 0;
            } else if (c.campo === 'kilometraje') {
              newProps.kilometraje = normalizeMileage(c.valorNuevo) ?? 0;
            } else if (c.campo === 'anio') {
              (newProps as any)[c.campo] =
                typeof c.valorNuevo === 'number'
                  ? c.valorNuevo
                  : Number(String(c.valorNuevo).replace(/[^0-9]/g, '')) || 0;
            } else {
              (newProps as any)[c.campo] = c.valorNuevo;
            }
          });
        }

        updatedMap.set(key, {
          ...existing,
          ...newProps,
        });
      } else if (item.tipo === 'no_aparece' && updatedMap.has(key)) {
        const existing = updatedMap.get(key)!;
        if (existing.estado === 'Vendido') {
          updatedMap.set(key, {
            ...existing,
            isHistorical: true,
            fechaSalidaStock: existing.fechaSalidaStock || nowIso,
            fechaActualizacion: nowIso,
          });
        } else if (existing.estado === 'Reservado') {
          updatedMap.set(key, {
            ...existing,
            isHistorical: true,
            fechaSalidaStock: existing.fechaSalidaStock || nowIso,
            fechaActualizacion: nowIso,
          });
        } else {
          updatedMap.set(key, {
            ...existing,
            estado: 'fuera_de_stock',
            isHistorical: true,
            fechaSalidaStock: nowIso,
            fechaActualizacion: nowIso,
          });
        }
      }
    });

    const finalStock = Array.from(updatedMap.values());

    const historyRecord: UpdateHistoryRecord = {
      id: `UPD-${Date.now()}`,
      fecha: nowIso,
      archivoNombre: diff.archivoNombre,
      vehiculosEncontrados: diff.totalEncontrados,
      nuevos: diff.nuevos,
      modificados: diff.modificados,
      sinCambios: diff.sinCambios,
      noAparecen: diff.noAparecen,
      cambiosPrecio: diff.cambiosPrecio,
      cambiosDetectados: diff.items,
      errores: [],
    };

    if (this.isCloudActive && this.currentUserId) {
      firestoreService.batchSaveVehicles(this.currentUserId, finalStock).catch((err) => {
        console.error('Error al guardar lote de stock en Firestore:', err);
      });
      firestoreService.addHistoryRecord(this.currentUserId, historyRecord).catch((err) => {
        console.error('Error al registrar historial en Firestore:', err);
      });
      this.memoryStock = finalStock;
      this.memoryHistory = [historyRecord, ...(this.memoryHistory || [])];
      this.notify();
      this.notifyHistory();
    } else {
      this.saveLocalStockOnly(finalStock);
      this.saveHistoryRecord(historyRecord);
    }

    return historyRecord;
  }

  public getUpdateHistory(): UpdateHistoryRecord[] {
    if (this.isCloudActive && this.memoryHistory) {
      return this.memoryHistory;
    }

    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) {
        const initialLog: UpdateHistoryRecord = {
          id: 'UPD-INIT-AUTONET-01',
          fecha: '2026-09-01T12:00:00.000Z',
          archivoNombre: 'STOCK UNIDADES DISPONIBLES AUTONET AL 1-9-2026.pdf',
          vehiculosEncontrados: 227,
          nuevos: 227,
          modificados: 0,
          sinCambios: 0,
          noAparecen: 0,
          cambiosPrecio: 0,
          cambiosDetectados: [],
          errores: [],
        };
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([initialLog]));
        return [initialLog];
      }
      return JSON.parse(raw) as UpdateHistoryRecord[];
    } catch (e) {
      console.error('Error reading history:', e);
      return [];
    }
  }

  private saveHistoryRecord(record: UpdateHistoryRecord): void {
    if (typeof window === 'undefined') return;
    try {
      const history = this.getUpdateHistory();
      const nextHistory = [record, ...history].slice(0, 50);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
    } catch (e) {
      console.error('Error saving history record:', e);
    }
  }

  public resetToInitialStock(): void {
    if (this.isCloudActive && this.currentUserId) {
      firestoreService.batchSaveVehicles(this.currentUserId, INITIAL_STOCK).catch(console.error);
      this.memoryStock = INITIAL_STOCK;
      this.notify();
    } else {
      this.saveLocalStockOnly(INITIAL_STOCK);
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      this.getUpdateHistory();
    }
  }

  public exportStockJson(): string {
    const data = {
      stock: this.getAllVehicles(),
      history: this.getUpdateHistory(),
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      source: this.isCloudActive ? 'firestore_cloud' : 'local_storage',
    };
    return JSON.stringify(data, null, 2);
  }

  public importStockJson(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed.stock)) {
        if (this.isCloudActive && this.currentUserId) {
          firestoreService.batchSaveVehicles(this.currentUserId, parsed.stock).catch(console.error);
          if (Array.isArray(parsed.history)) {
            firestoreService.batchSaveHistory(this.currentUserId, parsed.history).catch(console.error);
          }
          this.memoryStock = parsed.stock;
          this.notify();
        } else {
          this.saveLocalStockOnly(parsed.stock);
          if (Array.isArray(parsed.history)) {
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(parsed.history));
          }
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error('Invalid JSON import:', e);
      return false;
    }
  }
}

export const stockService = new StockService();
