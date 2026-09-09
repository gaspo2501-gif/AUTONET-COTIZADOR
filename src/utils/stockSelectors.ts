import { CommercialFilter, StockFilters, Vehicle, VehicleStatus } from '../types/stock';
import { normalizeMileage } from './formatters';

/**
 * SELECTORES CENTRALIZADOS DE STOCK — AUTONET
 * 
 * ÚNICA FUENTE DE VERDAD para clasificar, contar y filtrar vehículos en la aplicación.
 * Garantiza total coherencia entre contadores, pestañas, grilla de tarjetas y tabla.
 */

export const isHistoricalVehicle = (v: Vehicle): boolean => {
  return Boolean(v.isHistorical || v.estado === 'fuera_de_stock');
};

export const isActiveVehicle = (v: Vehicle): boolean => {
  if (isHistoricalVehicle(v)) return false;
  return v.estado === 'Disponible' || v.estado === 'Reservado';
};

export const isAvailableVehicle = (v: Vehicle): boolean => {
  if (isHistoricalVehicle(v)) return false;
  return v.estado === 'Disponible';
};

export const isReservedVehicle = (v: Vehicle): boolean => {
  if (isHistoricalVehicle(v)) return false;
  return v.estado === 'Reservado';
};

export const isMySoldVehicle = (v: Vehicle): boolean => {
  return v.estado === 'Vendido' && v.saleOwner === 'self';
};

export const isOtherSoldVehicle = (v: Vehicle): boolean => {
  return v.estado === 'Vendido' && v.saleOwner === 'other';
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
      if (v.estado === 'Disponible') {
        disponible++;
        activo++;
      } else if (v.estado === 'Reservado') {
        reservado++;
        activo++;
      } else if (v.estado === 'Vendido') {
        if (v.saleOwner === 'self') {
          misVentas++;
        } else if (v.saleOwner === 'other') {
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
 * Filtra los vehículos mediante la cadena estricta:
 * allVehicles -> commercialView -> advancedFilters -> search
 */
export const applyStockFilters = (
  vehicles: Vehicle[],
  filters: StockFilters
): Vehicle[] => {
  const commercial = filters.estadoComercial || 'activo';

  return vehicles.filter((v) => {
    // 1. FILTRO COMERCIAL (Pestaña activa)
    switch (commercial) {
      case 'activo':
        if (!isActiveVehicle(v)) return false;
        break;
      case 'Disponible':
        if (!isAvailableVehicle(v)) return false;
        break;
      case 'Reservado':
        if (!isReservedVehicle(v)) return false;
        break;
      case 'vendidas_propias':
        if (!isMySoldVehicle(v)) return false;
        break;
      case 'vendidas_otros':
        if (!isOtherSoldVehicle(v)) return false;
        break;
      case 'fuera_de_stock':
        if (!isOutOfStockVehicle(v)) return false;
        break;
      case 'todos':
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
 * Validación de seguridad en runtime para detectar regresiones (Requisito 30)
 */
export const validateVisibleVehiclesIntegrity = (
  commercialView: CommercialFilter,
  visibleVehicles: Vehicle[]
): void => {
  if (commercialView === 'Reservado') {
    const invalid = visibleVehicles.filter((v) => v.estado !== 'Reservado' || v.isHistorical);
    if (invalid.length > 0) {
      console.error(
        `[AUTONET-FILTERS-INTEGRITY-ERROR] Vista Reservados contiene ${invalid.length} unidades que no son Reservadas o son históricas:`,
        invalid
      );
    }
  } else if (commercialView === 'Disponible') {
    const invalid = visibleVehicles.filter((v) => v.estado !== 'Disponible' || v.isHistorical);
    if (invalid.length > 0) {
      console.error(
        `[AUTONET-FILTERS-INTEGRITY-ERROR] Vista Disponibles contiene ${invalid.length} unidades que no son Disponibles:`,
        invalid
      );
    }
  }
};
