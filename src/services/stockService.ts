import { INITIAL_STOCK } from '../data/initialStock';
import { DiffResult, UpdateHistoryRecord, Vehicle, VehicleStatus } from '../types/stock';
import { autonetService, AutonetSyncResult } from './autonetService';
import { normalizePlate, KNOWN_BRANDS } from './pdfService';
import { normalizeMileage } from '../utils/formatters';
import { getSituacionOperativaInfo } from '../utils/autonetHelpers';

const STOCK_STORAGE_KEY = 'autonet_stock_v2_real';
const HISTORY_STORAGE_KEY = 'autonet_history_v2_real';

type StockListener = (vehicles: Vehicle[]) => void;

class StockService {
  private listeners: StockListener[] = [];
  private memoryStock: Vehicle[] | null = null;

  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized(): void {
    if (typeof window === 'undefined') return;
    
    // Limpiar claves antiguas de versiones de prueba con datos ficticios
    try {
      localStorage.removeItem('autonet_stock_v1');
      localStorage.removeItem('autonet_history_v1');
    } catch (e) {
      // ignore
    }

    const existing = localStorage.getItem(STOCK_STORAGE_KEY);
    if (!existing) {
      this.saveStock(INITIAL_STOCK);
      return;
    }

    try {
      const parsed = JSON.parse(existing) as Vehicle[];
      // Si por alguna razón tiene los 12 datos de ejemplo viejos o menos de 50 items
      const hasOldMock = parsed.some(v => v.id === 'AUT-101' && v.version.includes('1.4 TSI Highline AT'));
      if (hasOldMock || parsed.length < 50) {
        this.saveStock(INITIAL_STOCK);
        return;
      }

      // Si las unidades en almacenamiento no tienen la sincronización web de Autonet aplicada
      const lacksWebSync = !parsed.some(v => v.sincronizadoAutonetWeb);
      if (lacksWebSync) {
        const initialMap = new Map<string, Vehicle>();
        INITIAL_STOCK.forEach(v => initialMap.set(v.id, v));

        const merged = parsed.map(p => {
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
        this.saveStock(merged);
      }

      // Saneamiento y corrección de datos existentes:
      // 1. Normalizar kilometraje a número entero en todos los registros
      // 2. Corregir registros que hayan quedado con marca "Autonet" o modelo "P"
      const currentList = this.getAllVehicles();
      let hasSanitizationFix = false;
      const sanitized = currentList.map((v) => {
        let modified = false;
        const normKm = normalizeMileage(v.kilometraje) ?? 0;
        let km = v.kilometraje;
        if (v.kilometraje !== normKm) {
          km = normKm;
          modified = true;
        }

        let marca = v.marca;
        let modelo = v.modelo;
        let version = v.version;

        if (
          marca.toLowerCase() === 'autonet' ||
          modelo === 'P' ||
          modelo.startsWith('-') ||
          version.startsWith('-')
        ) {
          // Extraer la marca automotriz real de modelo + version
          const combined = `${modelo} ${version}`.trim();
          for (const b of KNOWN_BRANDS) {
            const m = combined.match(b.regex);
            if (m && m.index !== undefined) {
              marca = b.standard;
              const after = combined.slice(m.index + m[0].length).trim();
              const parts = after.split(/\s+/);
              modelo = (parts[0] || 'Modelo').replace(/^[-_\s]+/, '').trim();
              version = (parts.slice(1).join(' ') || 'Estándar').replace(/^[-_\s]+/, '').trim();
              modified = true;
              break;
            }
          }
        }

        if (modified) {
          hasSanitizationFix = true;
          return {
            ...v,
            kilometraje: km,
            marca,
            modelo,
            version,
          };
        }
        return v;
      });

      if (hasSanitizationFix) {
        this.saveStock(sanitized);
      }
    } catch {
      this.saveStock(INITIAL_STOCK);
    }
  }

  public subscribe(listener: StockListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const data = this.getAllVehicles();
    this.listeners.forEach((listener) => listener(data));
  }

  private saveStock(vehicles: Vehicle[]): void {
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

  public getAllVehicles(): Vehicle[] {
    if (typeof window === 'undefined') {
      return this.memoryStock || INITIAL_STOCK;
    }
    try {
      const data = localStorage.getItem(STOCK_STORAGE_KEY);
      if (!data) {
        this.saveStock(INITIAL_STOCK);
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
    const cleanPatente = patente.replace(/\s+/g, '').toUpperCase();
    return this.getAllVehicles().find(
      (v) => v.patente.replace(/\s+/g, '').toUpperCase() === cleanPatente
    );
  }

  /**
   * Cambia el estado de un vehículo.
   * Si es marcado manualmente como 'Vendido', se activa la bandera `estadoModificadoManualmente`
   * para protegerlo de ser reactivado a 'Disponible' por futuros PDFs sin intervención del usuario.
   */
  public updateVehicleStatus(id: string, nuevoEstado: VehicleStatus, esManual: boolean = true): Vehicle | null {
    const stock = this.getAllVehicles();
    const index = stock.findIndex((v) => v.id === id);
    if (index === -1) return null;

    const current = stock[index];
    const updated: Vehicle = {
      ...current,
      estado: nuevoEstado,
      estadoModificadoManualmente: esManual ? (nuevoEstado === 'Vendido') : current.estadoModificadoManualmente,
      fechaActualizacion: new Date().toISOString(),
    };

    stock[index] = updated;
    this.saveStock(stock);
    return updated;
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

    stock[index] = updated;
    this.saveStock(stock);
    return updated;
  }

  /**
   * Sincroniza el stock actual con el catálogo y fotografías oficiales de la web de Autonet.
   */
  public async syncWithAutonetWeb(): Promise<AutonetSyncResult> {
    const current = this.getAllVehicles();
    const { updatedStock, result } = await autonetService.syncStockWithAutonetWeb(current);
    this.saveStock(updatedStock);
    return result;
  }

  /**
   * Aplica un lote de actualización confirmado por el asesor comercial.
   * Respeta la regla de que unidades vendidas manualmente NUNCA se vuelven a disponible automáticamente.
   * Permite gestionar las unidades que no aparecen en el nuevo PDF (Sección 10).
   */
  public applyBatchUpdate(
    diff: DiffResult,
    missingActions?: Record<string, 'mantener' | 'vendido' | 'reservado' | 'eliminar'>
  ): UpdateHistoryRecord {
    const currentStock = this.getAllVehicles();
    const updatedMap = new Map<string, Vehicle>();

    // Cargar mapa con patentes normalizadas
    currentStock.forEach((v) => {
      const key = normalizePlate(v.patente);
      updatedMap.set(key, { ...v });
    });

    const nowIso = new Date().toISOString();

    diff.items.forEach((item) => {
      const key = normalizePlate(item.patente);

      if (item.tipo === 'nuevo' && item.vehiculoNuevo) {
        // Nuevo ingreso detectado en el PDF (sin fotos)
        const newVehicle: Vehicle = {
          id: item.vehiculoNuevo.id || `AUT-${Math.floor(100 + Math.random() * 900)}`,
          marca: item.vehiculoNuevo.marca || 'Sin Marca',
          modelo: item.vehiculoNuevo.modelo || 'Sin Modelo',
          version: item.vehiculoNuevo.version || '',
          anio: item.vehiculoNuevo.anio || new Date().getFullYear(),
          color: item.vehiculoNuevo.color || 'A confirmar',
          kilometraje: normalizeMileage(item.vehiculoNuevo.kilometraje) ?? 0,
          precio: item.vehiculoNuevo.precio || 0,
          moneda: item.vehiculoNuevo.moneda || 'ARS',
          patente: item.vehiculoNuevo.patente || item.patente,
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
          sincronizadoAutonetWeb: item.vehiculoNuevo.sincronizadoAutonetWeb || false,
          precioPublicadoWeb: item.vehiculoNuevo.precioPublicadoWeb,
          fechaIncorporacion: nowIso,
          fechaActualizacion: nowIso,
          origenDato: 'autonet_pdf',
          provinciaRadicacion: item.vehiculoNuevo.provinciaRadicacion || 'Neuquén',
        };
        updatedMap.set(key, newVehicle);
      } else if (item.tipo === 'modificado' && updatedMap.has(key)) {
        const existing = updatedMap.get(key)!;
        
        // REGLA CRÍTICA: Si el asesor marcó 'Vendido' manualmente, no volver a 'Disponible'
        let nextEstado = existing.estado;
        if (existing.estado === 'Vendido' && existing.estadoModificadoManualmente) {
          nextEstado = 'Vendido';
        }

        // Actualizar todos los datos fuente extraídos del PDF nuevo
        const sourceUpdates: Partial<Vehicle> = {};
        if (item.vehiculoNuevo) {
          if (item.vehiculoNuevo.marca) sourceUpdates.marca = item.vehiculoNuevo.marca;
          if (item.vehiculoNuevo.modelo) sourceUpdates.modelo = item.vehiculoNuevo.modelo;
          if (item.vehiculoNuevo.version) sourceUpdates.version = item.vehiculoNuevo.version;
          if (item.vehiculoNuevo.anio) sourceUpdates.anio = item.vehiculoNuevo.anio;
          if (item.vehiculoNuevo.color) sourceUpdates.color = item.vehiculoNuevo.color;
          if (item.vehiculoNuevo.kilometraje !== undefined) {
            sourceUpdates.kilometraje = normalizeMileage(item.vehiculoNuevo.kilometraje) ?? 0;
          }
          if (item.vehiculoNuevo.precio) sourceUpdates.precio = item.vehiculoNuevo.precio;
          if (item.vehiculoNuevo.empresa) sourceUpdates.empresa = item.vehiculoNuevo.empresa;
          if (item.vehiculoNuevo.ubCode) {
            sourceUpdates.ubCode = item.vehiculoNuevo.ubCode;
            sourceUpdates.ubicacion = item.vehiculoNuevo.ubCode;
            sourceUpdates.ubLabel = item.vehiculoNuevo.ubLabel || getSituacionOperativaInfo(item.vehiculoNuevo.ubCode).shortLabel;
          }
          if (item.vehiculoNuevo.tipoVehiculo) sourceUpdates.tipoVehiculo = item.vehiculoNuevo.tipoVehiculo;
          if (item.vehiculoNuevo.categoriaOrigen) sourceUpdates.categoriaOrigen = item.vehiculoNuevo.categoriaOrigen;
          if (item.vehiculoNuevo.fechaToma) sourceUpdates.fechaToma = item.vehiculoNuevo.fechaToma;
        }

        // Aplicar campos modificados específicos
        const newProps: Partial<Vehicle> = {
          ...sourceUpdates,
          fechaActualizacion: nowIso,
          estado: nextEstado,
        };

        if (item.cambios) {
          item.cambios.forEach((c) => {
            if (c.campo === 'estado' && existing.estadoModificadoManualmente && existing.estado === 'Vendido') {
              // Proteger estado vendido manual
              return;
            }
            if (c.campo === 'kilometraje') {
              (newProps as any)[c.campo] = normalizeMileage(c.valorNuevo) ?? 0;
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
        
        // REGLA ESPECIAL (Sección 10): Si ya estaba marcada como VENDIDO y desaparece del PDF:
        // NO modificar su estado. Conservarla como Vendido.
        if (existing.estado === 'Vendido') {
          // Se mantiene intacto como Vendido
          return;
        }

        const action = missingActions?.[key] || 'mantener';
        if (action === 'eliminar') {
          updatedMap.delete(key);
        } else if (action === 'vendido') {
          updatedMap.set(key, {
            ...existing,
            estado: 'Vendido',
            estadoModificadoManualmente: true,
            fechaActualizacion: nowIso,
          });
        } else if (action === 'reservado') {
          updatedMap.set(key, {
            ...existing,
            estado: 'Reservado',
            fechaActualizacion: nowIso,
          });
        }
        // Si es 'mantener', simplemente se conserva en updatedMap
      }
    });

    const finalStock = Array.from(updatedMap.values());
    this.saveStock(finalStock);

    // Registrar en el historial de actualizaciones
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

    this.saveHistoryRecord(historyRecord);
    return historyRecord;
  }

  public getUpdateHistory(): UpdateHistoryRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) {
        // Semilla con historial oficial de la carga de stock real
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
      const nextHistory = [record, ...history].slice(0, 50); // Guardar últimas 50
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
    } catch (e) {
      console.error('Error saving history record:', e);
    }
  }

  public resetToInitialStock(): void {
    this.saveStock(INITIAL_STOCK);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    this.getUpdateHistory(); // recreate initial record
  }

  public exportStockJson(): string {
    const data = {
      stock: this.getAllVehicles(),
      history: this.getUpdateHistory(),
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };
    return JSON.stringify(data, null, 2);
  }

  public importStockJson(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed.stock)) {
        this.saveStock(parsed.stock);
        if (Array.isArray(parsed.history)) {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(parsed.history));
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
