import { Vehicle, ProvinceTransfer } from '../types/stock';
import { formatCurrency, formatKm } from '../utils/formatters';
import { ADVISOR_INFO } from '../constants/advisor';
import { SyncedCollection } from './syncedCollection';
import { calcFinancing, financingService } from './financingService';

export interface AdvisorSettings {
  nombre: string;
  telefono: string;
  email?: string;
  sucursal: string;
  concesionaria: string;
}

export interface ClientData {
  nombre?: string;
  telefono?: string;
}

export interface FinancingOption {
  id: string;
  entidad: string;
  /** Monto a prestar (lo devuelve el simulador del banco). */
  montoFinanciado?: number;
  cuotas: number;
  montoCuota: number;
  detalle?: string;
  // Calculados al generar el presupuesto (quedan guardados tal cual se enviaron)
  conGastos?: boolean;
  gastosOtorgamiento?: number;
  gastosPrenda?: number;
  entregaMinima?: number;
}

export interface FinancingPlan {
  llevaFinanciacion: boolean;
  opciones: FinancingOption[];
}

export interface CommercialBudget {
  id: string;
  numeroPresupuesto: string;
  fechaEmision: string; // ISO string
  fechaVencimiento: string; // ISO string (exactamente 24 horas después)
  validezHoras: 24;
  
  // Datos del vehículo
  vehiculo: {
    id: string;
    marca: string;
    modelo: string;
    version: string;
    anio: number;
    kilometraje: number | null;
    color: string | null;
    patente: string;
    combustible: string;
    caja: string;
    urlAutonetOriginal?: string;
  };

  // Valores de la operación
  precioVehiculo: number;
  valorTablaDnrpa: number;
  baseImponible: number;
  provincia: ProvinceTransfer;
  alicuota: number; // 4.9 o 5.5
  transferenciaEstimada: number;
  totalEstimado: number; // precioVehiculo + transferenciaEstimada

  // Financiación manual (opcional)
  financiacion?: FinancingPlan;

  // Datos adicionales
  datosCliente: ClientData;
  datosAsesor: AdvisorSettings;
  observaciones: string[];

  // Seguimiento comercial (sin duplicar el CRM: vive pegado al presupuesto)
  seguimiento?: BudgetFollowUp;
  updatedAt?: string;
  deleted?: boolean;
}

export type BudgetFollowUpStatus = 'enviado' | 'respondio' | 'perdido' | 'vendido';

export interface BudgetFollowUp {
  estado: BudgetFollowUpStatus;
  /** Fecha (YYYY-MM-DD) para volver a contactar. */
  recordarEl?: string;
  nota?: string;
}

const ADVISOR_STORAGE_KEY = 'autonet_advisor_settings_v1';
const BUDGETS_STORAGE_KEY = 'autonet_saved_budgets_v1';

export const DEFAULT_ADVISOR: AdvisorSettings = {
  nombre: ADVISOR_INFO.nombre,
  telefono: ADVISOR_INFO.telefono,
  email: '',
  sucursal: `${ADVISOR_INFO.direccion}, ${ADVISOR_INFO.ciudad}`,
  concesionaria: ADVISOR_INFO.concesionaria,
};

/** Calcula gastos y entrega mínima de cada alternativa con la configuración vigente. */
export function enrichFinancingOptions(opciones: FinancingOption[], precio: number, transferencia: number): FinancingOption[] {
  const { redondeoEntrega } = financingService.getSettings();
  return opciones
    .filter((o) => o.entidad?.trim() && (Number(o.montoFinanciado) > 0 || Number(o.montoCuota) > 0))
    .map((o) => {
      const entity = financingService.findEntity(o.entidad);
      const r = calcFinancing({
        precioVehiculo: precio,
        transferencia,
        montoPrestamo: Number(o.montoFinanciado) || 0,
        cuotas: o.cuotas,
        valorCuota: o.montoCuota,
        entity,
        redondeo: redondeoEntrega,
      });
      return {
        ...o,
        entidad: o.entidad.trim().toUpperCase(),
        conGastos: Boolean(entity?.conGastos),
        gastosOtorgamiento: r.otorgamiento,
        gastosPrenda: r.prenda,
        entregaMinima: Number(o.montoFinanciado) > 0 ? r.entregaMinima : undefined,
      };
    });
}

const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━';

/**
 * Mensaje de WhatsApp con el formato de cotización del asesor:
 * vehículo → precio → transferencia → total → por cada financiación: entrega mínima y capital.
 */
export function buildQuoteWhatsAppMessage(p: {
  vehiculo: { marca: string; modelo: string; version: string; anio: number; patente: string };
  provincia: string;
  precio: number;
  transferencia: number;
  total: number;
  opciones?: FinancingOption[];
}): string {
  const v = p.vehiculo;
  let t = `🚗 *COTIZACIÓN DE TRANSFERENCIA*\n`;
  t += `*Vehículo:* ${v.marca} ${v.modelo} ${v.version} (${v.anio})\n`;
  t += `*Patente:* ${v.patente}\n`;
  t += `*Provincia:* ${p.provincia}\n\n`;
  t += `${LINE}\n`;
  t += `💰 *PRECIO DE VENTA:* ${formatCurrency(p.precio)}\n\n`;
  t += `📄 *TRANSFERENCIA ESTIMADA:* ${formatCurrency(p.transferencia)}\n`;
  t += `${LINE}\n`;
  t += `🏁 *TOTAL ESTIMADO OPERACIÓN:* ${formatCurrency(p.total)}\n`;

  const opciones = (p.opciones || []).filter((o) => Number(o.montoFinanciado) > 0);
  opciones.forEach((o, i) => {
    t += `\n`;
    if (opciones.length > 1) t += `🏦 *OPCIÓN ${i + 1}: ${o.entidad}*\n`;
    if (o.conGastos && ((o.gastosOtorgamiento || 0) > 0 || (o.gastosPrenda || 0) > 0)) {
      t += `Gastos de otorgamiento: ${formatCurrency(o.gastosOtorgamiento || 0)}\n`;
      t += `Inscripción de prenda: ${formatCurrency(o.gastosPrenda || 0)}\n`;
    }
    t += `*ENTREGA MÍNIMA* ${formatCurrency(o.entregaMinima || 0)}\n\n`;
    t += `*CAPITAL FINANCIADO (${o.entidad})* ${formatCurrency(o.montoFinanciado || 0)}\n`;
    if (o.cuotas > 0 && o.montoCuota > 0) t += `${o.cuotas} cuotas de ${formatCurrency(o.montoCuota)}\n`;
  });

  t += `\n_Aviso: La transferencia se calcula sobre el mayor valor entre el precio de venta y el valor de tabla DNRPA. El importe es estimativo y puede variar según los costos y conceptos aplicables al momento de realizar la transferencia en el Registro Seccional correspondiente._\n`;
  t += `_Presupuesto válido por 24 horas._\n\n`;
  t += `${LINE}\n`;
  t += `${ADVISOR_INFO.nombre} | ${ADVISOR_INFO.cargo}\n`;
  t += `📞 ${ADVISOR_INFO.telefono}\n`;
  t += `📍 ${ADVISOR_INFO.direccion}, ${ADVISOR_INFO.ciudad}, ${ADVISOR_INFO.provincia}, ${ADVISOR_INFO.pais}`;
  return t;
}

const budgetsStore = new SyncedCollection<CommercialBudget>('budgets', 'autonet_saved_budgets_v1', {
  max: 300,
  sort: (a, b) => Date.parse(b.fechaEmision) - Date.parse(a.fechaEmision),
});

class QuoteService {
  /** Suscripción a cambios del historial de presupuestos (alta, edición, borrado, otro dispositivo). */
  public subscribeBudgets(listener: (budgets: CommercialBudget[]) => void): () => void {
    return budgetsStore.subscribe(listener);
  }

  /** Actualiza el seguimiento (estado / recordatorio / nota) de un presupuesto. */
  public updateBudgetFollowUp(budgetId: string, seguimiento: BudgetFollowUp): CommercialBudget | undefined {
    return budgetsStore.update(budgetId, { seguimiento });
  }

  /** Actualiza los datos del cliente de un presupuesto ya emitido. */
  public updateBudgetClient(budgetId: string, clientData: ClientData): CommercialBudget | null {
    return (
      budgetsStore.update(budgetId, {
        datosCliente: { nombre: clientData.nombre?.trim() || '', telefono: clientData.telefono?.trim() || '' },
      }) || null
    );
  }

  /** Elimina un presupuesto del historial local. */
  public deleteBudget(budgetId: string): void {
    budgetsStore.remove(budgetId);
  }

  /** Arma el link de WhatsApp para el teléfono del cliente (formato Argentina). */
  public buildWhatsAppLink(phone: string | undefined, text: string): string | null {
    const digits = (phone || '').replace(/[^0-9]/g, '');
    if (digits.length < 8) return null;
    let intl = digits;
    if (intl.startsWith('54')) {
      // ya tiene código de país
    } else {
      intl = intl.replace(/^0/, '');
      intl = `549${intl}`;
    }
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  }

  /**
   * Obtiene los datos del asesor comercial guardados por el usuario.
   */
  public getAdvisorSettings(): AdvisorSettings {
    if (typeof window === 'undefined') return DEFAULT_ADVISOR;
    try {
      const saved = localStorage.getItem(ADVISOR_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_ADVISOR, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Error al leer datos del asesor:', e);
    }
    return DEFAULT_ADVISOR;
  }

  /**
   * Guarda los datos del asesor comercial en almacenamiento local.
   */
  public saveAdvisorSettings(settings: AdvisorSettings): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(ADVISOR_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Error al guardar datos del asesor:', e);
    }
  }

  /**
   * Genera un presupuesto formal de vehículo usado con validez estricta de 24 horas.
   * Regla de negocio: baseImponible = Math.max(precioVenta, valorTablaDnrpa)
   * Total = precioVenta + transferenciaEstimada (sin gastos ficticios).
   */
  public createBudget(params: Parameters<QuoteService['buildBudget']>[0]): CommercialBudget {
    const budget = this.buildBudget(params);
    this.saveBudgetToHistory(budget);
    return budget;
  }

  /**
   * Arma un presupuesto SIN guardarlo en el historial (para vistas previas, p. ej. el boleto).
   */
  public buildBudget(params: {
    vehicle: Vehicle;
    dnrpaTableValue: number;
    province: ProvinceTransfer;
    clientData?: ClientData;
    advisorOverride?: AdvisorSettings;
    financiacion?: FinancingPlan;
  }): CommercialBudget {
    const { vehicle, dnrpaTableValue, province, clientData, advisorOverride, financiacion } = params;
    
    const now = new Date();
    const expiration = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas exactas

    const precioVenta = Math.max(0, vehicle.precio || 0);
    const tablaDnrpa = Math.max(0, dnrpaTableValue || 0);
    const baseImponible = Math.max(precioVenta, tablaDnrpa);
    
    const alicuota = province === 'Neuquén' ? 4.9 : 5.5;
    const transferenciaEstimada = tablaDnrpa > 0 ? Math.round(baseImponible * (alicuota / 100)) : 0;
    const totalEstimado = precioVenta + transferenciaEstimada;

    const budgetId = `PR-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const advisor = advisorOverride || this.getAdvisorSettings();

    const budget: CommercialBudget = {
      id: budgetId,
      numeroPresupuesto: budgetId,
      fechaEmision: now.toISOString(),
      fechaVencimiento: expiration.toISOString(),
      validezHoras: 24,
      vehiculo: {
        id: vehicle.id,
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        version: vehicle.version,
        anio: vehicle.anio,
        kilometraje: vehicle.kilometraje,
        color: vehicle.color,
        patente: vehicle.patente,
        combustible: vehicle.combustible,
        caja: vehicle.caja,
        urlAutonetOriginal: vehicle.urlAutonetOriginal,
      },
      precioVehiculo: precioVenta,
      valorTablaDnrpa: tablaDnrpa,
      baseImponible,
      provincia: province,
      alicuota,
      transferenciaEstimada,
      totalEstimado,
      financiacion: financiacion?.llevaFinanciacion
        ? { llevaFinanciacion: true, opciones: enrichFinancingOptions(financiacion.opciones, precioVenta, transferenciaEstimada) }
        : undefined,
      datosCliente: {
        nombre: clientData?.nombre?.trim() || '',
        telefono: clientData?.telefono?.trim() || '',
      },
      datosAsesor: advisor,
      observaciones: [
        'El importe de transferencia es estimativo y puede variar según los costos y conceptos aplicables al momento de realizar la transferencia en el Registro Seccional correspondiente.',
        'Presupuesto válido por 24 horas.',
      ],
    };

    return budget;
  }

  /**
   * Guarda un presupuesto emitido en el historial local.
   */
  private saveBudgetToHistory(budget: CommercialBudget): void {
    budgetsStore.upsert({ ...budget, seguimiento: budget.seguimiento || { estado: 'enviado' } });
  }

  /**
   * Obtiene todos los presupuestos emitidos (más recientes primero).
   */
  public getBudgetHistory(): CommercialBudget[] {
    return budgetsStore.getAll();
  }

  /**
   * Genera el texto simple, limpio y comercial para copiar y enviar por WhatsApp con firma fija.
   */
  public formatBudgetWhatsAppMessage(budget: CommercialBudget): string {
    return buildQuoteWhatsAppMessage({
      vehiculo: budget.vehiculo,
      provincia: budget.provincia,
      precio: budget.precioVehiculo,
      transferencia: budget.transferenciaEstimada,
      total: budget.totalEstimado,
      opciones: budget.financiacion?.opciones,
    });
  }

  /**
   * Formatea un mensaje de WhatsApp para compartir los datos del vehículo con firma fija.
   */
  public formatVehicleShareMessage(vehicle: Vehicle): string {
    const kmStr = formatKm(vehicle.kilometraje);
    const precioStr = formatCurrency(vehicle.precio, vehicle.moneda);
    return `🚗 *AUTONET USADOS SELECCIONADOS*
*${vehicle.marca} ${vehicle.modelo} ${vehicle.version} (${vehicle.anio})*

📅 *Año:* ${vehicle.anio}
🛣️ *Kilometraje:* ${kmStr}
🎨 *Color:* ${vehicle.color || 'A confirmar'}
⛽ *Combustible:* ${vehicle.combustible || 'Nafta'}
🕹️ *Transmisión:* ${vehicle.caja || 'Manual'}
🏷️ *Patente:* ${vehicle.patente}

💰 *Precio de venta:* ${precioStr}
${vehicle.urlAutonetOriginal ? `🔗 *Ver en web:* ${vehicle.urlAutonetOriginal}\n` : ''}
Consulte por cotización de transferencia, financiación y entrega inmediata.

━━━━━━━━━━━━━━━━━━━━━
${ADVISOR_INFO.nombre} | ${ADVISOR_INFO.cargo}
📞 ${ADVISOR_INFO.telefono}
📍 ${ADVISOR_INFO.direccion}, ${ADVISOR_INFO.ciudad}, ${ADVISOR_INFO.provincia}, ${ADVISOR_INFO.pais}`;
  }
}

export const quoteService = new QuoteService();

