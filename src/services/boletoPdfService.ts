import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, StandardFonts, PDFName, rgb } from 'pdf-lib';
import { 
  BoletoCompanyKey, 
  BoletoData, 
  BoletoDiagnosticReport, 
  BoletoDiagnosticField,
  toBoletoText
} from '../types/boleto';
import { BOLETO_TEMPLATES_CONFIG, AUTHORIZED_TEMPLATES_DATA } from '../config/boletoTemplates';

/**
 * Cache en memoria de plantillas limpias cargadas (para evitar fetch repetitivo)
 */
const templateBytesCache = new Map<string, Uint8Array>();

/**
 * Almacén en memoria de plantillas personalizadas cargadas por el usuario (si sube archivos propios)
 */
const customUserTemplates = new Map<BoletoCompanyKey, Uint8Array>();

export interface TemplateValidationStatus {
  companyKey: BoletoCompanyKey;
  fileName: string;
  size: number;
  expectedSize: number;
  sha256: string;
  expectedSha256: string;
  fieldCount: number;
  expectedFields: number;
  shaMatches: boolean;
  fieldsMatch: boolean;
  isValid: boolean;
  errorMessage?: string;
}

export class BoletoPdfService {
  /**
   * Calcula el hash SHA-256 en formato hexadecimal
   */
  async computeSha256(bytes: Uint8Array): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    try {
      const nodeCrypto = await import('crypto');
      return nodeCrypto.createHash('sha256').update(bytes).digest('hex');
    } catch {
      return '';
    }
  }

  /**
   * Validación estricta y obligatoria de la plantilla base según Requisitos 4 y 5:
   * - SHA-256 debe coincidir exactamente con el documento original autorizado
   * - Cantidad de campos AcroForm debe coincidir exactamente (IRUÑA: 83, MIRAGE: 84, OIL BULL: 83)
   * Si no coincide: DETIENE inmediatamente y arroja el error legal estricto.
   */
  async validateAuthorizedTemplate(
    companyKey: BoletoCompanyKey,
    pdfBytes: Uint8Array
  ): Promise<TemplateValidationStatus> {
    const status = await this.inspectTemplateBytes(companyKey, pdfBytes);
    if (!status.isValid) {
      console.error(`[BOLETO-AUTH-ERROR] Plantilla de ${companyKey} no autorizada:`, status);
      throw new Error('ERROR: La plantilla oficial no coincide con el documento original autorizado.');
    }
    return status;
  }

  /**
   * Inspecciona bytes de una plantilla y devuelve el reporte completo de validación
   */
  async inspectTemplateBytes(
    companyKey: BoletoCompanyKey,
    pdfBytes: Uint8Array
  ): Promise<TemplateValidationStatus> {
    const auth = AUTHORIZED_TEMPLATES_DATA[companyKey];
    const fileName = auth?.fileName || `ORIGINAL_${companyKey}.pdf`;
    const expectedSize = auth?.expectedSize || 0;
    const expectedSha256 = auth?.expectedSha256 || '';
    const expectedFields = auth?.expectedFields || 0;

    const size = pdfBytes.length;
    const sha256 = await this.computeSha256(pdfBytes);

    let fieldCount = 0;
    let loadError: string | undefined;
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const form = pdfDoc.getForm();
      fieldCount = form.getFields().length;
    } catch (err: any) {
      loadError = err.message || 'Error al leer estructura AcroForm';
    }

    const shaMatches = expectedSha256 ? sha256.toLowerCase() === expectedSha256.toLowerCase() : true;
    const fieldsMatch = expectedFields > 0 ? fieldCount === expectedFields : true;
    const isValid = shaMatches && fieldsMatch && !loadError;

    let errorMessage: string | undefined;
    if (!isValid) {
      errorMessage = 'ERROR: La plantilla oficial no coincide con el documento original autorizado.';
    }

    return {
      companyKey,
      fileName,
      size,
      expectedSize,
      sha256,
      expectedSha256,
      fieldCount,
      expectedFields,
      shaMatches,
      fieldsMatch,
      isValid,
      errorMessage,
    };
  }

  /**
   * Obtiene el estado de validación de la plantilla actualmente configurada en el sistema
   */
  async checkCurrentTemplateStatus(companyKey: BoletoCompanyKey): Promise<TemplateValidationStatus> {
    const bytes = await this.getCleanTemplateBytes(companyKey);
    return await this.inspectTemplateBytes(companyKey, bytes);
  }

  /**
   * Descarga directamente la plantilla base sin pasar por pdf-lib (Requisito 11)
   */
  async downloadRawBaseTemplate(companyKey: BoletoCompanyKey): Promise<void> {
    const bytes = await this.getCleanTemplateBytes(companyKey);
    const auth = AUTHORIZED_TEMPLATES_DATA[companyKey];
    const fileName = auth?.fileName || `ORIGINAL_${companyKey}.pdf`;

    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Guarda una plantilla autorizada cargada por el usuario, actualizando tanto la memoria
   * como el almacenamiento en servidor si está disponible.
   */
  async saveAuthorizedTemplate(
    companyKey: BoletoCompanyKey,
    pdfBytes: Uint8Array,
    fileName: string
  ): Promise<TemplateValidationStatus> {
    const status = await this.inspectTemplateBytes(companyKey, pdfBytes);
    customUserTemplates.set(companyKey, pdfBytes);
    templateBytesCache.delete(companyKey);

    // Intentar persistir en servidor vía API local
    try {
      const base64Data = btoa(
        Array.from(pdfBytes).map((b) => String.fromCharCode(b)).join('')
      );
      await fetch('/api/upload-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, base64Data }),
      });
    } catch (err) {
      console.warn('[BOLETO-SERVICE] No se pudo guardar en disco vía API, mantenido en memoria:', err);
    }

    return status;
  }
  /**
   * Registra una plantilla personalizada proporcionada por el usuario (ej: al arrastrar un PDF real).
   * Automáticamente limpia todos los valores anteriores garantizando privacidad total.
   */
  async registerCustomTemplate(companyKey: BoletoCompanyKey, pdfBytes: Uint8Array): Promise<number> {
    const cleaned = await this.cleanTemplateBytes(pdfBytes);
    customUserTemplates.set(companyKey, cleaned);
    templateBytesCache.delete(companyKey);
    return cleaned.length;
  }

  /**
   * Limpia profundamente una plantilla PDF:
   * - Mantiene intactas las páginas (pág 1 y pág 2)
   * - Mantiene intactos logos, textos y cláusulas legales
   * - Mantiene intactos todos los campos AcroForm
   * - ELIMINA todos los valores previos (DNI, nombres, teléfonos, vehículos, importes)
   * - NO aplana el formulario (sigue editable)
   */
  async cleanTemplateBytes(pdfBytes: Uint8Array): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    for (const field of fields) {
      try {
        if (field instanceof PDFTextField) {
          field.setText('');
        } else if (field instanceof PDFCheckBox) {
          field.uncheck();
        } else if (field instanceof PDFRadioGroup) {
          field.clear();
        }
      } catch (err) {
        console.warn(`[BOLETO-CLEAN] No se pudo limpiar el campo: ${field.getName()}`, err);
      }
    }

    return await pdfDoc.save();
  }

  /**
   * Obtiene los bytes de la plantilla limpia para la empresa indicada
   */
  async getCleanTemplateBytes(companyKey: BoletoCompanyKey): Promise<Uint8Array> {
    // 1. Verificar si hay plantilla subida por el usuario
    if (customUserTemplates.has(companyKey)) {
      return customUserTemplates.get(companyKey)!;
    }

    // 2. Cargar desde la URL pública oficial con cache busting estricto
    const config = BOLETO_TEMPLATES_CONFIG[companyKey];
    if (!config || !config.available || !config.templateUrl) {
      throw new Error('No se pudo cargar la plantilla oficial de esta empresa.');
    }

    const bustUrl = `${config.templateUrl}?v=${Date.now()}`;
    const response = await fetch(bustUrl, { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    if (!response.ok) {
      throw new Error(`No se pudo cargar la plantilla oficial de ${companyKey} desde ${config.templateUrl}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const cleanBytes = new Uint8Array(arrayBuffer);
    return cleanBytes;
  }

  /**
   * Asigna texto a un campo si existe en el formulario
   */
  private setTextIfExists(
    form: ReturnType<PDFDocument['getForm']>,
    fieldName: string | undefined,
    value: string | undefined | null,
    maxLengthForScaling = 32
  ): boolean {
    if (!fieldName) return false;
    const strValue = value !== undefined && value !== null ? String(value).trim() : '';

    try {
      const field = form.getTextField(fieldName);
      if (field) {
        field.setText(strValue);
        // Ajuste dinámico de fuente para campos largos
        if (strValue.length > maxLengthForScaling) {
          field.setFontSize(8);
        }
        return true;
      }
    } catch {
      // Intenta buscar por nombre exacto entre todos los campos si hay prefijos
      const allFields = form.getFields();
      const match = allFields.find(f => f.getName() === fieldName);
      if (match && match instanceof PDFTextField) {
        try {
          match.setText(strValue);
          if (strValue.length > maxLengthForScaling) {
            match.setFontSize(8);
          }
          return true;
        } catch {
          // ignora
        }
      }
    }
    return false;
  }

  /**
   * Limpia un campo si existe
   */
  private clearFieldIfExists(
    form: ReturnType<PDFDocument['getForm']>,
    fieldName: string | undefined
  ): void {
    if (!fieldName) return;
    try {
      const field = form.getTextField(fieldName);
      if (field) {
        field.setText('');
      }
    } catch {
      // Ignora si no existe
    }
  }

  /**
   * Formatea un número como dinero argentino sin el símbolo '$'
   * (porque el boleto ya tiene '$' preimpreso)
   */
  formatMoneyForPdf(amount?: number | null): string {
    if (amount === undefined || amount === null || amount === 0 || isNaN(amount)) {
      return '';
    }
    return new Intl.NumberFormat('es-AR').format(Math.round(amount));
  }

  /**
   * Extrae los componentes de fecha estrictamente numéricos:
   * Dia: 2 dígitos ("11")
   * Mes: 2 dígitos ("09", NUNCA "Septiembre")
   * Año: 2 dígitos ("26")
   */
  extractNumericDate(data: BoletoData): { dia: string; mes: string; anio: string } {
    const MESES_MAP: Record<string, string> = {
      enero: '01', ene: '01',
      febrero: '02', feb: '02',
      marzo: '03', mar: '03',
      abril: '04', abr: '04',
      mayo: '05', may: '05',
      junio: '06', jun: '06',
      julio: '07', jul: '07',
      agosto: '08', ago: '08',
      septiembre: '09', setiembre: '09', sep: '09',
      octubre: '10', oct: '10',
      noviembre: '11', nov: '11',
      diciembre: '12', dic: '12',
    };

    let diaStr = (data.fechaDia || '').trim();
    let mesStr = (data.fechaMes || '').trim();
    let anioStr = (data.fechaAnio || '').trim();

    if (data.fechaOperacion) {
      const parts = data.fechaOperacion.trim().split(/[-/.]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          anioStr = parts[0].slice(-2);
          mesStr = parts[1];
          diaStr = parts[2];
        } else {
          diaStr = parts[0];
          mesStr = parts[1];
          anioStr = parts[2].slice(-2);
        }
      }
    }

    const dNum = parseInt(diaStr, 10);
    if (!isNaN(dNum) && dNum >= 1 && dNum <= 31) {
      diaStr = String(dNum).padStart(2, '0');
    }

    const lowerMes = mesStr.toLowerCase();
    if (MESES_MAP[lowerMes]) {
      mesStr = MESES_MAP[lowerMes];
    } else {
      const mNum = parseInt(mesStr, 10);
      if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
        mesStr = String(mNum).padStart(2, '0');
      }
    }

    if (anioStr.length > 2) {
      anioStr = anioStr.slice(-2);
    } else if (anioStr.length === 1) {
      anioStr = '0' + anioStr;
    }

    return { dia: diaStr, mes: mesStr, anio: anioStr };
  }

  /**
   * Genera el PDF del Boleto completado e imprimible respetando con 100% de fidelidad
   * la estética del documento original:
   * 1. Carga directamente la plantilla ORIGINAL (ORIGINAL_MIRAGE.pdf, ORIGINAL_IRUNA.pdf, ORIGINAL_OIL_BULL.pdf)
   * 2. Conserva intactos todos los gráficos, logos (ej. Volkswagen en Iruña), textos fijos y página 2
   * 3. Obtiene las coordenadas y rectángulos exactos de los campos AcroForm
   * 4. Escribe directamente los datos como texto transparente sin ningún fondo, caja, borde o contenedor
   * 5. Elimina y desactiva el catálogo AcroForm y anotaciones para eliminar cualquier resaltado o rectángulo gris/celeste
   */
  async generatePrintableBoleto(
    companyKey: BoletoCompanyKey,
    data: BoletoData,
    customTemplateBytes?: Uint8Array
  ): Promise<Uint8Array> {
    const config = BOLETO_TEMPLATES_CONFIG[companyKey];
    if (!customTemplateBytes && (!config || !config.available)) {
      throw new Error(config?.unavailableReason || `Plantilla no configurada para ${companyKey}`);
    }

    // 1. Cargar plantilla base limpia desde el archivo original
    const baseBytes = customTemplateBytes || (await this.getCleanTemplateBytes(companyKey));
    
    // Verificación obligatoria de SHA-256 y cantidad de campos del documento original autorizado
    await this.validateAuthorizedTemplate(companyKey, baseBytes);

    const pdfDoc = await PDFDocument.load(baseBytes, { ignoreEncryption: true });

    // 2. Extraer mapa de coordenadas y rectángulos de los campos AcroForm existentes
    const form = pdfDoc.getForm();
    const fieldWidgets = new Map<string, { x: number; y: number; width: number; height: number }>();
    for (const f of form.getFields()) {
      try {
        const widgets = f.acroField.getWidgets();
        if (widgets && widgets.length > 0) {
          const rect = widgets[0].getRectangle();
          fieldWidgets.set(f.getName(), rect);
        }
      } catch {
        // ignora campos sin widget
      }
    }

    // 3. Fuente Helvetica estándar
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page1 = pdfDoc.getPages()[0];
    const map = config.fieldMap;

    // Helper de dibujado transparente directo sobre las coordenadas del campo
    const drawTextInField = (
      fieldName: string | undefined,
      val: string | number | undefined | null,
      options?: {
        align?: 'left' | 'center' | 'right';
        maxFontSize?: number;
        paddingX?: number;
      }
    ) => {
      if (!fieldName) return;
      if (val === undefined || val === null) return;
      const text = String(val).trim();
      if (!text) return;

      const rect = fieldWidgets.get(fieldName);
      if (!rect) return;

      const padX = options?.paddingX ?? 2;
      let fontSize = options?.maxFontSize ?? Math.min(8.5, rect.height * 0.65);
      const availWidth = Math.max(0, rect.width - padX * 2);

      // Reducción dinámica si el texto supera el ancho disponible
      const currentWidth = font.widthOfTextAtSize(text, fontSize);
      if (currentWidth > availWidth && availWidth > 0) {
        fontSize = Math.max(5.5, fontSize * (availWidth / currentWidth));
      }

      const textWidth = font.widthOfTextAtSize(text, fontSize);
      let posX = rect.x + padX;
      if (options?.align === 'center') {
        posX = rect.x + Math.max(padX, (rect.width - textWidth) / 2);
      } else if (options?.align === 'right') {
        posX = rect.x + rect.width - textWidth - padX;
      }

      // Posicionamiento vertical centrado respecto a la altura del campo
      const posY = rect.y + (rect.height - fontSize) / 2 + 1.2;

      page1.drawText(text, {
        x: posX,
        y: posY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    };

    // 1. FECHA (Estrictamente numérica)
    const { dia, mes, anio } = this.extractNumericDate(data);
    drawTextInField(map.fechaDia, dia, { align: 'center' });
    drawTextInField(map.fechaMes, mes, { align: 'center' });
    drawTextInField(map.fechaAnio, anio, { align: 'center' });

    // 2. DATOS DEL CLIENTE
    drawTextInField(map.clienteNombre, toBoletoText(data.cliente.nombreCompleto));
    drawTextInField(map.clienteDni, data.cliente.dni ? String(data.cliente.dni).trim() : '');
    drawTextInField(map.clienteCuit, data.cliente.cuitCuil ? String(data.cliente.cuitCuil).trim() : '');
    drawTextInField(map.clienteActividad, toBoletoText(data.cliente.actividad));
    drawTextInField(map.clienteEstadoCivil, toBoletoText(data.cliente.estadoCivil));
    drawTextInField(map.clienteCondicionIva, toBoletoText(data.cliente.condicionIVA));
    drawTextInField(map.clienteDireccion, toBoletoText(data.cliente.direccion));
    drawTextInField(map.clienteLocalidad, toBoletoText(data.cliente.localidad));
    drawTextInField(map.clienteProvincia, toBoletoText(data.cliente.provincia));
    drawTextInField(map.clienteCodigoPostal, data.cliente.codigoPostal ? String(data.cliente.codigoPostal).trim() : '');
    drawTextInField(map.clienteTelefono, data.cliente.telefono ? String(data.cliente.telefono).trim() : '');
    drawTextInField(map.clienteEmail, toBoletoText(data.cliente.email));

    // Fecha de Nacimiento del cliente
    let nacDia = data.cliente.nacimientoDia || '';
    let nacMes = data.cliente.nacimientoMes || '';
    let nacAnio = data.cliente.nacimientoAnio || '';
    if (!nacDia && data.cliente.fechaNacimiento) {
      const nParts = data.cliente.fechaNacimiento.split(/[-/.]/);
      if (nParts.length === 3) {
        if (nParts[0].length === 4) {
          nacAnio = nParts[0].slice(-2);
          nacMes = nParts[1];
          nacDia = nParts[2];
        } else {
          nacDia = nParts[0];
          nacMes = nParts[1];
          nacAnio = nParts[2].slice(-2);
        }
      }
    }
    drawTextInField(map.clienteNacimientoDia, nacDia, { align: 'center' });
    drawTextInField(map.clienteNacimientoMes, nacMes, { align: 'center' });
    drawTextInField(map.clienteNacimientoAnio, nacAnio, { align: 'center' });

    // 3. UNIDAD ADQUIRIDA
    drawTextInField(map.unidadModelo, toBoletoText(data.unidadAdquirida.descripcion));
    drawTextInField(map.unidadAnio, data.unidadAdquirida.anio ? String(data.unidadAdquirida.anio) : '');
    drawTextInField(map.unidadDominio, toBoletoText(data.unidadAdquirida.patente));
    drawTextInField(map.unidadColor, toBoletoText(data.unidadAdquirida.color || data.operacion.color));
    drawTextInField(map.unidadStock, toBoletoText(data.unidadAdquirida.stockInterno));
    drawTextInField(map.unidadMotor, toBoletoText(data.unidadAdquirida.motor));
    drawTextInField(map.unidadChasis, toBoletoText(data.unidadAdquirida.chasis));
    drawTextInField(map.unidadFechaEntrega, data.unidadAdquirida.fechaEntrega);

    // 4. OPERACIÓN Y FORMAS DE PAGO
    // COD / Referencia de lista
    drawTextInField(map.operacionLista, toBoletoText(data.operacion.referenciaLista));
    drawTextInField(map.operacionPrecioVehiculo, this.formatMoneyForPdf(data.operacion.precioVehiculo));
    drawTextInField(map.operacionColor, toBoletoText(data.operacion.color));

    // N° Comprobante: Mantener ESTRICTAMENTE VACÍO (no dibujar nada)

    // Seña (Text18)
    drawTextInField(map.operacionSena, this.formatMoneyForPdf(data.operacion.sena));

    // Efectivo adicional (Text19): Solo si es > 0
    if (data.operacion.efectivoAdicional && data.operacion.efectivoAdicional > 0) {
      drawTextInField(map.operacionEfectivo, this.formatMoneyForPdf(data.operacion.efectivoAdicional));
    }

    // Totales de la operación:
    // El TOTAL del bloque derecho de FORMAS DE PAGO (undefined) y el TOTAL del bloque GESTORÍA (undefined_8)
    // toman ambos exclusivamente el valor de totalOperacion.
    // Si totalOperacion no existe o es <= 0, ambos campos deben quedar vacíos.
    if (data.operacion.totalOperacion && data.operacion.totalOperacion > 0) {
      const totalFormatted = this.formatMoneyForPdf(data.operacion.totalOperacion);
      drawTextInField(map.operacionTotalPrimario, totalFormatted);
      if (map.operacionTotalSecundario) {
        drawTextInField(map.operacionTotalSecundario, totalFormatted);
      }
    }

    // Financiaciones en las filas de Cheque c/Bco (Text28/Text20 a Text33/Text25)
    // Cada financiación ocupa DOS campos distintos:
    // - detalle (izquierdo): entidad financiera
    // - importe (derecho): monto financiado
    const paymentRows = map.paymentRows || [
      { detailField: 'Text28', amountField: 'Text20' },
      { detailField: 'Text29', amountField: 'Text21' },
      { detailField: 'Text30', amountField: 'Text22' },
      { detailField: 'Text31', amountField: 'Text23' },
      { detailField: 'Text32', amountField: 'Text24' },
      { detailField: 'Text33', amountField: 'Text25' },
    ];

    let activeFinancings = (data.operacion.financiaciones || []).filter(
      (f) => f.activo && f.montoFinanciado > 0
    );

    if (activeFinancings.length === 0 && data.operacion.llevaFinanciacion && data.operacion.montoFinanciado) {
      activeFinancings = [
        {
          id: 'legacy-fin',
          entidad: data.operacion.entidadFinanciera || 'Financiación',
          montoFinanciado: data.operacion.montoFinanciado,
          cuotas: data.operacion.cuotas,
          valorCuota: data.operacion.valorCuota,
          activo: true,
        },
      ];
    }

    paymentRows.forEach((row, index) => {
      if (index < activeFinancings.length) {
        const fin = activeFinancings[index];
        const entidad = toBoletoText(fin.entidad);
        const montoStr = this.formatMoneyForPdf(fin.montoFinanciado);

        if (row.detailField) {
          drawTextInField(row.detailField, entidad);
        }
        drawTextInField(row.amountField, montoStr);
      }
    });

    // CAMPOS ESTRICTAMENTE VACÍOS POR DEFINICIÓN:
    // "Banco que financia", "Text34", "Text35" -> NO SE DIBUJA NADA

    // Checkbox oficial "Me han ofrecido realizar Prueba de Manejo" (campo AcroForm: 'Me han ofrecido realizar')
    // NUNCA marcar Text33 (Text33 corresponde a la fila 6 de Cheque c/Bco)
    const rPrueba = fieldWidgets.get('Me han ofrecido realizar');
    if (rPrueba) {
      const mark = 'X';
      const mSize = 9;
      const mW = font.widthOfTextAtSize(mark, mSize);
      page1.drawText(mark, {
        x: rPrueba.x + (rPrueba.width - mW) / 2,
        y: rPrueba.y + (rPrueba.height - mSize) / 2 + 1,
        size: mSize,
        font,
        color: rgb(0, 0, 0),
      });
    }

    // 5. GESTORÍA -> PATENTAMIENTO (Valor de transferencia calculada)
    // Se completa con el valor de transferencia de la cotización actual, formateado con separador de miles.
    // Si no existe valor o es <= 0, se deja estrictamente vacío (NO poner 0).
    if (data.operacion.patentamiento && data.operacion.patentamiento > 0) {
      drawTextInField(map.gestoriaPatentamiento || 'undefined_9', this.formatMoneyForPdf(data.operacion.patentamiento));
    }

    // 6. USADO ENTREGADO
    if (data.entregaUsado.enabled) {
      drawTextInField(map.usadoValorToma, this.formatMoneyForPdf(data.entregaUsado.valorToma));
      drawTextInField(map.usadoModelo, toBoletoText(data.entregaUsado.modelo));
      drawTextInField(map.usadoAnio, data.entregaUsado.anio ? String(data.entregaUsado.anio) : '');
      drawTextInField(map.usadoDominio, toBoletoText(data.entregaUsado.patente));
      drawTextInField(map.usadoMotor, toBoletoText(data.entregaUsado.motor));
      drawTextInField(map.usadoChasis, toBoletoText(data.entregaUsado.chasis));
    }

    // 6. Eliminar completamente AcroForm y Annots del documento
    // Esto garantiza un renderizado 100% fiel al documento original, sin cajas ni bordes
    pdfDoc.catalog.delete(PDFName.of('AcroForm'));
    for (const page of pdfDoc.getPages()) {
      page.node.delete(PDFName.of('Annots'));
    }

    const finalPdfBytes = await pdfDoc.save();
    console.log(`[BOLETO-PRINTABLE] Generado exitosamente para ${companyKey}. Tamaño: ${finalPdfBytes.length} bytes`);
    return finalPdfBytes;
  }

  /**
   * Genera el PDF del Boleto completo client-side a partir de BoletoData.
   * Utiliza la estrategia de renderizado imprimible fiel al original (sin cajas ni widgets).
   */
  async generateBoletoPdf(
    companyKey: BoletoCompanyKey,
    data: BoletoData,
    customTemplateBytes?: Uint8Array
  ): Promise<Uint8Array> {
    return this.generatePrintableBoleto(companyKey, data, customTemplateBytes);
  }

  /**
   * Versión editable (mantiene AcroForm) para diagnóstico e inspección avanzada si se requiere
   */
  async generateEditableBoleto(
    companyKey: BoletoCompanyKey,
    data: BoletoData,
    customTemplateBytes?: Uint8Array
  ): Promise<Uint8Array> {
    const config = BOLETO_TEMPLATES_CONFIG[companyKey];
    if (!customTemplateBytes && (!config || !config.available)) {
      throw new Error(config?.unavailableReason || `Plantilla no configurada para ${companyKey}`);
    }

    const baseBytes = customTemplateBytes || (await this.getCleanTemplateBytes(companyKey));
    
    // Verificación obligatoria de SHA-256 y cantidad de campos del documento original autorizado
    await this.validateAuthorizedTemplate(companyKey, baseBytes);

    const pdfDoc = await PDFDocument.load(baseBytes, { ignoreEncryption: true });
    await pdfDoc.embedFont(StandardFonts.Helvetica);
    const form = pdfDoc.getForm();
    const map = config.fieldMap;

    const { dia, mes, anio } = this.extractNumericDate(data);
    this.setTextIfExists(form, map.fechaDia, dia);
    this.setTextIfExists(form, map.fechaMes, mes);
    this.setTextIfExists(form, map.fechaAnio, anio);

    this.setTextIfExists(form, map.clienteNombre, toBoletoText(data.cliente.nombreCompleto), 28);
    this.setTextIfExists(form, map.clienteDni, data.cliente.dni ? String(data.cliente.dni).trim() : '');
    this.setTextIfExists(form, map.clienteCuit, data.cliente.cuitCuil ? String(data.cliente.cuitCuil).trim() : '');
    this.setTextIfExists(form, map.clienteActividad, toBoletoText(data.cliente.actividad));
    this.setTextIfExists(form, map.clienteEstadoCivil, toBoletoText(data.cliente.estadoCivil));
    this.setTextIfExists(form, map.clienteCondicionIva, toBoletoText(data.cliente.condicionIVA));
    this.setTextIfExists(form, map.clienteDireccion, toBoletoText(data.cliente.direccion), 32);
    this.setTextIfExists(form, map.clienteLocalidad, toBoletoText(data.cliente.localidad));
    this.setTextIfExists(form, map.clienteProvincia, toBoletoText(data.cliente.provincia));
    this.setTextIfExists(form, map.clienteCodigoPostal, data.cliente.codigoPostal ? String(data.cliente.codigoPostal).trim() : '');
    this.setTextIfExists(form, map.clienteTelefono, data.cliente.telefono ? String(data.cliente.telefono).trim() : '');
    this.setTextIfExists(form, map.clienteEmail, toBoletoText(data.cliente.email), 30);

    this.setTextIfExists(form, map.unidadModelo, toBoletoText(data.unidadAdquirida.descripcion), 30);
    this.setTextIfExists(form, map.unidadAnio, data.unidadAdquirida.anio ? String(data.unidadAdquirida.anio) : '');
    this.setTextIfExists(form, map.unidadDominio, toBoletoText(data.unidadAdquirida.patente));
    this.setTextIfExists(form, map.unidadColor, toBoletoText(data.unidadAdquirida.color || data.operacion.color));
    this.setTextIfExists(form, map.unidadStock, toBoletoText(data.unidadAdquirida.stockInterno));
    this.setTextIfExists(form, map.unidadMotor, toBoletoText(data.unidadAdquirida.motor));
    this.setTextIfExists(form, map.unidadChasis, toBoletoText(data.unidadAdquirida.chasis));
    this.setTextIfExists(form, map.unidadFechaEntrega, data.unidadAdquirida.fechaEntrega);

    this.setTextIfExists(form, map.operacionLista, toBoletoText(data.operacion.referenciaLista));
    this.setTextIfExists(form, map.operacionPrecioVehiculo, this.formatMoneyForPdf(data.operacion.precioVehiculo));
    this.setTextIfExists(form, map.operacionColor, toBoletoText(data.operacion.color));
    this.clearFieldIfExists(form, 'Text1');
    if (map.operacionNumeroComprobante) this.clearFieldIfExists(form, map.operacionNumeroComprobante);

    this.setTextIfExists(form, map.operacionSena, this.formatMoneyForPdf(data.operacion.sena));
    if (data.operacion.efectivoAdicional && data.operacion.efectivoAdicional > 0) {
      this.setTextIfExists(form, map.operacionEfectivo, this.formatMoneyForPdf(data.operacion.efectivoAdicional));
    } else {
      this.clearFieldIfExists(form, map.operacionEfectivo);
    }

    // Totales de la operación: FORMAS DE PAGO (undefined) y GESTORÍA (undefined_8)
    // toman ambos exclusivamente el valor de totalOperacion.
    // Si totalOperacion no existe o es <= 0, ambos campos deben quedar vacíos.
    if (data.operacion.totalOperacion && data.operacion.totalOperacion > 0) {
      const totalFormatted = this.formatMoneyForPdf(data.operacion.totalOperacion);
      this.setTextIfExists(form, map.operacionTotalPrimario, totalFormatted);
      if (map.operacionTotalSecundario) {
        this.setTextIfExists(form, map.operacionTotalSecundario, totalFormatted);
      }
    } else {
      this.clearFieldIfExists(form, map.operacionTotalPrimario);
      if (map.operacionTotalSecundario) {
        this.clearFieldIfExists(form, map.operacionTotalSecundario);
      }
    }

    // Financiaciones en las filas de Cheque c/Bco (Text28/Text20 a Text33/Text25)
    const paymentRows = map.paymentRows || [
      { detailField: 'Text28', amountField: 'Text20' },
      { detailField: 'Text29', amountField: 'Text21' },
      { detailField: 'Text30', amountField: 'Text22' },
      { detailField: 'Text31', amountField: 'Text23' },
      { detailField: 'Text32', amountField: 'Text24' },
      { detailField: 'Text33', amountField: 'Text25' },
    ];

    let activeFinancings = (data.operacion.financiaciones || []).filter(
      (f) => f.activo && f.montoFinanciado > 0
    );

    paymentRows.forEach((row, index) => {
      if (index < activeFinancings.length) {
        const fin = activeFinancings[index];
        const entidad = toBoletoText(fin.entidad);
        const montoStr = this.formatMoneyForPdf(fin.montoFinanciado);
        if (row.detailField) {
          this.setTextIfExists(form, row.detailField, entidad);
        }
        this.setTextIfExists(form, row.amountField, montoStr);
      } else {
        if (row.detailField) {
          this.clearFieldIfExists(form, row.detailField);
        }
        this.clearFieldIfExists(form, row.amountField);
      }
    });

    // Campos de financiamiento que deben quedar estrictamente vacíos
    this.clearFieldIfExists(form, 'Banco que financia');
    this.clearFieldIfExists(form, 'Text34');
    this.clearFieldIfExists(form, 'Text35');

    // Gestoría -> Patentamiento (transferencia calculada)
    if (data.operacion.patentamiento && data.operacion.patentamiento > 0) {
      this.setTextIfExists(form, map.gestoriaPatentamiento || 'undefined_9', this.formatMoneyForPdf(data.operacion.patentamiento));
    } else {
      this.clearFieldIfExists(form, map.gestoriaPatentamiento || 'undefined_9');
    }

    // Usado entregado
    if (data.entregaUsado.enabled) {
      this.setTextIfExists(form, map.usadoValorToma, this.formatMoneyForPdf(data.entregaUsado.valorToma));
      this.setTextIfExists(form, map.usadoModelo, toBoletoText(data.entregaUsado.modelo));
      this.setTextIfExists(form, map.usadoAnio, data.entregaUsado.anio ? String(data.entregaUsado.anio) : '');
      this.setTextIfExists(form, map.usadoDominio, toBoletoText(data.entregaUsado.patente));
      this.setTextIfExists(form, map.usadoMotor, toBoletoText(data.entregaUsado.motor));
      this.setTextIfExists(form, map.usadoChasis, toBoletoText(data.entregaUsado.chasis));
    } else {
      this.clearFieldIfExists(form, map.usadoValorToma);
      this.clearFieldIfExists(form, map.usadoModelo);
      this.clearFieldIfExists(form, map.usadoAnio);
      this.clearFieldIfExists(form, map.usadoDominio);
      this.clearFieldIfExists(form, map.usadoMotor);
      this.clearFieldIfExists(form, map.usadoChasis);
    }

    return await pdfDoc.save();
  }

  /**
   * Diagnóstico e inspección avanzada de campos para la pestaña de revisión (Requisito 28)
   */
  async inspectFields(
    companyKey: BoletoCompanyKey,
    data: BoletoData,
    customTemplateBytes?: Uint8Array
  ): Promise<BoletoDiagnosticReport> {
    const config = BOLETO_TEMPLATES_CONFIG[companyKey];
    const baseBytes = customTemplateBytes || (await this.getCleanTemplateBytes(companyKey));
    const pdfDoc = await PDFDocument.load(baseBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const pdfFields = form.getFields();
    const pdfFieldNames = new Set(pdfFields.map(f => f.getName()));

    const map = config.fieldMap;
    const items: BoletoDiagnosticField[] = [];

    const addCheck = (pdfFieldName: string | undefined, concept: string, val: string) => {
      if (!pdfFieldName) return;
      const found = pdfFieldNames.has(pdfFieldName);
      let fieldType = 'Desconocido';
      if (found) {
        const f = pdfFields.find(x => x.getName() === pdfFieldName);
        if (f instanceof PDFTextField) fieldType = 'TextField';
        else if (f instanceof PDFCheckBox) fieldType = 'CheckBox';
        else if (f instanceof PDFRadioGroup) fieldType = 'RadioGroup';
      }
      items.push({
        pdfFieldName,
        mappedConcept: concept,
        valueToApply: val,
        fieldFoundInPdf: found,
        fieldType,
      });
    };

    // Mapeo detallado de diagnóstico
    addCheck(map.fechaDia, 'Día fecha', data.fechaDia || '');
    addCheck(map.fechaMes, 'Mes fecha', data.fechaMes || '');
    addCheck(map.fechaAnio, 'Año fecha', data.fechaAnio || '');

    addCheck(map.clienteNombre, 'Cliente Nombre y Apellido', data.cliente.nombreCompleto || '');
    addCheck(map.clienteDni, 'Cliente DNI', data.cliente.dni || '');
    addCheck(map.clienteCuit, 'Cliente CUIT/CUIL', data.cliente.cuitCuil || '');
    addCheck(map.clienteNacimientoDia, 'Nacimiento Día', data.cliente.nacimientoDia || '');
    addCheck(map.clienteNacimientoMes, 'Nacimiento Mes', data.cliente.nacimientoMes || '');
    addCheck(map.clienteNacimientoAnio, 'Nacimiento Año', data.cliente.nacimientoAnio || '');
    addCheck(map.clienteEstadoCivil, 'Estado Civil', data.cliente.estadoCivil || '');
    addCheck(map.clienteActividad, 'Actividad o Profesión', data.cliente.actividad || '');
    addCheck(map.clienteCondicionIva, 'Condición IVA', data.cliente.condicionIVA || '');
    addCheck(map.clienteDireccion, 'Dirección', data.cliente.direccion || '');
    addCheck(map.clienteLocalidad, 'Localidad', data.cliente.localidad || '');
    addCheck(map.clienteProvincia, 'Provincia', data.cliente.provincia || '');
    addCheck(map.clienteCodigoPostal, 'Código Postal', data.cliente.codigoPostal || '');
    addCheck(map.clienteTelefono, 'Teléfono', data.cliente.telefono || '');
    addCheck(map.clienteEmail, 'Email', data.cliente.email || '');

    addCheck(map.unidadModelo, 'Unidad Modelo y Versión', data.unidadAdquirida.descripcion || '');
    addCheck(map.unidadAnio, 'Unidad Año', data.unidadAdquirida.anio ? String(data.unidadAdquirida.anio) : '');
    addCheck(map.unidadDominio, 'Unidad Dominio (Patente)', data.unidadAdquirida.patente || '');
    addCheck(map.unidadColor, 'Unidad Color', data.unidadAdquirida.color || '');
    addCheck(map.unidadStock, 'Unidad N° Stock', data.unidadAdquirida.stockInterno || '');
    addCheck(map.unidadMotor, 'Unidad Motor', data.unidadAdquirida.motor || '');
    addCheck(map.unidadChasis, 'Unidad Chasis', data.unidadAdquirida.chasis || '');
    addCheck(map.unidadFechaEntrega, 'Fecha de Entrega', data.unidadAdquirida.fechaEntrega || '');

    addCheck(map.operacionLista, 'Referencia Lista (COD)', data.operacion.referenciaLista || '');
    addCheck(map.operacionPrecioVehiculo, 'Precio Unidad (Text10)', this.formatMoneyForPdf(data.operacion.precioVehiculo));
    addCheck(map.operacionColor, 'Color Operación (COLOR)', data.operacion.color || '');
    addCheck(map.operacionSena, 'Seña (Text18)', this.formatMoneyForPdf(data.operacion.sena));
    addCheck(map.operacionEfectivo, 'Efectivo Adicional (Text19)', data.operacion.efectivoAdicional ? this.formatMoneyForPdf(data.operacion.efectivoAdicional) : '');
    
    // Totales: FORMAS DE PAGO (undefined) y GESTORÍA (undefined_8) toman exclusivamente totalOperacion
    const totalExpected = (data.operacion.totalOperacion && data.operacion.totalOperacion > 0)
      ? this.formatMoneyForPdf(data.operacion.totalOperacion)
      : '';
    addCheck(map.operacionTotalPrimario, 'Total Operación - Formas de Pago (undefined)', totalExpected);
    if (map.operacionTotalSecundario) {
      addCheck(map.operacionTotalSecundario, 'Total Operación - Gestoría (undefined_8)', totalExpected);
    }

    // Financiaciones activas
    let activeFinancings = (data.operacion.financiaciones || []).filter(
      (f) => f.activo && f.montoFinanciado > 0
    );
    if (activeFinancings.length === 0 && data.operacion.llevaFinanciacion && data.operacion.montoFinanciado) {
      activeFinancings = [
        {
          id: 'legacy-fin',
          entidad: data.operacion.entidadFinanciera || 'Financiación',
          montoFinanciado: data.operacion.montoFinanciado,
          cuotas: data.operacion.cuotas,
          valorCuota: data.operacion.valorCuota,
          activo: true,
        },
      ];
    }

    // Filas dinámicas Cheque c/Bco
    const pRows = map.paymentRows || [
      { detailField: 'Text28', amountField: 'Text20' },
      { detailField: 'Text29', amountField: 'Text21' },
      { detailField: 'Text30', amountField: 'Text22' },
      { detailField: 'Text31', amountField: 'Text23' },
      { detailField: 'Text32', amountField: 'Text24' },
      { detailField: 'Text33', amountField: 'Text25' },
    ];

    pRows.forEach((row, idx) => {
      if (idx < activeFinancings.length) {
        const fin = activeFinancings[idx];
        const entidad = toBoletoText(fin.entidad);
        const montoStr = this.formatMoneyForPdf(fin.montoFinanciado);
        if (row.detailField) {
          addCheck(row.detailField, `Cheque c/Bco Fila ${idx + 1} - Entidad (${row.detailField})`, entidad);
        }
        addCheck(row.amountField, `Cheque c/Bco Fila ${idx + 1} - Monto (${row.amountField})`, montoStr);
      } else {
        if (row.detailField) {
          addCheck(row.detailField, `Cheque c/Bco Fila ${idx + 1} - Entidad (Vacía)`, '');
        }
        addCheck(row.amountField, `Cheque c/Bco Fila ${idx + 1} - Monto (Vacía)`, '');
      }
    });

    // Banco que financia, Text34 y Text35 deben quedar estrictamente vacíos
    addCheck(map.operacionBancoFinancia, 'Banco que financia (Vacío)', '');
    addCheck(map.operacionCuotas, 'Cuotas Financiación (Text34 - Vacío)', '');
    addCheck(map.operacionValorCuota, 'Valor de Cuota (Text35 - Vacío)', '');

    // Gestoría -> Patentamiento
    addCheck(
      map.gestoriaPatentamiento || 'undefined_9',
      'Gestoría - Patentamiento (Transferencia calculada)',
      data.operacion.patentamiento && data.operacion.patentamiento > 0 ? this.formatMoneyForPdf(data.operacion.patentamiento) : ''
    );

    if (map.operacionNumeroComprobante) {
      addCheck(map.operacionNumeroComprobante, 'N° Comprobante (Text1 - Vacío en V2)', '');
    }

    if (data.entregaUsado.enabled) {
      addCheck(map.usadoValorToma, 'Usado Valor Toma (Text11)', this.formatMoneyForPdf(data.entregaUsado.valorToma));
      addCheck(map.usadoModelo, 'Usado Modelo (Modelo_2)', toBoletoText(data.entregaUsado.modelo));
      addCheck(map.usadoAnio, 'Usado Año (Text37)', data.entregaUsado.anio ? String(data.entregaUsado.anio) : '');
      addCheck(map.usadoDominio, 'Usado Dominio (Dominio_2)', toBoletoText(data.entregaUsado.patente));
      addCheck(map.usadoMotor, 'Usado Motor (Motor_2)', toBoletoText(data.entregaUsado.motor));
      addCheck(map.usadoChasis, 'Usado Chasis (Chasis_2)', toBoletoText(data.entregaUsado.chasis));
    }

    const matched = items.filter(x => x.fieldFoundInPdf).length;
    const missing = items.filter(x => !x.fieldFoundInPdf).length;

    return {
      company: companyKey,
      templateName: config.templateFileName,
      totalFieldsInPdf: pdfFields.length,
      mappedFieldsCount: items.length,
      matchedFieldsCount: matched,
      missingFieldsCount: missing,
      fields: items,
    };
  }

  /**
   * Sanitiza el nombre de archivo para la descarga
   */
  getSanitizedFilename(companyKey: BoletoCompanyKey, clientLastName = 'CLIENTE', plate = 'PATENTE'): string {
    const cleanCompany = companyKey.replace(/[^A-Z0-9]/g, '_');
    const cleanLastName = (clientLastName || 'CLIENTE')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 20);

    const cleanPlate = (plate || 'SIN_PATENTE')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    return `BOLETO_${cleanCompany}_${cleanLastName}_${cleanPlate}.pdf`;
  }

  /**
   * Alias de inspectFields para inspección de campos
   */
  async inspectTemplateFields(
    companyKey: BoletoCompanyKey,
    data: BoletoData,
    customTemplateBytes?: Uint8Array
  ): Promise<BoletoDiagnosticReport> {
    return this.inspectFields(companyKey, data, customTemplateBytes);
  }
}

export const boletoPdfService = new BoletoPdfService();
