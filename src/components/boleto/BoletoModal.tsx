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
  Settings
} from 'lucide-react';
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
}

export const BoletoModal: React.FC<BoletoModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  budget,
  financingAlternatives = [],
  sellerName = '',
}) => {
  if (!isOpen || !vehicle) return null;

  const companyKey = resolveCompanyFromVehicle(vehicle);
  const templateConfig = companyKey ? BOLETO_TEMPLATES_CONFIG[companyKey] : null;

  const [activeTab, setActiveTab] = useState<'editor' | 'review'>('editor');
  const [customTemplateBytes, setCustomTemplateBytes] = useState<Uint8Array | undefined>(undefined);
  const [customTemplateName, setCustomTemplateName] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAdvancedMenu, setShowAdvancedMenu] = useState(false);

  // Inicialización de datos del boleto con la fecha actual en formato visible DD/MM/AAAA
  const [boletoData, setBoletoData] = useState<BoletoData>(() => {
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
          montoFinanciado: Math.round(precioUnidad * 0.5),
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
  });

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
  const handleDownloadPdf = async () => {
    if (!companyKey) return;
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
    } catch (err: any) {
      console.error('Error al descargar el PDF:', err);
      const isTemplateError = err.message && (err.message.includes('plantilla') || err.message.includes('fetch') || err.message.includes('404'));
      setActionError(isTemplateError ? 'No se pudo cargar la plantilla oficial de esta empresa.' : (err.message || 'Error al descargar el PDF'));
    } finally {
      setIsActionLoading(false);
    }
  };

  // Impresión directa del PDF oficial
  const handlePrintPdf = async () => {
    if (!companyKey) return;
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
    } catch (err: any) {
      console.error('Error al imprimir el PDF:', err);
      const isTemplateError = err.message && (err.message.includes('plantilla') || err.message.includes('fetch') || err.message.includes('404'));
      setActionError(isTemplateError ? 'No se pudo cargar la plantilla oficial de esta empresa.' : (err.message || 'Error al imprimir el PDF'));
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
            <div className="max-w-4xl mx-auto">
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
                  onClick={handlePrintPdf}
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
                  onClick={handleDownloadPdf}
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
