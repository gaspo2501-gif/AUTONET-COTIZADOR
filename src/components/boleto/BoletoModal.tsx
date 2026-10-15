import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  FileText, 
  AlertTriangle, 
  FileCode2, 
  Upload, 
  Printer,
  Download,
  Check,
  ArrowLeft,
  Loader2,
  Settings,
  ClipboardPaste,
  RotateCcw,
  CheckCircle2,
  Tag,
  XCircle,
} from 'lucide-react';
import { boletoHistoryService, BoletoRecord } from '../../services/boletoHistoryService';
import { validateBoleto, computeBoletoCuadre } from '../../utils/boletoValidation';
import { parseClientText } from '../../utils/clientParser';
import { isValidDni, suggestCuil } from '../../utils/argentinaIds';
import { appEvents } from '../../services/appEvents';
import { todayISO } from '../../utils/budgetAlerts';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { Vehicle } from '../../types/stock';
import { CommercialBudget, FinancingOption } from '../../services/quoteService';
import { BoletoData, BoletoCompanyKey, BoletoDiagnosticReport, BoletoFinancingEntry } from '../../types/boleto';
import { resolveCompanyFromVehicle, BOLETO_TEMPLATES_CONFIG } from '../../config/boletoTemplates';
import { boletoPdfService } from '../../services/boletoPdfService';
import { BoletoForm } from './BoletoForm';
import { BoletoReview } from './BoletoReview';

interface BoletoModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  budget?: CommercialBudget | null;
  financingAlternatives?: FinancingOption[];
  sellerName?: string;
  /** Datos de un boleto ya generado (para reabrirlo desde el historial). */
  initialData?: BoletoData;
}

export const BoletoModal: React.FC<BoletoModalProps> = (props) => {
  if (!props.isOpen || !props.vehicle) return null;
  return <BoletoModalInner {...props} vehicle={props.vehicle} />;
};

const BoletoModalInner: React.FC<BoletoModalProps & { vehicle: Vehicle }> = ({
  onClose,
  vehicle,
  budget,
  financingAlternatives = [],
  initialData,
}) => {

  const companyKey = resolveCompanyFromVehicle(vehicle);
  const templateConfig = companyKey ? BOLETO_TEMPLATES_CONFIG[companyKey] : null;

  const [activeTab, setActiveTab] = useState<'editor' | 'review'>('editor');
  const [customTemplateBytes, setCustomTemplateBytes] = useState<Uint8Array | undefined>(undefined);
  const [customTemplateName, setCustomTemplateName] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAdvancedMenu, setShowAdvancedMenu] = useState(false);

  // Borrador guardado en este dispositivo (si se cerró la ventana a mitad de la carga)
  const draftKey = (vehicle.patente || vehicle.id).toUpperCase();
  const [restoredDraftAt, setRestoredDraftAt] = useState<string | null>(() =>
    initialData ? null : boletoHistoryService.loadDraft(draftKey)?.savedAt || null
  );

  // Inicialización de datos del boleto con la fecha actual en formato visible DD/MM/AAAA
  const buildInitialData = (): BoletoData => {
    const today = new Date();
    const dia = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const mesesCortos = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const anio = String(yyyy).slice(-2);
    const formattedDate = `${dia}/${mm}/${yyyy}`; // dd/mm/aaaa

    const precioUnidad = vehicle.precioLista || budget?.precioVehiculo || 0;
    const totalOp = budget?.totalEstimado || precioUnidad;
    const clientName = budget?.datosCliente?.nombre || '';
    const clientPhone = budget?.datosCliente?.telefono || '';
    const transfCalculada = budget?.transferenciaEstimada || vehicle.costoTransferenciaEstimado || 0;

    // Lista de financiaciones iniciales
    const initialFinanciaciones: BoletoFinancingEntry[] = [];
    if (financingAlternatives && financingAlternatives.length > 0) {
      financingAlternatives.forEach((opt, idx) => {
        initialFinanciaciones.push({
          id: opt.id || `fin-init-${idx}`,
          entidad: opt.entidad,
          montoFinanciado: opt.montoFinanciado && opt.montoFinanciado > 0 ? opt.montoFinanciado : Math.round(precioUnidad * 0.5),
          cuotas: opt.cuotas,
          valorCuota: opt.montoCuota,
          activo: idx === 0,
        });
      });
    } else if (budget?.opcionSeleccionada) {
      initialFinanciaciones.push({
        id: 'fin-budget-sel',
        entidad: budget.opcionSeleccionada.entidad,
        montoFinanciado: Math.round(precioUnidad * 0.5),
        cuotas: budget.opcionSeleccionada.cuotas,
        valorCuota: budget.opcionSeleccionada.montoCuota,
        activo: true,
      });
    }

    const firstFinancing = initialFinanciaciones[0];
    const llevaFinanc = initialFinanciaciones.some((f) => f.activo);

    return {
      fechaOperacion: formattedDate,
      fechaDia: dia,
      fechaMes: mm, // Numérico estricto de 2 dígitos (ej: "09")
      fechaAnio: anio,
      lugarConcrecion: 'Neuquén',
      cliente: {
        nombreCompleto: clientName.toUpperCase(),
        dni: '',
        cuitCuil: '',
        nacimientoDia: '',
        nacimientoMes: '',
        nacimientoAnio: '',
        estadoCivil: '',
        conyugeNombre: '',
        conyugeDni: '',
        actividad: '',
        condicionIVA: 'Consumidor Final',
        direccion: '',
        localidad: 'Neuquén',
        provincia: 'Neuquén',
        codigoPostal: '8300',
        telefono: clientPhone,
        email: '',
      },
      operacion: {
        referenciaLista: `LISTA ${mesesCortos[today.getMonth()]} ${yyyy}`,
        precioVehiculo: precioUnidad,
        color: vehicle.color || '',
        numeroComprobante: undefined,
        sena: budget?.senia || 1000000,
        efectivoAdicional: 0,
        totalOperacion: totalOp,
        patentamiento: transfCalculada > 0 ? transfCalculada : undefined,
        llevaFinanciacion: llevaFinanc,
        financiaciones: initialFinanciaciones,
        entidadFinanciera: firstFinancing?.entidad || '',
        montoFinanciado: firstFinancing?.montoFinanciado || 0,
        bancoFinancia: '',
        cuotas: undefined,
        valorCuota: undefined,
      },
      unidadAdquirida: {
        descripcion: `${vehicle.marca} ${vehicle.modelo} ${vehicle.version}`.trim().toUpperCase(),
        anio: vehicle.anio,
        patente: vehicle.patente.trim().toUpperCase(),
        color: vehicle.color?.trim().toUpperCase() || '',
        stockInterno: vehicle.orden || '',
        motor: vehicle.motor || '',
        chasis: vehicle.chasis || '',
        fechaEntrega: '',
      },
      entregaUsado: {
        enabled: false,
        valorToma: 0,
        modelo: '',
        anio: undefined,
        patente: '',
        motor: '',
        chasis: '',
      },
      observaciones: '',
    };
  };

  const [boletoData, setBoletoData] = useState<BoletoData>(() => {
    if (initialData) return initialData;
    const draft = boletoHistoryService.loadDraft(draftKey);
    return draft?.data || buildInitialData();
  });

  // Guardado automático del borrador
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => boletoHistoryService.saveDraft(draftKey, boletoData), 500);
    return () => clearTimeout(t);
  }, [boletoData, draftKey]);

  const discardDraft = () => {
    boletoHistoryService.clearDraft(draftKey);
    setBoletoData(buildInitialData());
    setRestoredDraftAt(null);
    firstRender.current = true;
  };

  // Revisión de datos antes de generar
  const issues = React.useMemo(() => validateBoleto(boletoData), [boletoData]);
  const errorCount = issues.filter((i) => i.level === 'error').length;
  const warningCount = issues.length - errorCount;
  const [forceGenerate, setForceGenerate] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [generated, setGenerated] = useState<BoletoRecord | null>(null);

  // Pegar datos del cliente
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteResult, setPasteResult] = useState<string | null>(null);
  const applyPaste = () => {
    const found = parseClientText(pasteText);
    const keys = Object.keys(found) as (keyof typeof found)[];
    if (keys.length === 0) {
      setPasteResult('No encontré datos reconocibles. Probá con etiquetas como "DNI:", "Domicilio:", "Tel:".');
      return;
    }
    setBoletoData((prev) => ({ ...prev, cliente: { ...prev.cliente, ...found } }));
    const labels: Record<string, string> = {
      nombreCompleto: 'nombre', dni: 'DNI', cuitCuil: 'CUIT/CUIL', telefono: 'teléfono', email: 'email', direccion: 'domicilio',
      localidad: 'localidad', codigoPostal: 'CP', nacimientoDia: 'nacimiento', estadoCivil: 'estado civil', actividad: 'actividad',
    };
    setPasteResult(`Completé: ${keys.map((k) => labels[k as string]).filter(Boolean).join(', ')}. Revisalos abajo.`);
    setPasteText('');
  };
  const cuilSuggestions = React.useMemo(() => {
    const c = boletoData.cliente;
    if (c.cuitCuil?.trim() || !isValidDni(c.dni)) return [];
    return [suggestCuil(c.dni || '', 'M'), suggestCuil(c.dni || '', 'F')].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
  }, [boletoData.cliente]);

  useModalBehavior(onClose);

  const recordGenerated = () => {
    const rec = boletoHistoryService.save({
      companyKey: companyKey!,
      vehiculo: { patente: vehicle.patente, marca: vehicle.marca, modelo: vehicle.modelo, version: vehicle.version, anio: vehicle.anio, empresa: vehicle.empresa },
      clienteNombre: boletoData.cliente.nombreCompleto || 'SIN NOMBRE',
      clienteDni: boletoData.cliente.dni,
      total: computeBoletoCuadre(boletoData).total,
      data: boletoData,
      generadoConAdvertencias: issues.length > 0,
    });
    setGenerated(rec);
  };

  /** Bloquea la generación si hay errores, salvo que el asesor confirme "generar igual". */
  const guard = (action: () => Promise<boolean>) => async () => {
    if (errorCount > 0 && !forceGenerate) {
      setShowIssues(true);
      return;
    }
    const ok = await action();
    if (ok) recordGenerated();
  };

  const registerSale = () => {
    const d = boletoData;
    const activas = (d.operacion.financiaciones || []).filter((f) => f.activo);
    appEvents.requestRegisterSale({
      patente: vehicle.patente,
      prefill: {
        precioRealVenta: Number(d.operacion.precioVehiculo) || vehicle.precio || 0,
        soldAt: todayISO(),
        tieneTomaUsado: d.entregaUsado.enabled,
        valorTomaUsado: d.entregaUsado.enabled ? Number(d.entregaUsado.valorToma) || 0 : undefined,
        marcaModeloTomaUsado: d.entregaUsado.enabled ? d.entregaUsado.modelo || undefined : undefined,
        patenteTomaUsado: d.entregaUsado.enabled ? d.entregaUsado.patente || undefined : undefined,
        usaCredinet: activas.some((f) => /credinet|wunder/i.test(f.entidad || '')),
      },
    });
    boletoHistoryService.clearDraft(draftKey);
    onClose();
  };

  const [diagnosticReport, setDiagnosticReport] = useState<BoletoDiagnosticReport | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [templateStatus, setTemplateStatus] = useState<any>(null);
  const [isVerifyingTemplate, setIsVerifyingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verificación estricta de la plantilla base al abrir el modal o cambiar de empresa
  useEffect(() => {
    if (companyKey && (templateConfig?.available || customTemplateBytes)) {
      setIsVerifyingTemplate(true);
      if (customTemplateBytes) {
        boletoPdfService
          .inspectTemplateBytes(companyKey, customTemplateBytes)
          .then((status) => {
            setTemplateStatus(status);
            if (!status.isValid) {
              setActionError(status.errorMessage || 'ERROR: La plantilla oficial no coincide con el documento original autorizado.');
            } else {
              setActionError(null);
            }
          })
          .catch((err) => console.error('Error al verificar plantilla:', err))
          .finally(() => setIsVerifyingTemplate(false));
      } else {
        boletoPdfService
          .checkCurrentTemplateStatus(companyKey)
          .then((status) => {
            setTemplateStatus(status);
            if (!status.isValid) {
              setActionError(status.errorMessage || 'ERROR: La plantilla oficial no coincide con el documento original autorizado.');
            } else {
              setActionError(null);
            }
          })
          .catch((err) => console.error('Error al verificar plantilla:', err))
          .finally(() => setIsVerifyingTemplate(false));
      }
    }
  }, [companyKey, customTemplateBytes, templateConfig?.available]);

  // Diagnóstico de campos cuando se abre la pestaña de revisión
  useEffect(() => {
    if (activeTab === 'review' && companyKey && (templateConfig?.available || customTemplateBytes)) {
      setDiagnosticsLoading(true);
      boletoPdfService
        .inspectTemplateFields(companyKey, boletoData, customTemplateBytes)
        .then((rep) => setDiagnosticReport(rep))
        .catch((err) => console.error('Error obteniendo diagnóstico:', err))
        .finally(() => setDiagnosticsLoading(false));
    }
  }, [activeTab, boletoData, companyKey, customTemplateBytes, templateConfig?.available]);

  // Manejo de carga de plantilla autorizada
  const handleCustomTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyKey) return;

    try {
      setIsActionLoading(true);
      setActionError(null);
      const arrayBuffer = await file.arrayBuffer();
      const rawBytes = new Uint8Array(arrayBuffer);
      const status = await boletoPdfService.saveAuthorizedTemplate(companyKey, rawBytes, file.name);
      setCustomTemplateBytes(rawBytes);
      setCustomTemplateName(file.name);
      setTemplateStatus(status);

      if (!status.isValid) {
        setActionError(status.errorMessage || 'ERROR: La plantilla oficial no coincide con el documento original autorizado.');
      } else {
        setActionError(null);
      }
    } catch (err: any) {
      setActionError(`Error al cargar la plantilla: ${err.message}`);
    } finally {
      setIsActionLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Descarga directa de la plantilla base sin pasar por pdf-lib (Requisito 11)
  const handleDownloadRawBaseTemplate = async () => {
    if (!companyKey) return;
    try {
      setIsActionLoading(true);
      await boletoPdfService.downloadRawBaseTemplate(companyKey);
    } catch (err: any) {
      setActionError(err.message || 'Error al descargar la plantilla base');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Descarga directa del PDF oficial completado
  const handleDownloadPdf = async (): Promise<boolean> => {
    if (!companyKey) return false;
    try {
      setIsActionLoading(true);
      setActionError(null);
      const pdfBytes = await boletoPdfService.generateBoletoPdf(companyKey, boletoData, customTemplateBytes);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const fileName = boletoPdfService.getSanitizedFilename(
        companyKey,
        boletoData.cliente.nombreCompleto || 'CLIENTE',
        vehicle.patente || 'UNIDAD'
      );

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
      return true;
    } catch (err: any) {
      console.error('Error al descargar el PDF:', err);
      const isTemplateError = err.message && (err.message.includes('plantilla') || err.message.includes('fetch') || err.message.includes('404'));
      setActionError(isTemplateError ? 'No se pudo cargar la plantilla oficial de esta empresa.' : (err.message || 'Error al descargar el PDF'));
      return false;
    } finally {
      setIsActionLoading(false);
    }
  };

  // Impresión directa del PDF oficial
  const handlePrintPdf = async (): Promise<boolean> => {
    if (!companyKey) return false;
    try {
      setIsActionLoading(true);
      setActionError(null);
      const pdfBytes = await boletoPdfService.generateBoletoPdf(companyKey, boletoData, customTemplateBytes);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = blobUrl;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Error en iframe print, abriendo ventana alternativa:', e);
          window.open(blobUrl, '_blank');
        }
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          URL.revokeObjectURL(blobUrl);
        }, 3000);
      };
      return true;
    } catch (err: any) {
      console.error('Error al imprimir el PDF:', err);
      const isTemplateError = err.message && (err.message.includes('plantilla') || err.message.includes('fetch') || err.message.includes('404'));
      setActionError(isTemplateError ? 'No se pudo cargar la plantilla oficial de esta empresa.' : (err.message || 'Error al imprimir el PDF'));
      return false;
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* ENCABEZADO CON EMPRESA / PATENTE / UNIDAD */}
        <div className="px-5 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black tracking-tight text-white uppercase">
                  Generar Boleto de Compraventa
                </h3>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {templateConfig?.displayName || 'EMPRESA NO RECONOCIDA'}
                </span>
                <span className="text-[11px] font-mono text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded border border-slate-700 font-bold">
                  {vehicle.patente} • {vehicle.marca} {vehicle.modelo} {vehicle.version || ''}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Completado en plantilla oficial de 2 páginas con datos cargados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Input oculto para carga de plantilla en opciones avanzadas / fallback */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleCustomTemplateUpload}
              className="hidden"
            />

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SUBHEADER: Aviso de plantilla personalizada cargada */}
        {customTemplateName && (
          <div className="bg-emerald-50 px-5 py-2 border-b border-emerald-200 flex items-center justify-between text-xs text-emerald-800 font-medium">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              Usando plantilla personalizada: <strong>{customTemplateName}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setCustomTemplateBytes(undefined);
                setCustomTemplateName(null);
              }}
              className="text-emerald-900 underline text-[11px] font-bold cursor-pointer"
            >
              Restablecer plantilla del sistema
            </button>
          </div>
        )}

        {/* ESTADO DE VALIDACIÓN DEL DOCUMENTO ORIGINAL AUTORIZADO */}
        {templateStatus && !templateStatus.isValid && (
          <div className="bg-amber-50 px-5 py-3 border-b border-amber-200 text-xs text-amber-900">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-amber-200 text-amber-900 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="font-semibold text-xs text-amber-950">
                No se pudo validar la plantilla oficial de esta empresa.
              </div>
            </div>
          </div>
        )}

        {/* PLANTILLA AUTORIZADA VERIFICADA CON ÉXITO */}
        {templateStatus && templateStatus.isValid && (
          <div className="bg-emerald-50 px-5 py-2 border-b border-emerald-200 flex items-center justify-between text-xs text-emerald-800 font-medium">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              Plantilla oficial autorizada verificada
            </span>
          </div>
        )}

        {/* MENSAJE DE ERROR GENÉRICO SI OCURRE */}
        {actionError && (!templateStatus || templateStatus.isValid) && (
          <div className="bg-red-50 px-5 py-2.5 border-b border-red-200 flex items-center gap-2 text-xs text-red-700 font-medium">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* CONTENIDO PRINCIPAL SEGÚN DISPONIBILIDAD DE EMPRESA */}
        {!companyKey || (!templateConfig?.available && !customTemplateBytes) ? (
          <div className="flex-1 p-8 sm:p-12 flex flex-col items-center justify-center text-center bg-slate-50">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h4 className="text-lg font-black text-slate-900 mb-2">
              No se pudo cargar la plantilla oficial de esta empresa.
            </h4>
            <p className="text-sm text-slate-600 max-w-lg mb-6 leading-relaxed">
              La empresa registrada en la unidad es <strong>{vehicle.empresa || '(vacía / no especificada)'}</strong>. 
              Por normas jurídicas y de trazabilidad, el sistema no sustituye plantillas entre distintas empresas.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
              >
                <Upload className="w-4 h-4" />
                <span>Cargar plantilla manualmente</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : activeTab === 'review' ? (
          /* TAB DE REVISIÓN / DIAGNÓSTICO DE CAMPOS */
          <div className="flex-1 p-5 sm:p-6 overflow-y-auto bg-slate-100 max-h-[calc(96vh-140px)]">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver al Formulario</span>
                </button>
                <span className="text-xs text-slate-500 font-mono">
                  Inspección de campos de plantilla: {templateConfig?.displayName}
                </span>
              </div>

              <BoletoReview
                report={diagnosticReport}
                loading={diagnosticsLoading}
              />
            </div>
          </div>
        ) : (
          /* FORMULARIO DE CARGA DIRECTO (SIN PREVIEW EMBEBIDO) */
          <div className="flex-1 p-5 sm:p-6 overflow-y-auto bg-slate-50/50 max-h-[calc(96vh-140px)]">
            <div className="max-w-4xl mx-auto space-y-3">
              {restoredDraftAt && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-action-50 border border-action-200 text-[12px] text-action-800">
                  <span>
                    Recuperé el borrador de este boleto ({new Date(restoredDraftAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}).
                  </span>
                  <button type="button" onClick={discardDraft} className="inline-flex items-center gap-1 font-bold hover:underline">
                    <RotateCcw className="w-3.5 h-3.5" /> Empezar de cero
                  </button>
                </div>
              )}

              {/* Pegar datos del cliente */}
              <div className="rounded-xl border border-slate-200 bg-white">
                <button type="button" onClick={() => setPasteOpen((o) => !o)} className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left">
                  <span className="inline-flex items-center gap-2 text-[13px] font-bold text-slate-800">
                    <ClipboardPaste className="w-4 h-4 text-action-600" /> Pegar datos del cliente
                  </span>
                  <span className="text-[11.5px] text-slate-500">Copiá el mensaje donde te pasó sus datos y pegalo acá</span>
                </button>
                {pasteOpen && (
                  <div className="px-3.5 pb-3.5 space-y-2">
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      rows={5}
                      placeholder={'Juan Carlos Pérez\nDNI 30.123.456\nCUIL 20-30123456-3\nDomicilio: Av. Argentina 1234, Neuquén\nTel 299 456-7890\nCasado, docente'}
                      className="field font-mono !text-[12px]"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={applyPaste} disabled={!pasteText.trim()} className="btn btn-sm btn-primary">
                        Completar datos
                      </button>
                      {pasteResult && <span className="text-[12px] text-slate-600">{pasteResult}</span>}
                    </div>
                  </div>
                )}
                {cuilSuggestions.length > 0 && (
                  <div className="px-3.5 pb-3 flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
                    <span>CUIL sugerido según el DNI:</span>
                    {cuilSuggestions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setBoletoData((prev) => ({ ...prev, cliente: { ...prev.cliente, cuitCuil: c } }))}
                        className="chip !py-1 font-mono"
                      >
                        {c}
                      </button>
                    ))}
                    <span className="text-slate-400">(confirmalo con el cliente)</span>
                  </div>
                )}
              </div>

              <BoletoForm
                data={boletoData}
                onChange={setBoletoData}
                companyKey={companyKey}
                financingAlternatives={financingAlternatives}
                isMirage={companyKey === 'MIRAGE'}
              />
            </div>
          </div>
        )}

        {/* REVISIÓN PREVIA / BOLETO GENERADO */}
        {companyKey && (templateConfig?.available || customTemplateBytes) && (
          generated ? (
            <div className="px-5 py-3 bg-emerald-50 border-t border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-emerald-900">
              <span className="inline-flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Boleto generado y guardado en el historial.
              </span>
              {vehicle.estado !== 'Vendido' && (
                <button type="button" onClick={registerSale} className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Tag className="w-3.5 h-3.5" /> Registrar la venta con estos datos
                </button>
              )}
            </div>
          ) : issues.length > 0 ? (
            <div className={`border-t text-[12.5px] ${errorCount ? 'bg-red-50 border-red-200 text-red-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
              <button type="button" onClick={() => setShowIssues((o) => !o)} className="w-full px-5 py-2.5 flex items-center justify-between gap-2 text-left font-bold">
                <span className="inline-flex items-center gap-2">
                  {errorCount ? <XCircle className="w-4 h-4 text-red-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                  Revisión: {errorCount > 0 && `${errorCount} error${errorCount > 1 ? 'es' : ''}`}
                  {errorCount > 0 && warningCount > 0 && ' · '}
                  {warningCount > 0 && `${warningCount} aviso${warningCount > 1 ? 's' : ''}`}
                </span>
                <span className="text-[11.5px] font-semibold underline">{showIssues ? 'Ocultar' : 'Ver detalle'}</span>
              </button>
              {showIssues && (
                <div className="px-5 pb-3 space-y-1.5 max-h-40 overflow-y-auto">
                  {issues.map((i, k) => (
                    <div key={k} className="flex items-start gap-2">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${i.level === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
                      <span>{i.message}</span>
                    </div>
                  ))}
                  {errorCount > 0 && (
                    <label className="flex items-center gap-2 pt-1.5 font-semibold cursor-pointer">
                      <input type="checkbox" checked={forceGenerate} onChange={(e) => setForceGenerate(e.target.checked)} />
                      Revisé los datos y quiero generar el boleto igual
                    </label>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-2 bg-emerald-50 border-t border-emerald-200 text-[12px] font-semibold text-emerald-800 inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Datos revisados: listo para generar.
            </div>
          )
        )}

        {/* BARRA INFERIOR CON LOS BOTONES EXCLUSIVOS SOLICITADOS:
            REVISAR CAMPOS | IMPRIMIR | DESCARGAR PDF | CERRAR */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {companyKey && (templateConfig?.available || customTemplateBytes) && (
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'review' ? 'editor' : 'review')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer border border-slate-300"
              >
                <FileCode2 className="w-4 h-4 text-slate-600" />
                <span>{activeTab === 'review' ? 'Volver al Formulario' : 'Revisar campos'}</span>
              </button>
            )}

            {/* Opciones avanzadas (Emergencia) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAdvancedMenu(!showAdvancedMenu)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
                title="Opciones avanzadas"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Opciones avanzadas</span>
              </button>

              {showAdvancedMenu && (
                <div className="absolute left-0 bottom-full mb-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 text-xs">
                  <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Herramientas de Emergencia
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdvancedMenu(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-medium text-left cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span>Cargar plantilla manualmente</span>
                  </button>
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={() => {
                      setShowAdvancedMenu(false);
                      handleDownloadRawBaseTemplate();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-medium text-left cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
                    <span>Descargar plantilla base</span>
                  </button>
                  {customTemplateBytes && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdvancedMenu(false);
                        setCustomTemplateBytes(undefined);
                        setCustomTemplateName(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium text-left cursor-pointer"
                    >
                      <X className="w-4 h-4 text-red-500" />
                      <span>Restablecer plantilla oficial</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {companyKey && (templateConfig?.available || customTemplateBytes) && (
              <>
                <button
                  type="button"
                  disabled={isActionLoading}
                  onClick={guard(handlePrintPdf)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                >
                  {isActionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Printer className="w-4 h-4 text-white" />
                  )}
                  <span>Imprimir</span>
                </button>

                <button
                  type="button"
                  disabled={isActionLoading}
                  onClick={guard(handleDownloadPdf)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                >
                  {isActionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Download className="w-4 h-4 text-white" />
                  )}
                  <span>Descargar PDF</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
