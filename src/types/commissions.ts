import { Vehicle } from './stock';

export type CommissionIvaRate = 21 | 10.5;

export type CommissionConceptKey = 'volumen' | 'criticos' | 'credinet' | 'tomas';

export type CommissionLevel = 0 | 1 | 2 | 3;

export interface ConceptTierProgress {
  conceptKey: CommissionConceptKey;
  label: string;
  currentCount: number;
  currentLevel: CommissionLevel;
  currentPrize: number;
  nextLevel: CommissionLevel | null;
  nextTargetCount: number | null;
  missingCount: number;
  nextPrize: number;
  prizeDifference: number;
  poolAmount: number;
}

export interface MonthlyCommissionSummary {
  year: number;
  month: number; // 1 - 12
  monthLabel: string;
  salesCount: number;
  volumenCount: number;
  baseCommissionTotal: number;
  tradeInCommissionTotal: number;
  facturadasCount: number;
  criticosCount: number;
  credinetCount: number;
  tomasCount: number;
  volumePrize: number;
  criticosPrize: number;
  credinetPrize: number;
  tomasPrize: number;
  totalPrizes: number;
  totalGrossEstimated: number;
  conceptProgress: Record<CommissionConceptKey, ConceptTierProgress>;
  missingDataCount: number;
  missingBaseCount: number;
  missingTradeInCount: number;
  pendingDateCount: number;
  isPartialTotal: boolean;
  invoicedVehicles: Vehicle[];
  soldVehicles: Vehicle[];
  pendingInvoiceCount: number;
  pendingInvoiceVehicles: Vehicle[];
}

export interface MonthlyCommissionSettings {
  year: number;
  month: number;
  facturadas: number;
  updatedAt?: string;
}

export interface SimulationDeltas {
  volumenDelta?: number;
  facturadasDelta: number;
  criticosDelta: number;
  credinetDelta: number;
  tomasDelta: number;
}

export interface SimulationResult {
  simulatedGross: number;
  difference: number;
  simulatedPrizes: {
    volumen: number;
    criticos: number;
    credinet: number;
    tomas: number;
    total: number;
  };
  simulatedProgress: Record<CommissionConceptKey, ConceptTierProgress>;
}
