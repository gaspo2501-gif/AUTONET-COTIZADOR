import { Vehicle, ProvinceTransfer } from '../types/stock';
import { formatCurrency } from '../utils/formatters';

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
    kilometraje: number;
    color: string;
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

  // Datos adicionales
  datosCliente: ClientData;
  datosAsesor: AdvisorSettings;
  observaciones: string[];
}

const ADVISOR_STORAGE_KEY = 'autonet_advisor_settings_v1';
const BUDGETS_STORAGE_KEY = 'autonet_saved_budgets_v1';

export const DEFAULT_ADVISOR: AdvisorSettings = {
  nombre: '',
  telefono: '',
  email: '',
  sucursal: 'Neuquén Capital',
  concesionaria: 'Autonet Usados Seleccionados',
};

class QuoteService {
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
  public createBudget(params: {
    vehicle: Vehicle;
    dnrpaTableValue: number;
    province: ProvinceTransfer;
    clientData?: ClientData;
    advisorOverride?: AdvisorSettings;
  }): CommercialBudget {
    const { vehicle, dnrpaTableValue, province, clientData, advisorOverride } = params;
    
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

    // Guardar en el historial de presupuestos
    this.saveBudgetToHistory(budget);

    return budget;
  }

  /**
   * Guarda un presupuesto emitido en el historial local.
   */
  private saveBudgetToHistory(budget: CommercialBudget): void {
    if (typeof window === 'undefined') return;
    try {
      const history = this.getBudgetHistory();
      const nextHistory = [budget, ...history.filter((b) => b.id !== budget.id)].slice(0, 50);
      localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(nextHistory));
    } catch (e) {
      console.error('Error al guardar presupuesto en historial:', e);
    }
  }

  /**
   * Obtiene todos los presupuestos emitidos.
   */
  public getBudgetHistory(): CommercialBudget[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(BUDGETS_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as CommercialBudget[];
      }
    } catch (e) {
      console.error('Error al leer historial de presupuestos:', e);
    }
    return [];
  }

  /**
   * Genera el texto simple, limpio y comercial para copiar y enviar por WhatsApp (Sección 22).
   */
  public formatBudgetWhatsAppMessage(budget: CommercialBudget): string {
    const v = budget.vehiculo;
    const precioFormatted = formatCurrency(budget.precioVehiculo);
    const transfFormatted = formatCurrency(budget.transferenciaEstimada);
    const totalFormatted = formatCurrency(budget.totalEstimado);

    const advisorName = budget.datosAsesor.nombre.trim();
    const vehiculoTitulo = `${v.marca} ${v.modelo} ${v.version}`.trim();
    const hasValidAutonetUrl = Boolean(v.urlAutonetOriginal && v.urlAutonetOriginal.startsWith('http'));

    let text = `Hola! Te paso el presupuesto por el ${vehiculoTitulo}:\n\n`;
    text += `Precio: ${precioFormatted}\n`;
    text += `Valor de la transferencia: ${transfFormatted}\n\n`;
    text += `Total estimado: ${totalFormatted}\n\n`;
    text += `Presupuesto válido por 24 horas.\n`;

    if (hasValidAutonetUrl) {
      text += `\nPodés ver la unidad acá:\n${v.urlAutonetOriginal}\n`;
    }

    text += `\nSaludos,\n${advisorName || 'Asesor Comercial'}`;

    return text;
  }

  /**
   * Formatea un mensaje de WhatsApp para compartir los datos del vehículo
   */
  public formatVehicleShareMessage(vehicle: Vehicle): string {
    const kmStr = new Intl.NumberFormat('es-AR').format(vehicle.kilometraje);
    const precioStr = formatCurrency(vehicle.precio, vehicle.moneda);
    return `🚗 *AUTONET USADOS SELECCIONADOS*
*${vehicle.marca} ${vehicle.modelo} ${vehicle.version} (${vehicle.anio})*

📅 *Año:* ${vehicle.anio}
🛣️ *Kilometraje:* ${kmStr} km
🎨 *Color:* ${vehicle.color || 'A confirmar'}
⛽ *Combustible:* ${vehicle.combustible || 'Nafta'}
🕹️ *Transmisión:* ${vehicle.caja || 'Manual'}
🏷️ *Patente:* ${vehicle.patente}
📍 *Ubicación:* ${vehicle.ubicacion || 'Neuquén'}

💰 *Precio de venta:* ${precioStr}
${vehicle.urlAutonetOriginal ? `🔗 *Ver en web:* ${vehicle.urlAutonetOriginal}\n` : ''}
Consulte por cotización de transferencia y entrega inmediata.
_Autonet Usados Seleccionados_`;
  }
}

export const quoteService = new QuoteService();
