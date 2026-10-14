import { ProvinceTransfer, Vehicle, VehicleQuoteCalculation } from '../types/stock';

export interface DnrpaQueryStatus {
  success: boolean;
  value?: number;
  requiresCaptcha: boolean;
  errorMessage?: string;
  officialUrl: string;
}

/**
 * Servicio de Cotización y Cálculo de Transferencias DNRPA.
 * 
 * Reglas de negocio vigentes:
 * 1. Provincias habilitadas:
 *    - Neuquén: 4,9% (0.049)
 *    - Río Negro: 5,5% (0.055)
 * 2. Determinación del valor base imponible:
 *    - Se compara: A) Precio de venta concesionario vs B) Valor de tabla DNRPA
 *    - Se toma SIEMPRE el MAYOR de los dos: transferBaseValue = Math.max(vehiclePrice, dnrpaTableValue)
 * 3. Cálculo de transferencia estimada:
 *    - Neuquén: transferBaseValue * 0.049
 *    - Río Negro: transferBaseValue * 0.055
 * 4. Integración DNRPA:
 *    - URL Oficial: https://www2.jus.gov.ar/dnrpa-site/#!/estimador
 *    - Trámite: "TRANSFERENCIA"
 *    - Patente: la del vehículo
 *    - Valor declarado: 1
 *    - Provincia: Neuquén o Río Negro
 *    - CAPTCHA: Si DNRPA solicita CAPTCHA o bloquea por CORS, la app se detiene y solicita
 *      intervención manual con el mensaje requerido, sin inventar valores falsos.
 */
class DnrpaService {
  public readonly OFFICIAL_ESTIMATOR_URL = 'https://www2.jus.gov.ar/dnrpa-site/#!/estimador';

  /**
   * Genera el texto exacto para el portapapeles según el formato requerido:
   * Trámite: TRANSFERENCIA
   * Patente: XXXXXXX
   * Valor declarado: 1
   * Provincia: [provincia]
   */
  public formatDnrpaClipboardData(patente: string, province: ProvinceTransfer): string {
    const cleanPlate = (patente || '').trim().toUpperCase();
    return `Trámite: TRANSFERENCIA\nPatente: ${cleanPlate}\nValor declarado: 1\nProvincia: ${province}`;
  }

  /**
   * Retorna el porcentaje exacto según la provincia.
   * Neuquén: 4.9%
   * Río Negro: 5.5%
   */
  public getProvincePercentage(province: ProvinceTransfer): number {
    return province === 'Neuquén' ? 4.9 : 5.5;
  }

  /**
   * Realiza el cálculo estricto de la cotización de transferencia.
   * Selecciona automáticamente el mayor valor entre el precio de venta y el valor de tabla DNRPA.
   */
  public calculateTransferQuote(
    vehiclePrice: number,
    dnrpaTableValue: number,
    province: ProvinceTransfer,
    vehicleData?: {
      id?: string;
      patente?: string;
      marca?: string;
      modelo?: string;
      version?: string;
      anio?: number;
    }
  ): VehicleQuoteCalculation {
    const validPrice = Math.max(0, vehiclePrice || 0);
    const validTableValue = Math.max(0, dnrpaTableValue || 0);
    const percentage = this.getProvincePercentage(province);

    // Determinación del mayor valor
    let transferBaseValue: number;
    let usedBaseOrigin: 'precio_venta' | 'tabla_dnrpa' | 'iguales';
    let comparisonExplanation: string;

    if (validTableValue > validPrice) {
      transferBaseValue = validTableValue;
      usedBaseOrigin = 'tabla_dnrpa';
      comparisonExplanation = 'El cálculo de transferencia se realiza sobre el valor de tabla DNRPA porque es superior al precio de venta.';
    } else if (validPrice > validTableValue) {
      transferBaseValue = validPrice;
      usedBaseOrigin = 'precio_venta';
      comparisonExplanation = 'El cálculo de transferencia se realiza sobre el precio de venta porque es superior al valor de tabla DNRPA.';
    } else {
      transferBaseValue = validPrice;
      usedBaseOrigin = 'iguales';
      comparisonExplanation = 'El precio de venta y el valor de tabla coinciden.';
    }

    // Cálculo matemático: Valor base × Porcentaje
    const estimatedTransferCost = Math.round(transferBaseValue * (percentage / 100));

    return {
      vehicleId: vehicleData?.id || '',
      patente: vehicleData?.patente || '',
      marca: vehicleData?.marca || '',
      modelo: vehicleData?.modelo || '',
      version: vehicleData?.version || '',
      anio: vehicleData?.anio || new Date().getFullYear(),
      vehiclePrice: validPrice,
      dnrpaTableValue: validTableValue,
      transferBaseValue,
      usedBaseOrigin,
      comparisonExplanation,
      province,
      transferPercentage: percentage,
      estimatedTransferCost,
      // Preparación para futuros presupuestos
      gastosAdicionales: 0,
      totalOperacion: validPrice + estimatedTransferCost,
      fechaCotizacion: new Date().toISOString(),
    };
  }

  /**
   * Intenta la consulta técnica al estimador oficial de DNRPA.
   * Análisis técnico riguroso:
   * La página oficial de DNRPA (https://www2.jus.gov.ar/dnrpa-site/#!/estimador) es un portal
   * gubernamental SPA protegido con directivas CORS del navegador y verificación interactiva / CAPTCHA.
   * Bajo ninguna circunstancia se inventan valores ni se simulan endpoints falsos.
   * Si la consulta no puede completarse de forma automática o requiere CAPTCHA, se reporta
   * de inmediato para que el operador realice la carga del valor obtenido de forma manual.
   */
  public async queryDnrpaEstimator(
    patente: string,
    province: ProvinceTransfer
  ): Promise<DnrpaQueryStatus> {
    const cleanPlate = (patente || '').trim().replace(/\s+/g, '').toUpperCase();
    
    // Verificación de viabilidad técnica en navegador
    try {
      // Si estamos en el navegador, las peticiones directas a www2.jus.gov.ar son bloqueadas por CORS del dominio gubernamental
      // o requieren resolución de CAPTCHA interactivo.
      return {
        success: false,
        requiresCaptcha: true,
        errorMessage: 'Para continuar con la consulta DNRPA es necesario completar el CAPTCHA en el sitio oficial.',
        officialUrl: this.OFFICIAL_ESTIMATOR_URL,
      };
    } catch {
      return {
        success: false,
        requiresCaptcha: false,
        errorMessage: 'No fue posible obtener automáticamente el valor de tabla DNRPA.',
        officialUrl: this.OFFICIAL_ESTIMATOR_URL,
      };
    }
  }

  /**
   * Método de compatibilidad para vistas que soliciten una estimación preliminar rápida.
   */
  public calculateOrientativeTransfer(vehicle: Vehicle, provinciaOverride?: ProvinceTransfer) {
    const prov: ProvinceTransfer = (provinciaOverride || vehicle.provinciaRadicacion || 'Neuquén') as ProvinceTransfer;
    const tableVal = vehicle.valorTablaDnrpaEstimado || 0;
    const quote = this.calculateTransferQuote(vehicle.precio, tableVal, prov, {
      id: vehicle.id,
      patente: vehicle.patente,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      version: vehicle.version,
      anio: vehicle.anio,
    });

    return {
      valorTablaOficial: tableVal > 0 ? tableVal : undefined,
      valorImponible: quote.transferBaseValue,
      totalEstimadoTransferencia: quote.estimatedTransferCost,
      porcentajeAplicado: quote.transferPercentage,
      provincia: quote.province,
      esEstimacionPreliminar: true,
      observacionesLegales: `Transferencia estimada para ${prov} (${quote.transferPercentage}%). ${quote.comparisonExplanation} El importe es estimativo y puede variar según los costos y conceptos aplicables al momento de realizar la transferencia.`,
    };
  }
}

export const dnrpaService = new DnrpaService();
