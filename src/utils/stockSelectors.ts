import { CommercialFilter, StockFilters, Vehicle, VehicleStatus } from '../types/stock';
import { normalizeMileage } from './formatters';

/**
 * SELECTORES CENTRALIZADOS DE STOCK — AUTONET
 * 
 * ÚNICA FUENTE DE VERDAD para clasificar, contar y filtrar vehículos en la aplicación.
 * Garantiza total coherencia entre contadores, pestañas, grilla de tarjetas y tabla.
 */

export type NormalizedCommercialStatus = 'Disponible' | 'Reservado' | 'Vendido' | 'fuera_de_stock';

/**
 * Normaliza cualquier estado comercial contemplando mayúsculas, minúsculas,
 * espacios, guiones o variantes en inglés/español.
 */
export function normalizeCommercialStatus(status: any): NormalizedCommercialStatus {
  if (!status) return 'Disponible';
  const clean = String(status).trim().toLowerCase().replace(/[-_ ]+/g, '_');
  if (clean === 'reservado' || clean === 'reserved') return 'Reservado';
  if (clean === 'vendido' || clean === 'sold') return 'Vendido';
  if (clean === 'fuera_de_stock' || clean === 'historical' || clean === 'historico' || clean === 'fuera_stock') return 'fuera_de_stock';
  return 'Disponible';
}

export type CommercialViewKey = 
  | 'active'
  | 'available'
  | 'reserved'
  | 'sold-self'
  | 'sold-other'
  | 'historical'
  | 'all';

/**
 * Normaliza cualquier vista comercial activa
 */
export function normalizeCommercialView(view?: any): CommercialViewKey {
  if (!view) return 'active';
  const v = String(view).trim().toLowerCase().replace(/[-_ ]+/g, '_');
  if (v === 'reserved' || v === 'reservado' || v === 'reservados') return 'reserved';
  if (v === 'available' || v === 'disponible' || v === 'disponibles') return 'available';
  if (v === 'sold_self' || v === 'vendidas_propias' || v === 'mis_ventas' || v === 'ventas_propias' || v === 'sold-self') return 'sold-self';
  if (v === 'sold_other' || v === 'vendidas_otros' || v === 'ventas_otros' || v === 'sold-other') return 'sold-other';
  if (v === 'historical' || v === 'fuera_de_stock' || v === 'historico' || v === 'fuera_stock') return 'historical';
  if (v === 'all' || v === 'todos' || v === 'todos_los_estados') return 'all';
  return 'active';
}

export const isHistoricalVehicle = (v: Vehicle): boolean => {
  return Boolean(v.isHistorical || normalizeCommercialStatus(v.estado) === 'fuera_de_stock');
};

export const isActiveVehicle = (v: Vehicle): boolean => {
  if (isHistoricalVehicle(v)) return false;
  const s = normalizeCommercialStatus(v.estado);
  return s === 'Disponible' || s === 'Reservado';
};

export const isAvailableVehicle = (v: Vehicle): boolean => {
  if (isHistoricalVehicle(v)) return false;
  return normalizeCommercialStatus(v.estado) === 'Disponible';
};

export const isReservedVehicle = (v: Vehicle): boolean => {
  if (isHistoricalVehicle(v)) return false;
  return normalizeCommercialStatus(v.estado) === 'Reservado';
};

export const isMySoldVehicle = (v: Vehicle): boolean => {
  return normalizeCommercialStatus(v.estado) === 'Vendido' && v.saleOwner === 'self';
};

export const isOtherSoldVehicle = (v: Vehicle): boolean => {
  return normalizeCommercialStatus(v.estado) === 'Vendido' && v.saleOwner === 'other';
};

export const isOutOfStockVehicle = (v: Vehicle): boolean => {
  return isHistoricalVehicle(v);
};

// Selectores de colecciones
export const getActiveVehicles = (vehicles: Vehicle[]): Vehicle[] => {
  return vehicles.filter(isActiveVehicle);
};

export const getAvailableVehicles = (vehicles: Vehicle[]): Vehicle[] => {
  return vehicles.filter(isAvailableVehicle);
};

export const getReservedVehicles = (vehicles: Vehicle[]): Vehicle[] => {
  return vehicles.filter(isReservedVehicle);
};

export const getMySoldVehicles = (vehicles: Vehicle[]): Vehicle[] => {
  return vehicles.filter(isMySoldVehicle);
};

export const getOtherSoldVehicles = (vehicles: Vehicle[]): Vehicle[] => {
  return vehicles.filter(isOtherSoldVehicle);
};

export const getOutOfStockVehicles = (vehicles: Vehicle[]): Vehicle[] => {
  return vehicles.filter(isOutOfStockVehicle);
};

export interface StockCounts {
  activo: number;
  disponible: number;
  reservado: number;
  misVentas: number;
  ventasOtros: number;
  fueraStock: number;
  todos: number;
}

/**
 * Calcula de forma unificada los conteos para las pestañas comerciales
 */
export const calculateStockCounts = (vehicles: Vehicle[]): StockCounts => {
  let activo = 0;
  let disponible = 0;
  let reservado = 0;
  let misVentas = 0;
  let ventasOtros = 0;
  let fueraStock = 0;

  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    if (isOutOfStockVehicle(v)) {
      fueraStock++;
    } else {
      const st = normalizeCommercialStatus(v.estado);
      if (st === 'Disponible') {
        disponible++;
        activo++;
      } else if (st === 'Reservado') {
        reservado++;
        activo++;
      } else if (st === 'Vendido') {
        if (v.saleOwner === 'self') {
          misVentas++;
        } else {
          ventasOtros++;
        }
      }
    }
  }

  return {
    activo,
    disponible,
    reservado,
    misVentas,
    ventasOtros,
    fueraStock,
    todos: vehicles.length,
  };
};

/**
 * Cuenta ÚNICAMENTE los filtros avanzados activos (excluyendo estadoComercial y búsqueda general)
 * para el badge del botón "Filtros".
 */
export const countActiveAdvancedFilters = (filters: StockFilters): number => {
  let count = 0;
  if (filters.marca) count++;
  if (filters.modelo) count++;
  if (filters.anioMin !== '') count++;
  if (filters.anioMax !== '') count++;
  if (filters.kmMin !== '') count++;
  if (filters.kmMax !== '') count++;
  if (filters.precioMin !== '') count++;
  if (filters.precioMax !== '') count++;
  if (filters.combustible) count++;
  if (filters.caja) count++;
  if (filters.traccion) count++;
  if (filters.ubicacion) count++;
  if (filters.empresa) count++;
  if (filters.fotosAutonet && filters.fotosAutonet !== 'todas') count++;
  return count;
};

/**
 * Filtra los vehículos mediante la cadena unificada y determinística:
 * allVehicles -> commercialView -> advancedFilters -> search
 */
export const applyStockFilters = (
  vehicles: Vehicle[],
  filters: StockFilters
): Vehicle[] => {
  const normView = normalizeCommercialView(filters.estadoComercial);

  return vehicles.filter((v) => {
    // 1. FILTRO COMERCIAL (Pestaña activa) - REGLA DETERMINÍSTICA ESTRICTA
    switch (normView) {
      case 'active':
        if (!isActiveVehicle(v)) return false;
        break;
      case 'available':
        if (!isAvailableVehicle(v)) return false;
        break;
      case 'reserved':
        if (!isReservedVehicle(v)) return false;
        break;
      case 'sold-self':
        if (!isMySoldVehicle(v)) return false;
        break;
      case 'sold-other':
        if (!isOtherSoldVehicle(v)) return false;
        break;
      case 'historical':
        if (!isOutOfStockVehicle(v)) return false;
        break;
      case 'all':
        // No restringe por estado comercial
        break;
      default:
        if (!isActiveVehicle(v)) return false;
    }

    // 2. BÚSQUEDA GENERAL (Patente, marca, modelo, versión, color)
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      const searchTarget = `${v.patente} ${v.marca} ${v.modelo} ${v.version} ${v.anio} ${v.color}`.toLowerCase();
      const cleanPatente = v.patente.replace(/\s+/g, '').toLowerCase();
      const cleanQuery = q.replace(/\s+/g, '');
      if (!searchTarget.includes(q) && !cleanPatente.includes(cleanQuery)) {
        return false;
      }
    }

    // 3. FILTROS AVANZADOS
    if (filters.marca && v.marca !== filters.marca) return false;
    if (filters.modelo && v.modelo !== filters.modelo) return false;

    // Rango de año
    if (filters.anioMin !== '' && v.anio < filters.anioMin) return false;
    if (filters.anioMax !== '' && v.anio > filters.anioMax) return false;

    // Rango de kilometraje
    const km = normalizeMileage(v.kilometraje);
    const minKm = normalizeMileage(filters.kmMin);
    const maxKm = normalizeMileage(filters.kmMax);
    if (minKm !== null && (km === null || km < minKm)) return false;
    if (maxKm !== null && (km === null || km > maxKm)) return false;

    // Rango de precio
    if (filters.precioMin !== '' && v.precio < filters.precioMin) return false;
    if (filters.precioMax !== '' && v.precio > filters.precioMax) return false;

    // Combustible
    if (filters.combustible && v.combustible !== filters.combustible) return false;

    // Caja / Transmisión
    if (filters.caja && v.caja !== filters.caja) return false;

    // Tracción
    if (filters.traccion && v.traccion !== filters.traccion) return false;

    // Situación operativa / Ubicación (Ub)
    if (filters.ubicacion) {
      const vUb = (v.ubCode || v.ubicacion || '').trim().toUpperCase();
      if (vUb !== filters.ubicacion.trim().toUpperCase()) return false;
    }

    // Empresa
    if (filters.empresa) {
      const vEmp = (v.empresa || '').trim().toUpperCase();
      if (vEmp !== filters.empresa.trim().toUpperCase()) return false;
    }

    // Fotos web Autonet
    if (filters.fotosAutonet === 'con_fotos' && (!v.fotos || v.fotos.length === 0)) return false;
    if (filters.fotosAutonet === 'sin_fotos' && v.fotos && v.fotos.length > 0) return false;

    return true;
  });
};

/**
 * Validación de seguridad en runtime para garantizar que cuando se selecciona
 * una vista comercial (ej: 'reserved'), no haya ninguna unidad discrepante.
 */
export const validateVisibleVehiclesIntegrity = (
  commercialView: string | undefined,
  visibleVehicles: Vehicle[]
): void => {
  const norm = normalizeCommercialView(commercialView);
  if (norm === 'reserved') {
    const invalid = visibleVehicles.filter((v) => !isReservedVehicle(v));
    if (invalid.length > 0) {
      console.error(
        `[AUTONET-FILTERS-INTEGRITY-ERROR] Vista Reservados contiene ${invalid.length} unidades que no son Reservadas:`,
        invalid
      );
    }
  } else if (norm === 'available') {
    const invalid = visibleVehicles.filter((v) => !isAvailableVehicle(v));
    if (invalid.length > 0) {
      console.error(
        `[AUTONET-FILTERS-INTEGRITY-ERROR] Vista Disponibles contiene ${invalid.length} unidades que no son Disponibles:`,
        invalid
      );
    }
  }
};
