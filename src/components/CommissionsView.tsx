import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Award, 
  ChevronLeft, 
  ChevronRight, 
  Sliders, 
  AlertTriangle, 
  Car, 
  CheckCircle2, 
  RotateCcw, 
  Flame, 
  CreditCard, 
  CarFront, 
  Percent,
  Sparkles,
  HelpCircle,
  FileCheck,
  Edit2,
  Calendar,
  Layers,
  ArrowRight,
  Clock,
  Eye,
  X
} from 'lucide-react';
import { Vehicle } from '../types/stock';
import { User } from 'firebase/auth';
import { formatCurrency } from '../utils/formatters';

function formatDateDMY(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}
import { 
  COMMISSION_TIERS,
  MONTH_NAMES,
  calculateMonthlyCommissionSummary,
  calculateSimulatedSummary,
  calculateBaseCommission,
  calculateTradeInCommission,
  checkSaleCommissionStatus,
  hasPendingSaleDate,
  isVehicleSoldInPeriod,
  commissionService
} from '../services/commissionService';
import { 
  CommissionConceptKey, 
  SimulationDeltas,
  ConceptTierProgress
} from '../types/commissions';

interface CommissionsViewProps {
  vehicles: Vehicle[];
  currentUser?: User | null;
  onOpenMarkAsSold: (vehicle: Vehicle) => void;
  onNavigateToSales: () => void;
}

export const CommissionsView: React.FC<CommissionsViewProps> = ({
  vehicles,
  currentUser,
  onOpenMarkAsSold,
  onNavigateToSales,
}) => {
  // Inicializar en el mes más reciente con ventas o en la fecha actual
  const initialPeriod = useMemo(() => {
    const mySales = vehicles.filter((v) => v.estado === 'Vendido' && v.saleOwner === 'self' && v.soldAt);
    if (mySales.length > 0) {
      // Ordenar descendente para tomar la fecha más reciente
      const sorted = [...mySales].sort((a, b) => (b.soldAt || '').localeCompare(a.soldAt || ''));
      const mostRecent = sorted[0].soldAt || '';
      const parts = mostRecent.slice(0, 7).split('-');
      if (parts.length === 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
          return { year: y, month: m };
        }
      }
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, [vehicles]);

  const [selectedYear, setSelectedYear] = useState<number>(initialPeriod.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialPeriod.month);

  // Modales de visualización de facturadas, vendidas y pendientes
  const [showInvoicedModal, setShowInvoicedModal] = useState<boolean>(false);
  const [showPendingInvoiceModal, setShowPendingInvoiceModal] = useState<boolean>(false);
  const [showSoldModal, setShowSoldModal] = useState<boolean>(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'invoiced' | 'sold'>('invoiced');

  // Estados del simulador
  const [simulationDeltas, setSimulationDeltas] = useState<SimulationDeltas>({
    facturadasDelta: 0,
    criticosDelta: 0,
    credinetDelta: 0,
    tomasDelta: 0,
  });

  // Navegación de meses
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((prev) => prev - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
    resetSimulation();
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((prev) => prev + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
    resetSimulation();
  };

  const resetSimulation = () => {
    setSimulationDeltas({
      facturadasDelta: 0,
      criticosDelta: 0,
      credinetDelta: 0,
      tomasDelta: 0,
    });
  };

  // Resumen real del mes (calcula automáticamente facturadasCount usando fechaFacturacion de las operaciones)
  const summary = useMemo(() => {
    return calculateMonthlyCommissionSummary(vehicles, selectedYear, selectedMonth);
  }, [vehicles, selectedYear, selectedMonth]);

  // Resumen simulado
  const simulation = useMemo(() => {
    return calculateSimulatedSummary(summary, simulationDeltas);
  }, [summary, simulationDeltas]);

  const isSimulating = 
    simulationDeltas.facturadasDelta !== 0 ||
    simulationDeltas.criticosDelta !== 0 ||
    simulationDeltas.credinetDelta !== 0 ||
    simulationDeltas.tomasDelta !== 0;

  // Operaciones facturadas en el mes (integran la liquidación económica)
  const invoicedOperations = useMemo(() => {
    return [...summary.invoicedVehicles].sort((a, b) => (b.fechaFacturacion || '').localeCompare(a.fechaFacturacion || ''));
  }, [summary.invoicedVehicles]);

  // Operaciones vendidas en el mes (determinan los niveles y metas)
  const soldOperations = useMemo(() => {
    return [...summary.soldVehicles].sort((a, b) => (b.soldAt || '').localeCompare(a.soldAt || ''));
  }, [summary.soldVehicles]);

  // Ventas propias con fecha de venta pendiente (global)
  const pendingDateSales = useMemo(() => {
    return vehicles.filter(hasPendingSaleDate);
  }, [vehicles]);

  const renderLevelBadge = (level: number) => {
    if (level === 3) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-100 text-amber-900 border border-amber-300">
          Nivel 3 (80%)
        </span>
      );
    }
    if (level === 2) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-indigo-100 text-indigo-900 border border-indigo-300">
          Nivel 2 (40%)
        </span>
      );
    }
    if (level === 1) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
          Nivel 1 (24%)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-500 border border-slate-200">
        Sin Nivel (0%)
      </span>
    );
  };

  const renderObjectiveCard = (
    prog: ConceptTierProgress,
    icon: React.ReactNode,
    unitName: string
  ) => {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between transition-all hover:border-slate-300">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
                {icon}
              </div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {prog.label}
              </h4>
            </div>
            {renderLevelBadge(prog.currentLevel)}
          </div>

          <div className="flex items-baseline justify-between mt-1 mb-2">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {prog.currentCount}{' '}
              <span className="text-xs font-semibold text-slate-500 font-sans">
                {unitName}
              </span>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400">Premio</div>
              <div className="text-sm sm:text-base font-extrabold text-emerald-700 font-mono">
                {formatCurrency(prog.currentPrize)}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 mt-2 text-xs">
          {prog.nextLevel !== null ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-slate-600 text-[11px]">
                <span>Faltan <strong className="text-slate-900 font-bold">{prog.missingCount}</strong> para Nivel {prog.nextLevel}</span>
                <span className="text-slate-400">Meta: {prog.nextTargetCount}</span>
              </div>
              {summary.baseCommissionTotal === 0 ? (
                <div className="flex items-center justify-center text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md text-center tracking-tight">
                  <span>SIN BASE FACTURADA PARA CALCULAR PREMIO</span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700 bg-blue-50/60 px-2 py-1 rounded-md">
                  <span>Si alcanzás Nivel {prog.nextLevel}:</span>
                  <span className="font-mono font-bold">+{formatCurrency(prog.prizeDifference)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-700 font-bold text-[11px] bg-amber-50 px-2 py-1.5 rounded-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>¡Nivel 3 alcanzado! Premio máximo obtenido.</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      
      {/* 1. SELECTOR DE MES Y PERÍODO COMERCIAL */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Módulo Comisiones
              </h1>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 uppercase tracking-wider">
                V1 Oficial
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Cálculo sobre ventas personales, objetivos por nivel y tomas de usados
            </p>
          </div>
        </div>

        {/* Controles de Navegación de Mes */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1 rounded-xl w-full sm:w-auto justify-between sm:justify-end">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
            title="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="px-3 py-1 font-mono font-black text-xs sm:text-sm text-slate-900 select-none text-center">
            {summary.monthLabel}
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
            title="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AVISO GLOBAL: VENTAS PROPIAS CON FECHA DE VENTA PENDIENTE */}
      {pendingDateSales.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-xs animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-sm text-amber-900 flex items-center gap-2">
                <span>{pendingDateSales.length} {pendingDateSales.length === 1 ? 'venta propia pendiente de fecha' : 'ventas propias pendientes de fecha'}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-200 text-amber-900 border border-amber-300">
                  FECHA DE VENTA PENDIENTE
                </span>
              </div>
              <p className="text-amber-800 text-xs mt-0.5">
                Las operaciones sin fecha real de venta no se asignan a ningún mes y quedan excluidas de la liquidación hasta registrar su fecha.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onOpenMarkAsSold(pendingDateSales[0])}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-2xs transition-colors w-full sm:w-auto text-center"
            >
              Asignar fecha de venta
            </button>
          </div>
        </div>
      )}

      {/* ADVERTENCIA DE VENTAS HISTÓRICAS CON DATOS INCOMPLETOS */}
      {(summary.missingBaseCount > 0 || summary.missingTradeInCount > 0) && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <strong className="text-amber-950">
                Hay {summary.missingBaseCount + summary.missingTradeInCount} operación(es) del mes con datos incompletos.
              </strong>
              <p className="text-amber-800 text-[11px] mt-0.5">
                {summary.missingBaseCount > 0 && `${summary.missingBaseCount} venta(s) con datos de comisión base incompletos (falta precio real o IVA). `}
                {summary.missingTradeInCount > 0 && `${summary.missingTradeInCount} toma(s) de usado con datos de toma incompletos (falta valor de toma o IVA). `}
                El total acumulado de este mes es un <strong>TOTAL PARCIAL</strong> hasta que se completen los datos faltantes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToSales}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer shadow-2xs"
          >
            Ver en Mis Ventas
          </button>
        </div>
      )}

      {/* 2. COMISIÓN BASE & RESUMEN OPERATIVO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tarjeta A: Comisión Base Mensual */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Base de Liquidación
                </span>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Comisión Base Mensual
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInvoicedModal(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs self-start sm:self-auto"
            >
              <FileCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>VER FACTURADAS ({summary.facturadasCount})</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pt-2">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-blue-700 font-mono tracking-tight">
                {formatCurrency(summary.baseCommissionTotal)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                1% neto sobre operaciones propias facturadas en {summary.monthLabel}. Constituye la base económica del pozo de premios.
              </p>
            </div>
            <div className="text-right sm:text-right text-xs text-slate-500 shrink-0">
              <div>Pozo por objetivo (25%):</div>
              <div className="font-mono font-bold text-slate-800 text-sm">
                {formatCurrency(summary.baseCommissionTotal * 0.25)}
              </div>
            </div>
          </div>
        </div>

        {/* Tarjeta B: RESUMEN OPERATIVO DEL MES */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Control Comercial
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                {summary.monthLabel}
              </span>
            </div>
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-tight">
              Resumen Operativo
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Balance mensual de operaciones cerradas y facturadas.
            </p>
          </div>

          <div className="my-3 space-y-2 py-2 border-y border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <span>Operaciones vendidas:</span>
              </span>
              <span className="font-mono font-black text-slate-900 text-sm">
                {summary.salesCount} <span className="text-[11px] font-medium text-slate-500 font-sans">vendidas</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                <span>Operaciones facturadas:</span>
              </span>
              <span className="font-mono font-black text-emerald-700 text-sm">
                {summary.facturadasCount} <span className="text-[11px] font-medium text-slate-500 font-sans">facturadas</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Pendientes de facturación:</span>
              </span>
              <span className="font-mono font-black text-amber-700 text-sm">
                {summary.pendingInvoiceCount} <span className="text-[11px] font-medium text-slate-500 font-sans">pendientes</span>
              </span>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowSoldModal(true)}
              className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <CarFront className="w-3.5 h-3.5 text-blue-400" />
              <span>VER VENTAS DEL MES ({summary.salesCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* BLOQUE INFORMATIVO: PENDIENTES DE FACTURACIÓN */}
      {summary.pendingInvoiceCount > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300">
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                <span>{summary.pendingInvoiceCount} {summary.pendingInvoiceCount === 1 ? 'operación vendida aún no facturada' : 'operaciones vendidas aún no facturadas'}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                  Pendientes de Facturación
                </span>
              </div>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Ventas registradas por vos que todavía no poseen fecha informada por Administración. No se computan para el volumen de ningún mes hasta que registres su fecha en Mis Ventas.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowPendingInvoiceModal(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs cursor-pointer shadow-2xs transition-colors w-full sm:w-auto text-center flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span>Ver pendientes ({summary.pendingInvoiceCount})</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. OBJETIVOS Y PREMIOS MENSUALES */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" />
            <span>Objetivos por Niveles (Premios)</span>
          </h3>
          <span className="text-xs font-mono font-bold text-emerald-700">
            Total Premios: {formatCurrency(summary.totalPrizes)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {renderObjectiveCard(summary.conceptProgress.volumen, <Layers className="w-4 h-4 text-blue-600" />, 'ventas')}
          {renderObjectiveCard(summary.conceptProgress.criticos, <Flame className="w-4 h-4 text-amber-600" />, 'críticos')}
          {renderObjectiveCard(summary.conceptProgress.credinet, <CreditCard className="w-4 h-4 text-indigo-600" />, 'operaciones')}
          {renderObjectiveCard(summary.conceptProgress.tomas, <CarFront className="w-4 h-4 text-teal-600" />, 'tomas')}
        </div>
      </div>

      {/* 4. RESUMEN ECONÓMICO & TOTAL BRUTO ESTIMADO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Desglose de Conceptos */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
            Desglose de Liquidación Comercial
          </h3>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <span>Comisión Base Mensual (1% sobre {summary.facturadasCount} unidades facturadas sin IVA)</span>
              </span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {formatCurrency(summary.baseCommissionTotal)}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>Premio Volumen ({summary.conceptProgress.volumen.currentLevel > 0 ? `Nivel ${summary.conceptProgress.volumen.currentLevel}` : 'Sin nivel'})</span>
              </span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {formatCurrency(summary.volumePrize)}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Premio Mix / Vehículos Críticos ({summary.conceptProgress.criticos.currentLevel > 0 ? `Nivel ${summary.conceptProgress.criticos.currentLevel}` : 'Sin nivel'})</span>
              </span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {formatCurrency(summary.criticosPrize)}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span>Premio Credinet / Wunder ({summary.conceptProgress.credinet.currentLevel > 0 ? `Nivel ${summary.conceptProgress.credinet.currentLevel}` : 'Sin nivel'})</span>
              </span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {formatCurrency(summary.credinetPrize)}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                <span>Premio Tomas de Usado ({summary.conceptProgress.tomas.currentLevel > 0 ? `Nivel ${summary.conceptProgress.tomas.currentLevel}` : 'Sin nivel'})</span>
              </span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {formatCurrency(summary.tomasPrize)}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="font-semibold text-teal-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                <span>Comisión por Tomas de Usado (0,5% neto sobre tomas facturadas)</span>
              </span>
              <span className="font-mono font-bold text-teal-800 text-sm">
                +{formatCurrency(summary.tradeInCommissionTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Tarjeta Destacada: TOTAL BRUTO ESTIMADO */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white rounded-xl p-5 shadow-lg border border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                Estimación Mensual
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono font-bold">
                {summary.facturadasCount} facturadas • {summary.volumenCount} ventas
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-xs uppercase font-extrabold tracking-wider text-slate-300">
                {summary.missingBaseCount > 0 || summary.missingTradeInCount > 0 ? (
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    TOTAL PARCIAL
                  </span>
                ) : (
                  'TOTAL BRUTO ESTIMADO'
                )}
              </div>
            </div>

            <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight mt-2 text-emerald-400">
              {formatCurrency(summary.totalGrossEstimated)}
            </div>

            {(summary.missingBaseCount > 0 || summary.missingTradeInCount > 0) && (
              <div className="mt-2 text-xs font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2.5 py-1.5 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Faltan datos de comisión o tomas en {summary.missingBaseCount + summary.missingTradeInCount} operación{summary.missingBaseCount + summary.missingTradeInCount === 1 ? '' : 'es'}
                </span>
              </div>
            )}

            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              Suma de comisión base facturada + premios por objetivos del mes + comisiones de usados tomados.
            </p>
          </div>

          {/* Sección Futuro Recibo de Sueldo */}
          <div className="mt-5 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-bold text-slate-300 uppercase tracking-wider">Neto Estimado</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Futuro</span>
            </div>
            <div className="text-[11px] text-slate-400 italic">
              Disponible cuando se configuren los descuentos del recibo de sueldo.
            </div>
          </div>
        </div>
      </div>

      {/* 5. SIMULADOR "¿QUÉ PASA SI...?" */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Simulador de Objetivos: &quot;¿Qué pasa si...?&quot;
              </h3>
              <p className="text-xs text-slate-500">
                Simulá el impacto en tus premios variando temporalmente las cantidades. No modifica datos reales.
              </p>
            </div>
          </div>

          {isSimulating && (
            <button
              type="button"
              onClick={resetSimulation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
          )}
        </div>

        {/* Controles de Simulación */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {/* A. Volumen (Ventas del mes) */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-700 mb-1 truncate">Volumen (Ventas)</div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSimulationDeltas((prev) => ({
                  ...prev,
                  facturadasDelta: prev.facturadasDelta - 1
                }))}
                className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-100 cursor-pointer flex items-center justify-center"
              >
                -
              </button>
              <div className="font-mono font-black text-sm text-slate-900">
                {Math.max(0, summary.volumenCount + simulationDeltas.facturadasDelta)}
              </div>
              <button
                type="button"
                onClick={() => setSimulationDeltas((prev) => ({
                  ...prev,
                  facturadasDelta: prev.facturadasDelta + 1
                }))}
                className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-100 cursor-pointer flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>

          {/* B. Críticos */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-700 mb-1 truncate">Críticos</div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSimulationDeltas((prev) => ({
                  ...prev,
                  criticosDelta: prev.criticosDelta - 1
                }))}
                className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-100 cursor-pointer flex items-center justify-center"
              >
                -
              </button>
              <div className="font-mono font-black text-sm text-slate-900">
                {Math.max(0, summary.criticosCount + simulationDeltas.criticosDelta)}
              </div>
              <button
                type="button"
                onClick={() => setSimulationDeltas((prev) => ({
                  ...prev,
                  criticosDelta: prev.criticosDelta + 1
                }))}
                className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-100 cursor-pointer flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>

          {/* C. Credinet */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-700 mb-1 truncate">Credinet</div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSimulationDeltas((prev) => ({
                  ...prev,
                  credinetDelta: prev.credinetDelta - 1
                }))}
                className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-100 cursor-pointer flex items-center justify-center"
              >
                -
              </button>
              <div className="font-mono font-black text-sm text-slate-900">
                {Math.max(0, summary.credinetCount + simulationDeltas.credinetDelta)}
              </div>
              <button
                type="button"
                onClick={() => setSimulationDeltas((prev) => ({
                  ...prev,
                  credinetDelta: prev.credinetDelta + 1
                }))}
                className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-100 cursor-pointer flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>

          {/* D. Tomas */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-700 mb-1 truncate">Tomas</div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSimulationDeltas((prev) => ({
                  ...prev,
                  tomasDelta: prev.tomasDelta - 1
                }))}
                className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-100 cursor-pointer flex items-center justify-center"
              >
                -
              </button>
              <div className="font-mono font-black text-sm text-slate-900">
                {Math.max(0, summary.tomasCount + simulationDeltas.tomasDelta)}
              </div>
              <button
                type="button"
                onClick={() => setSimulationDeltas((prev) => ({
                  ...prev,
                  tomasDelta: prev.tomasDelta + 1
                }))}
                className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-100 cursor-pointer flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Resultado del Simulador */}
        <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto justify-around sm:justify-start">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Bruto Actual</div>
              <div className="font-mono font-bold text-base text-slate-200">
                {formatCurrency(summary.totalGrossEstimated)}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500" />
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-400">Bruto Simulado</div>
              <div className="font-mono font-black text-lg text-white">
                {formatCurrency(simulation.simulatedGross)}
              </div>
            </div>
          </div>

          <div className="text-right w-full sm:w-auto flex items-center justify-between sm:block">
            <span className="text-xs text-slate-400 sm:hidden">Diferencia:</span>
            <span className={`font-mono font-black text-base px-3 py-1 rounded-lg ${
              simulation.difference > 0
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                : simulation.difference < 0
                ? 'bg-rose-950 text-rose-400 border border-rose-700'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {simulation.difference > 0 ? `+${formatCurrency(simulation.difference)}` : formatCurrency(simulation.difference)}
            </span>
          </div>
        </div>
      </div>

      {/* 6. DETALLE DE OPERACIONES (AUDITORÍA) */}
      <div id="detalle-operaciones-section" className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Detalle de Operaciones — {summary.monthLabel}
            </h3>
            <p className="text-xs text-slate-500">
              Auditá las operaciones que integran la liquidación económica y las que determinan los objetivos del mes.
            </p>
          </div>

          {/* Segmented Control / Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveDetailTab('invoiced')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeDetailTab === 'invoiced'
                  ? 'bg-white text-blue-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Liquidadas en el Mes ({invoicedOperations.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveDetailTab('sold')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeDetailTab === 'sold'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vendidas en el Mes ({soldOperations.length})
            </button>
          </div>
        </div>

        {/* PESTAÑA A: OPERACIONES LIQUIDADAS / FACTURADAS EN EL MES */}
        {activeDetailTab === 'invoiced' && (
          <div>
            <div className="text-[11px] text-slate-500 mb-3 bg-blue-50/60 p-2.5 rounded-lg border border-blue-100 flex items-center justify-between">
              <span>
                Mostrando {invoicedOperations.length} {invoicedOperations.length === 1 ? 'operación con fecha de facturación' : 'operaciones con fecha de facturación'} en este mes. Componen la Comisión Base (1%) y adicionales por toma a cobrar.
              </span>
              <span className="font-mono font-bold text-blue-800 text-xs">
                Total Base: {formatCurrency(summary.baseCommissionTotal)}
              </span>
            </div>

            {invoicedOperations.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
                <FileCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <div className="text-xs font-bold text-slate-700">No hay operaciones facturadas en {summary.monthLabel}</div>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                  Las ventas propias a las que registres fecha de facturación en este mes aparecerán aquí para liquidar su Comisión Base del 1% y adicionales de tomas.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoicedOperations.map((veh) => {
                  const status = checkSaleCommissionStatus(veh);
                  const baseCommission = veh.comisionBaseCalculada ?? (
                    (typeof veh.precioRealVenta === 'number' && (veh.ivaVenta === 21 || veh.ivaVenta === 10.5))
                      ? calculateBaseCommission(veh.precioRealVenta, veh.ivaVenta)
                      : 0
                  );
                  const tradeInCommission = veh.comisionTomaCalculada ?? (
                    (typeof veh.valorTomaUsado === 'number' && (veh.ivaTomaUsado === 21 || veh.ivaTomaUsado === 10.5))
                      ? calculateTradeInCommission(veh.valorTomaUsado, veh.ivaTomaUsado)
                      : 0
                  );

                  return (
                    <div 
                      key={veh.patente || veh.id}
                      className="p-3.5 rounded-xl border border-slate-200/90 hover:border-slate-300 bg-white transition-all space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-1 rounded bg-slate-900 text-white font-mono font-black text-xs">
                            {veh.patente}
                          </span>
                          <div>
                            <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                              {veh.marca} {veh.modelo}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                              <span>{veh.version} • {veh.anio}</span>
                              <span className="text-slate-300">|</span>
                              <span>Vendido: <strong className="text-slate-700">{formatDateDMY(veh.soldAt) || 'S/D'}</strong></span>
                              <span className="text-slate-300">|</span>
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                Facturado: {formatDateDMY(veh.fechaFacturacion)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => onOpenMarkAsSold(veh)}
                            className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3 text-slate-500" />
                            <span>Editar</span>
                          </button>
                        </div>
                      </div>

                      {/* Fila de Datos Económicos Base */}
                      {status.isBaseComplete ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Precio Venta</span>
                            <div className="font-mono font-bold text-slate-800">
                              {formatCurrency(veh.precioRealVenta)}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Alícuota IVA</span>
                            <div className="font-mono font-bold text-slate-800">
                              {veh.ivaVenta}%
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Comisión Base (1%)</span>
                            <div className="font-mono font-black text-blue-700">
                              {formatCurrency(baseCommission)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap self-center">
                            {veh.esCritico && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-900">
                                Crítico
                              </span>
                            )}
                            {veh.usaCredinet && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-100 text-indigo-900">
                                Credinet
                              </span>
                            )}
                            {veh.tieneTomaUsado && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-teal-100 text-teal-900">
                                Toma Usado
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between bg-amber-50/80 border border-amber-200 p-2.5 rounded-lg text-xs gap-2">
                          <div className="flex items-center gap-2 text-amber-900">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <div>
                              <span className="font-extrabold uppercase text-[11px] tracking-wide text-amber-950">
                                DATOS DE COMISIÓN INCOMPLETOS
                              </span>
                              <span className="text-amber-800 text-xs ml-2">
                                {status.baseMissingReason || 'Falta IVA o precio real de la operación'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenMarkAsSold(veh)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-xs cursor-pointer shadow-2xs self-start sm:self-auto shrink-0"
                          >
                            Completar datos
                          </button>
                        </div>
                      )}

                      {/* Subbloque si tiene Toma de Usado */}
                      {veh.tieneTomaUsado && (
                        status.isTradeInComplete ? (
                          <div className="bg-teal-50/80 border border-teal-200 rounded-lg p-2.5 text-xs text-teal-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <CarFront className="w-4 h-4 text-teal-700 shrink-0" />
                              <div>
                                <span className="font-bold">Usado Tomado:</span>{' '}
                                <span>{veh.marcaModeloTomaUsado || 'Vehículo Usado'}</span>
                                {veh.patenteTomaUsado && (
                                  <span className="ml-1.5 font-mono font-bold text-[11px] bg-teal-200/80 px-1 py-0.2 rounded">
                                    {veh.patenteTomaUsado}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span>Valor Toma: <strong>{formatCurrency(veh.valorTomaUsado)}</strong> ({veh.ivaTomaUsado}%)</span>
                              <span className="font-bold text-teal-800">
                                Comisión (0,5%): <strong>{formatCurrency(tradeInCommission)}</strong>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-amber-900">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <div>
                                <span className="font-extrabold uppercase text-[11px] tracking-wide text-amber-950">
                                  DATOS DE TOMA INCOMPLETOS
                                </span>
                                <span className="text-amber-800 text-xs ml-2">
                                  {status.tradeInMissingReason || 'Falta valor de toma o IVA del usado'}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onOpenMarkAsSold(veh)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-xs cursor-pointer shadow-2xs self-start sm:self-auto shrink-0"
                            >
                              Completar datos
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA B: OPERACIONES VENDIDAS EN EL MES (OBJETIVOS) */}
        {activeDetailTab === 'sold' && (
          <div>
            <div className="text-[11px] text-slate-500 mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
              <span>
                Mostrando {soldOperations.length} {soldOperations.length === 1 ? 'operación cerrada' : 'operaciones cerradas'} en {summary.monthLabel} (soldAt). Determinan los niveles de Volumen ({summary.volumenCount}), Críticos ({summary.criticosCount}), Credinet ({summary.credinetCount}) y Tomas ({summary.tomasCount}).
              </span>
              <span className="font-mono font-bold text-slate-800 text-xs">
                {summary.salesCount} ventas
              </span>
            </div>

            {soldOperations.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
                <Car className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <div className="text-xs font-bold text-slate-700">No hay ventas registradas en {summary.monthLabel}</div>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                  Las operaciones que cierres con fecha de venta en este mes sumarán a tus objetivos comerciales de volumen, mix, credinet y tomas.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {soldOperations.map((veh) => {
                  return (
                    <div 
                      key={veh.patente || veh.id}
                      className="p-3.5 rounded-xl border border-slate-200/90 hover:border-slate-300 bg-white transition-all space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-1 rounded bg-slate-900 text-white font-mono font-black text-xs">
                            {veh.patente}
                          </span>
                          <div>
                            <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                              {veh.marca} {veh.modelo}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                              <span>{veh.version} • {veh.anio}</span>
                              <span className="text-slate-300">|</span>
                              <span>Vendido el: <strong className="text-slate-800">{formatDateDMY(veh.soldAt) || 'S/D'}</strong></span>
                              <span className="text-slate-300">|</span>
                              {veh.fechaFacturacion ? (
                                <span className="text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                                  Facturada: {formatDateDMY(veh.fechaFacturacion)} (Se liquida en ese mes)
                                </span>
                              ) : (
                                <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                                  Pendiente de Facturación
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => onOpenMarkAsSold(veh)}
                            className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3 text-slate-500" />
                            <span>Editar</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Precio Venta</span>
                          <div className="font-mono font-bold text-slate-800">
                            {formatCurrency(veh.precioRealVenta)}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Alícuota IVA</span>
                          <div className="font-mono font-bold text-slate-800">
                            {veh.ivaVenta ? `${veh.ivaVenta}%` : 'S/D'}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Estado Facturación</span>
                          <div className="text-xs font-bold">
                            {veh.fechaFacturacion ? (
                              <span className="text-emerald-700">Facturada</span>
                            ) : (
                              <span className="text-amber-700">Pendiente</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap self-center">
                          {veh.esCritico && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-900">
                              Crítico
                            </span>
                          )}
                          {veh.usaCredinet && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-100 text-indigo-900">
                              Credinet
                            </span>
                          )}
                          {veh.tieneTomaUsado && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-teal-100 text-teal-900">
                              Toma Usado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: VER FACTURADAS DEL MES */}
      {showInvoicedModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => e.target === e.currentTarget && setShowInvoicedModal(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wide">
                    OPERACIONES FACTURADAS — {summary.monthLabel}
                  </h3>
                  <div className="text-xs text-slate-300">
                    {summary.invoicedVehicles.length} {summary.invoicedVehicles.length === 1 ? 'unidad que integra la liquidación económica' : 'unidades que integran la liquidación económica'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoicedModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {summary.invoicedVehicles.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No hay operaciones con fecha de facturación en {summary.monthLabel}.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 grid grid-cols-12 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <span className="col-span-3">Patente</span>
                    <span className="col-span-5">Vehículo</span>
                    <span className="col-span-2 text-center">Venta</span>
                    <span className="col-span-2 text-right">Facturada</span>
                  </div>
                  {summary.invoicedVehicles.map((v) => (
                    <div key={v.patente || v.id} className="px-4 py-3 grid grid-cols-12 items-center text-xs hover:bg-slate-50">
                      <div className="col-span-3">
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-white text-[11px]">
                          {v.patente}
                        </span>
                      </div>
                      <div className="col-span-5">
                        <div className="font-bold text-slate-900">{v.marca} {v.modelo}</div>
                        <div className="text-[11px] text-slate-400 truncate">{v.version}</div>
                      </div>
                      <div className="col-span-2 text-center font-mono text-slate-600 text-[11px]">
                        {formatDateDMY(v.soldAt) || 'S/D'}
                      </div>
                      <div className="col-span-2 text-right font-mono font-extrabold text-emerald-700 text-[11px]">
                        {formatDateDMY(v.fechaFacturacion)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowInvoicedModal(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VER VENTAS DEL MES */}
      {showSoldModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => e.target === e.currentTarget && setShowSoldModal(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <CarFront className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wide">
                    VENTAS DEL MES — {summary.monthLabel}
                  </h3>
                  <div className="text-xs text-slate-300">
                    {summary.salesCount} {summary.salesCount === 1 ? 'operación cerrada' : 'operaciones cerradas'} en el período (soldAt)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSoldModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {soldOperations.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No hay ventas registradas con fecha de venta en {summary.monthLabel}.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 grid grid-cols-12 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <span className="col-span-3">Patente</span>
                    <span className="col-span-4">Vehículo</span>
                    <span className="col-span-2 text-center">Vendido</span>
                    <span className="col-span-3 text-right">Facturación</span>
                  </div>
                  {soldOperations.map((v) => (
                    <div key={v.patente || v.id} className="px-4 py-3 grid grid-cols-12 items-center text-xs hover:bg-slate-50">
                      <div className="col-span-3">
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-white text-[11px]">
                          {v.patente}
                        </span>
                      </div>
                      <div className="col-span-4">
                        <div className="font-bold text-slate-900">{v.marca} {v.modelo}</div>
                        <div className="text-[11px] text-slate-400 truncate">{v.version}</div>
                      </div>
                      <div className="col-span-2 text-center font-mono text-slate-600 text-[11px]">
                        {formatDateDMY(v.soldAt) || 'S/D'}
                      </div>
                      <div className="col-span-3 text-right text-[11px]">
                        {v.fechaFacturacion ? (
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {formatDateDMY(v.fechaFacturacion)}
                          </span>
                        ) : (
                          <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                            Pendiente
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowSoldModal(false);
                  setActiveDetailTab('sold');
                  const el = document.getElementById('detalle-operaciones-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Ver Detalle Completo
              </button>
              <button
                type="button"
                onClick={() => setShowSoldModal(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VER PENDIENTES DE FACTURACIÓN */}
      {showPendingInvoiceModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => e.target === e.currentTarget && setShowPendingInvoiceModal(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wide">
                    VENTAS PENDIENTES DE FACTURACIÓN
                  </h3>
                  <div className="text-xs text-slate-300">
                    {summary.pendingInvoiceVehicles.length} {summary.pendingInvoiceVehicles.length === 1 ? 'operación sin fecha asignada' : 'operaciones sin fecha asignada'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPendingInvoiceModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              <p className="text-xs text-slate-600">
                Estas operaciones corresponden a tus ventas cerradas que aún no tienen registrada la fecha en que Administración informó su facturación:
              </p>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 grid grid-cols-12 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <span className="col-span-3">Patente</span>
                  <span className="col-span-6">Vehículo</span>
                  <span className="col-span-3 text-right">Fecha Venta</span>
                </div>
                {summary.pendingInvoiceVehicles.map((v) => (
                  <div key={v.patente || v.id} className="px-4 py-3 grid grid-cols-12 items-center text-xs hover:bg-slate-50">
                    <div className="col-span-3">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-white text-[11px]">
                        {v.patente}
                      </span>
                    </div>
                    <div className="col-span-6">
                      <div className="font-bold text-slate-900">{v.marca} {v.modelo}</div>
                      <div className="text-[11px] text-slate-400 truncate">{v.version}</div>
                    </div>
                    <div className="col-span-3 text-right font-mono text-slate-700 text-xs">
                      {formatDateDMY(v.soldAt) || 'S/D'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowPendingInvoiceModal(false);
                  onNavigateToSales();
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Ir a Mis Ventas para Marcar Facturadas
              </button>
              <button
                type="button"
                onClick={() => setShowPendingInvoiceModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
