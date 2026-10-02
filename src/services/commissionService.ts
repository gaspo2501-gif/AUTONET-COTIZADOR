import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Vehicle } from '../types/stock';
import { 
  CommissionIvaRate, 
  CommissionConceptKey, 
  CommissionLevel, 
  ConceptTierProgress,
  MonthlyCommissionSummary,
  SimulationDeltas,
  SimulationResult
} from '../types/commissions';
import { sanitizeForFirestore } from '../utils/firestoreSanitizer';

export const COMMISSION_TIERS = {
  volumen: { n1: 10, n2: 15, n3: 18, label: 'Volumen de Ventas' },
  criticos: { n1: 3, n2: 4, n3: 5, label: 'Mix / Críticos' },
  credinet: { n1: 3, n2: 4, n3: 5, label: 'Credinet / Wunder' },
  tomas: { n1: 3, n2: 4, n3: 5, label: 'Tomas de Usado' },
} as const;

export const TIER_FACTORS: Record<CommissionLevel, number> = {
  0: 0,
  1: 0.24,
  2: 0.40,
  3: 0.80,
};

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Calcula la comisión base por vehículo vendido (1% sobre el neto sin IVA).
 * COMISIÓN BASE = (Precio real de venta / (1 + IVA)) × 1%
 */
export function calculateBaseCommission(precioRealVenta: number, ivaVenta: CommissionIvaRate): number {
  if (!precioRealVenta || precioRealVenta <= 0) return 0;
  const divisor = 1 + (ivaVenta / 100);
  const neto = precioRealVenta / divisor;
  return neto * 0.01;
}

/**
 * Calcula la comisión por toma de usado (0,5% sobre el neto de toma sin IVA).
 * COMISIÓN TOMA = (Valor de toma / (1 + IVA toma)) × 0,5%
 */
export function calculateTradeInCommission(valorToma: number, ivaToma: CommissionIvaRate): number {
  if (!valorToma || valorToma <= 0) return 0;
  const divisor = 1 + (ivaToma / 100);
  const neto = valorToma / divisor;
  return neto * 0.005;
}

/**
 * Determina el nivel, progreso y premios para un concepto específico.
 */
export function calculateConceptProgress(
  conceptKey: CommissionConceptKey,
  currentCount: number,
  baseCommissionTotal: number
): ConceptTierProgress {
  const tierConfig = COMMISSION_TIERS[conceptKey];
  const poolAmount = baseCommissionTotal * 0.25;

  let currentLevel: CommissionLevel = 0;
  let nextLevel: CommissionLevel | null = 1;
  let nextTargetCount: number | null = tierConfig.n1;

  if (currentCount >= tierConfig.n3) {
    currentLevel = 3;
    nextLevel = null;
    nextTargetCount = null;
  } else if (currentCount >= tierConfig.n2) {
    currentLevel = 2;
    nextLevel = 3;
    nextTargetCount = tierConfig.n3;
  } else if (currentCount >= tierConfig.n1) {
    currentLevel = 1;
    nextLevel = 2;
    nextTargetCount = tierConfig.n2;
  } else {
    currentLevel = 0;
    nextLevel = 1;
    nextTargetCount = tierConfig.n1;
  }

  const currentPrize = poolAmount * TIER_FACTORS[currentLevel];
  const nextPrize = nextLevel !== null ? poolAmount * TIER_FACTORS[nextLevel] : currentPrize;
  const missingCount = nextTargetCount !== null ? Math.max(0, nextTargetCount - currentCount) : 0;
  const prizeDifference = Math.max(0, nextPrize - currentPrize);

  return {
    conceptKey,
    label: tierConfig.label,
    currentCount,
    currentLevel,
    currentPrize,
    nextLevel,
    nextTargetCount,
    missingCount,
    nextPrize,
    prizeDifference,
    poolAmount,
  };
}

/**
 * Comprueba si la fecha de venta de un vehículo coincide con el año y mes solicitados.
 * Utiliza EXCLUSIVAMENTE vehicle.soldAt. Si no existe o está vacío, no se asigna a ningún mes.
 */
export function isVehicleSoldInPeriod(vehicle: Vehicle, year: number, month: number): boolean {
  if (vehicle.estado !== 'Vendido' || vehicle.saleOwner !== 'self') return false;
  if (!vehicle.soldAt || typeof vehicle.soldAt !== 'string' || !vehicle.soldAt.trim()) {
    return false;
  }

  // Formato esperado: YYYY-MM-DD o ISO string
  const clean = vehicle.soldAt.trim().slice(0, 7); // 'YYYY-MM'
  const target = `${year}-${String(month).padStart(2, '0')}`;
  return clean === target;
}

/**
 * Comprueba si la fecha de facturación de un vehículo coincide con el año y mes solicitados.
 * 1. Requiere que sea una venta propia (estado === 'Vendido' y saleOwner === 'self').
 * 2. Requiere fechaFacturacion válida (no vacía).
 * 3. Compara exclusivamente 'YYYY-MM'.
 * 4. Ignora soldAt para el conteo de volumen.
 */
export function isVehicleInvoicedInPeriod(vehicle: Vehicle, year: number, month: number): boolean {
  if (vehicle.estado !== 'Vendido' || vehicle.saleOwner !== 'self') return false;
  if (!vehicle.fechaFacturacion || typeof vehicle.fechaFacturacion !== 'string' || !vehicle.fechaFacturacion.trim()) {
    return false;
  }
  const clean = vehicle.fechaFacturacion.trim().slice(0, 7); // 'YYYY-MM'
  const target = `${year}-${String(month).padStart(2, '0')}`;
  return clean === target;
}

/**
 * Identifica si una venta propia carece de fecha de facturación (está pendiente de facturar).
 */
export function isVehiclePendingInvoice(vehicle: Vehicle): boolean {
  if (vehicle.estado !== 'Vendido' || vehicle.saleOwner !== 'self') return false;
  return !vehicle.fechaFacturacion || typeof vehicle.fechaFacturacion !== 'string' || !vehicle.fechaFacturacion.trim();
}

/**
 * Identifica si una venta propia carece de fecha real de venta registrada.
 */
export function hasPendingSaleDate(vehicle: Vehicle): boolean {
  if (vehicle.estado !== 'Vendido' || vehicle.saleOwner !== 'self') return false;
  return !vehicle.soldAt || typeof vehicle.soldAt !== 'string' || !vehicle.soldAt.trim();
}

/**
 * Valida de forma estricta el estado de los datos históricos de una operación.
 * NO asume 21% si falta IVA. NO calcula $0 silenciosamente.
 */
export function checkSaleCommissionStatus(v: Vehicle): {
  isBaseComplete: boolean;
  baseMissingReason?: string;
  isTradeInComplete: boolean;
  tradeInMissingReason?: string;
  hasPendingDate: boolean;
} {
  const hasPendingDate = !v.soldAt || typeof v.soldAt !== 'string' || !v.soldAt.trim();

  // 1. Validación de Comisión Base
  const hasExplicitIva = v.ivaVenta === 21 || v.ivaVenta === 10.5;
  const hasValidPrecio = typeof v.precioRealVenta === 'number' && v.precioRealVenta > 0;
  const hasValidCalculated = typeof v.comisionBaseCalculada === 'number' && v.comisionBaseCalculada > 0;

  let isBaseComplete = false;
  let baseMissingReason: string | undefined;

  if (hasValidPrecio && hasExplicitIva) {
    isBaseComplete = true;
  } else if (hasValidCalculated && hasExplicitIva) {
    isBaseComplete = true;
  } else {
    isBaseComplete = false;
    if (!hasValidPrecio && !hasExplicitIva) {
      baseMissingReason = 'Faltan precio real de venta e IVA de la operación';
    } else if (!hasValidPrecio) {
      baseMissingReason = 'Falta precio real de venta';
    } else if (!hasExplicitIva) {
      baseMissingReason = 'Falta IVA de la operación';
    }
  }

  // 2. Validación de Comisión por Toma de Usado
  let isTradeInComplete = true;
  let tradeInMissingReason: string | undefined;

  if (v.tieneTomaUsado) {
    const hasValidTradeInValor = typeof v.valorTomaUsado === 'number' && v.valorTomaUsado > 0;
    const hasExplicitTradeInIva = v.ivaTomaUsado === 21 || v.ivaTomaUsado === 10.5;
    const hasValidCalculatedTradeIn = typeof v.comisionTomaCalculada === 'number' && v.comisionTomaCalculada > 0;

    if (hasValidTradeInValor && hasExplicitTradeInIva) {
      isTradeInComplete = true;
    } else if (hasValidCalculatedTradeIn && hasExplicitTradeInIva) {
      isTradeInComplete = true;
    } else {
      isTradeInComplete = false;
      if (!hasValidTradeInValor && !hasExplicitTradeInIva) {
        tradeInMissingReason = 'Faltan valor de toma e IVA del usado';
      } else if (!hasValidTradeInValor) {
        tradeInMissingReason = 'Falta valor de toma del usado';
      } else if (!hasExplicitTradeInIva) {
        tradeInMissingReason = 'Falta IVA del usado tomado';
      }
    }
  }

  return {
    isBaseComplete,
    baseMissingReason,
    isTradeInComplete,
    tradeInMissingReason,
    hasPendingDate,
  };
}

/**
 * Calcula el resumen mensual completo para el período seleccionado.
 * 
 * REGLA DEFINITIVA:
 * 1. soldAt determina:
 *    - Cantidad de operaciones de venta del mes (salesCount y volumenCount)
 *    - Nivel Volumen (meta 10 / 15 / 18)
 *    - Nivel Críticos (meta 3 / 4 / 5)
 *    - Nivel Credinet (meta 3 / 4 / 5)
 *    - Nivel Tomas (meta 3 / 4 / 5)
 * 
 * 2. fechaFacturacion determina:
 *    - Qué operaciones integran económicamente la liquidación de este mes
 *    - En qué mes se cobra la Comisión Base del 1% (baseCommissionTotal)
 *    - En qué mes se cobra la Comisión Adicional del 0,5% por toma (tradeInCommissionTotal)
 * 
 * 3. Base económica de todos los premios:
 *    - poolAmount = baseCommissionTotal * 0.25 (Comisión Base Facturada del mes)
 *    - premio = poolAmount * factorNivel
 */
export function calculateMonthlyCommissionSummary(
  vehicles: Vehicle[],
  year: number,
  month: number,
  _legacyFacturadasCount?: number
): MonthlyCommissionSummary {
  // A. Operaciones vendidas en el mes (soldAt) -> Determinan los niveles y objetivos comerciales
  const soldVehicles = vehicles.filter((v) => isVehicleSoldInPeriod(v, year, month));
  const salesCount = soldVehicles.length;
  const volumenCount = soldVehicles.length;
  const criticosCount = soldVehicles.filter((v) => !!v.esCritico).length;
  const credinetCount = soldVehicles.filter((v) => !!v.usaCredinet).length;
  const tomasCount = soldVehicles.filter((v) => !!v.tieneTomaUsado).length;

  // B. Operaciones facturadas en el mes (fechaFacturacion) -> Determinan la base económica y liquidación
  const invoicedVehicles = vehicles.filter((v) => isVehicleInvoicedInPeriod(v, year, month));
  const facturadasCount = invoicedVehicles.length;

  // Ventas del asesor con fecha de venta pendiente (global)
  const pendingDateCount = vehicles.filter(hasPendingSaleDate).length;

  // Ventas propias con facturación pendiente (global)
  const pendingInvoiceVehicles = vehicles.filter(isVehiclePendingInvoice);
  const pendingInvoiceCount = pendingInvoiceVehicles.length;

  let baseCommissionTotal = 0;
  let tradeInCommissionTotal = 0;
  let missingBaseCount = 0;
  let missingTradeInCount = 0;

  // La liquidación económica (Comisión Base 1% y Adicional por Toma 0,5%) se nutre de las operaciones FACTURADAS en el mes
  invoicedVehicles.forEach((v) => {
    const status = checkSaleCommissionStatus(v);

    // Comisión Base: SOLO se suma si posee datos completos y confirmados
    if (status.isBaseComplete) {
      if (typeof v.comisionBaseCalculada === 'number' && v.comisionBaseCalculada > 0) {
        baseCommissionTotal += v.comisionBaseCalculada;
      } else if (typeof v.precioRealVenta === 'number' && v.precioRealVenta > 0 && (v.ivaVenta === 21 || v.ivaVenta === 10.5)) {
        baseCommissionTotal += calculateBaseCommission(v.precioRealVenta, v.ivaVenta);
      }
    } else {
      missingBaseCount += 1;
    }

    // Toma de Usado: Se liquida en el mes en que la operación fue facturada
    if (v.tieneTomaUsado) {
      if (status.isTradeInComplete) {
        if (typeof v.comisionTomaCalculada === 'number' && v.comisionTomaCalculada > 0) {
          tradeInCommissionTotal += v.comisionTomaCalculada;
        } else if (typeof v.valorTomaUsado === 'number' && v.valorTomaUsado > 0 && (v.ivaTomaUsado === 21 || v.ivaTomaUsado === 10.5)) {
          tradeInCommissionTotal += calculateTradeInCommission(v.valorTomaUsado, v.ivaTomaUsado);
        }
      } else {
        missingTradeInCount += 1;
      }
    }
  });

  // Los 4 premios se calculan utilizando el pool del 25% de la Comisión Base Facturada del mes
  const progressVolumen = calculateConceptProgress('volumen', volumenCount, baseCommissionTotal);
  const progressCriticos = calculateConceptProgress('criticos', criticosCount, baseCommissionTotal);
  const progressCredinet = calculateConceptProgress('credinet', credinetCount, baseCommissionTotal);
  const progressTomas = calculateConceptProgress('tomas', tomasCount, baseCommissionTotal);

  const totalPrizes = progressVolumen.currentPrize + progressCriticos.currentPrize + progressCredinet.currentPrize + progressTomas.currentPrize;
  const totalGrossEstimated = baseCommissionTotal + totalPrizes + tradeInCommissionTotal;

  // Advertencia de TOTAL PARCIAL si hay datos incompletos en el mes o ventas con fecha pendiente
  const isPartialTotal = missingBaseCount > 0 || missingTradeInCount > 0 || pendingDateCount > 0;

  return {
    year,
    month,
    monthLabel: `${MONTH_NAMES[month - 1].toUpperCase()} ${year}`,
    salesCount,
    volumenCount,
    baseCommissionTotal,
    tradeInCommissionTotal,
    facturadasCount,
    criticosCount,
    credinetCount,
    tomasCount,
    volumePrize: progressVolumen.currentPrize,
    criticosPrize: progressCriticos.currentPrize,
    credinetPrize: progressCredinet.currentPrize,
    tomasPrize: progressTomas.currentPrize,
    totalPrizes,
    totalGrossEstimated,
    conceptProgress: {
      volumen: progressVolumen,
      criticos: progressCriticos,
      credinet: progressCredinet,
      tomas: progressTomas,
    },
    missingDataCount: missingBaseCount,
    missingBaseCount,
    missingTradeInCount,
    pendingDateCount,
    isPartialTotal,
    invoicedVehicles,
    soldVehicles,
    pendingInvoiceCount,
    pendingInvoiceVehicles,
  };
}

/**
 * Simula el impacto económico al variar temporalmente los contadores.
 */
export function calculateSimulatedSummary(
  baseSummary: MonthlyCommissionSummary,
  deltas: SimulationDeltas
): SimulationResult {
  const volDelta = deltas.volumenDelta ?? deltas.facturadasDelta ?? 0;
  const simVolumen = Math.max(0, baseSummary.volumenCount + volDelta);
  const simCriticos = Math.max(0, baseSummary.criticosCount + deltas.criticosDelta);
  const simCredinet = Math.max(0, baseSummary.credinetCount + deltas.credinetDelta);
  const simTomas = Math.max(0, baseSummary.tomasCount + deltas.tomasDelta);

  const progVolumen = calculateConceptProgress('volumen', simVolumen, baseSummary.baseCommissionTotal);
  const progCriticos = calculateConceptProgress('criticos', simCriticos, baseSummary.baseCommissionTotal);
  const progCredinet = calculateConceptProgress('credinet', simCredinet, baseSummary.baseCommissionTotal);
  const progTomas = calculateConceptProgress('tomas', simTomas, baseSummary.baseCommissionTotal);

  const totalSimPrizes = progVolumen.currentPrize + progCriticos.currentPrize + progCredinet.currentPrize + progTomas.currentPrize;
  const simulatedGross = baseSummary.baseCommissionTotal + totalSimPrizes + baseSummary.tradeInCommissionTotal;
  const difference = simulatedGross - baseSummary.totalGrossEstimated;

  return {
    simulatedGross,
    difference,
    simulatedPrizes: {
      volumen: progVolumen.currentPrize,
      criticos: progCriticos.currentPrize,
      credinet: progCredinet.currentPrize,
      tomas: progTomas.currentPrize,
      total: totalSimPrizes,
    },
    simulatedProgress: {
      volumen: progVolumen,
      criticos: progCriticos,
      credinet: progCredinet,
      tomas: progTomas,
    },
  };
}

class CommissionService {
  private getStorageKey(userId: string | null | undefined, year: number, month: number): string {
    const userPart = userId || 'local_user';
    return `autonet_commission_settings_${userPart}_${year}_${String(month).padStart(2, '0')}`;
  }

  /**
   * Obtiene la cantidad de unidades facturadas para un mes específico.
   */
  public async getMonthlyFacturadas(year: number, month: number, userId?: string | null): Promise<number> {
    const key = this.getStorageKey(userId, year, month);

    // 1. Lectura inmediata de cache local
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem(key);
        if (local !== null) {
          const parsed = JSON.parse(local);
          if (typeof parsed.facturadas === 'number') {
            return parsed.facturadas;
          }
        }
      } catch {
        // fallback
      }
    }

    // 2. Lectura de Firestore si está autenticado
    if (isFirebaseConfigured && db && userId) {
      try {
        const monthDocId = `${year}-${String(month).padStart(2, '0')}`;
        const docRef = doc(db, 'users', userId, 'commission_settings', monthDocId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          const facturadas = Number(data.facturadas) || 0;
          if (typeof window !== 'undefined') {
            localStorage.setItem(key, JSON.stringify({ facturadas, updatedAt: data.updatedAt }));
          }
          return facturadas;
        }
      } catch (err) {
        console.warn('[CommissionService] Error al obtener settings de Firestore:', err);
      }
    }

    return 0;
  }

  /**
   * Guarda las unidades facturadas del mes tanto en Firestore como en localStorage.
   */
  public async saveMonthlyFacturadas(
    year: number, 
    month: number, 
    facturadas: number, 
    userId?: string | null
  ): Promise<void> {
    const safeFacturadas = Math.max(0, Math.round(Number(facturadas) || 0));
    const key = this.getStorageKey(userId, year, month);
    const nowIso = new Date().toISOString();

    // 1. Guardado en cache local
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify({
          year,
          month,
          facturadas: safeFacturadas,
          updatedAt: nowIso,
        }));
      } catch {
        // ignore
      }
    }

    // 2. Persistencia en Cloud Firestore
    if (isFirebaseConfigured && db && userId) {
      try {
        const monthDocId = `${year}-${String(month).padStart(2, '0')}`;
        const docRef = doc(db, 'users', userId, 'commission_settings', monthDocId);
        await setDoc(docRef, sanitizeForFirestore({
          year,
          month,
          facturadas: safeFacturadas,
          updatedAt: nowIso,
        }), { merge: true });
      } catch (err) {
        console.error('[CommissionService] Error al guardar en Firestore:', err);
      }
    }
  }
}

export const commissionService = new CommissionService();
