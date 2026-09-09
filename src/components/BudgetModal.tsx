import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Share2, 
  Check, 
  Car, 
  Clock, 
  FileText, 
  User, 
  Phone,
  CreditCard,
  MapPin
} from 'lucide-react';
import { CommercialBudget, quoteService } from '../services/quoteService';
import { formatCurrency } from '../utils/formatters';
import { ADVISOR_INFO } from '../constants/advisor';

interface BudgetModalProps {
  budget: CommercialBudget;
  onClose: () => void;
  onUpdateClientData?: (clientName: string, clientPhone: string) => void;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  budget,
  onClose,
  onUpdateClientData,
}) => {
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [clientName, setClientName] = useState(budget.datosCliente.nombre || '');
  const [clientPhone, setClientPhone] = useState(budget.datosCliente.telefono || '');
  const [isEditingClient, setIsEditingClient] = useState(false);

  // Formateadores de fecha y hora
  const emisionDate = new Date(budget.fechaEmision);
  const vencimientoDate = new Date(budget.fechaVencimiento);

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const currentBudget: CommercialBudget = {
    ...budget,
    datosCliente: {
      nombre: clientName.trim(),
      telefono: clientPhone.trim(),
    },
  };

  const handleCopyWhatsApp = () => {
    const text = quoteService.formatBudgetWhatsAppMessage(currentBudget);
    navigator.clipboard.writeText(text);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2200);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveClient = () => {
    if (onUpdateClientData) {
      onUpdateClientData(clientName, clientPhone);
    }
    setIsEditingClient(false);
  };

  const v = budget.vehiculo;
  const kmFormatted = new Intl.NumberFormat('es-AR').format(v.kilometraje);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs overflow-y-auto print:p-0 print:m-0 print:bg-white print:static print:overflow-visible">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-slate-200 print:max-w-none print:w-full print:border-none print:shadow-none print:rounded-none print:max-h-none print:h-auto">
        
        {/* Barra superior de control (oculta al imprimir) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-sm tracking-tight">Presupuesto Formal Autonet</span>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
              {budget.numeroPresupuesto}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
              title="Copiar texto para WhatsApp"
            >
              {copiedWhatsApp ? <Check className="w-3.5 h-3.5 text-white" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedWhatsApp ? '¡Copiado!' : 'Copiar WhatsApp'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white font-bold text-xs border border-slate-700 transition-colors"
              title="Imprimir o guardar en PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Imprimir / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
              title="Cerrar presupuesto"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENIDO DEL PRESUPUESTO FORMAL (Imprimible - 1 SOLA PÁGINA A4 ESTRICTA) */}
        <div 
          id="printable-budget" 
          className="p-6 sm:p-7 overflow-y-auto space-y-4 text-slate-800 print:p-6 print:overflow-visible print:space-y-3.5 print:max-w-[210mm] print:mx-auto"
        >
          
          {/* Encabezado Formal Autonet */}
          <div className="border-b-2 border-slate-900 pb-3.5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter">
                    AUTONET
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white tracking-wider">
                    USADOS SELECCIONADOS
                  </span>
                </div>
                <h2 className="text-xs font-black text-blue-700 tracking-wider mt-1 uppercase">
                  PRESUPUESTO COMERCIAL OFICIAL
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {ADVISOR_INFO.concesionaria} • {ADVISOR_INFO.direccion}, {ADVISOR_INFO.ciudad}
                </p>
              </div>

              <div className="text-left sm:text-right text-xs space-y-0.5 bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-lg border sm:border-0 border-slate-200">
                <div className="font-mono font-black text-slate-900 text-sm">
                  {budget.numeroPresupuesto}
                </div>
                <div className="text-slate-600 text-[11px]">
                  <span className="font-semibold">Emisión:</span> {formatDateTime(emisionDate)}
                </div>
                <div className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 print:border-none print:p-0 text-[11px]">
                  <Clock className="w-3 h-3 text-rose-600 print:hidden" />
                  <span>Válido por 24 horas</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Vence: <span className="font-semibold text-slate-700">{formatDateTime(vencimientoDate)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* DATOS DEL CLIENTE */}
          <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-200 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <div className="font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Datos del Cliente</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingClient(!isEditingClient)}
                className="text-blue-600 hover:text-blue-800 font-bold text-[11px] print:hidden"
              >
                {isEditingClient ? 'Cerrar' : (clientName ? 'Modificar' : '+ Asignar cliente')}
              </button>
            </div>

            {isEditingClient ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 print:hidden">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre completo:</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Teléfono:</label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ej. 299 1234567"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveClient}
                    className="px-3 py-1 rounded-md bg-blue-600 text-white font-bold text-xs"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-slate-700 text-xs">
                <div>
                  <span className="text-slate-500">Nombre: </span>
                  <span className="font-bold text-slate-900">{clientName || 'Cliente en consulta / Mostrador'}</span>
                </div>
                {clientPhone && (
                  <div>
                    <span className="text-slate-500">Teléfono: </span>
                    <span className="font-semibold text-slate-900">{clientPhone}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DATOS DEL VEHÍCULO (Sin fotografías, sin datos internos) */}
          <div className="space-y-1.5">
            <div className="font-extrabold text-[11px] text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-slate-600" />
              <span>DATOS DEL VEHÍCULO</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-50 border-b border-slate-200">
                <div className="p-2 border-r border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Marca</span>
                  <span className="font-black text-slate-900 text-xs sm:text-sm">{v.marca}</span>
                </div>
                <div className="p-2 sm:border-r border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Modelo</span>
                  <span className="font-black text-slate-900 text-xs sm:text-sm">{v.modelo}</span>
                </div>
                <div className="p-2 border-r border-slate-200 border-t sm:border-t-0">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Año</span>
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">{v.anio}</span>
                </div>
                <div className="p-2 border-t sm:border-t-0">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Patente</span>
                  <span className="font-mono font-black text-slate-900 text-xs sm:text-sm tracking-wider">{v.patente}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 p-2 bg-white gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Versión</span>
                  <span className="font-semibold text-slate-800 text-xs">{v.version || 'Estándar'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Kilometraje</span>
                  <span className="font-semibold text-slate-800 text-xs">{kmFormatted} km</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Color</span>
                  <span className="font-semibold text-slate-800 text-xs">{v.color || 'A confirmar'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* VALORES DE LA OPERACIÓN */}
          <div className="space-y-1.5">
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs divide-y divide-slate-100">
              {/* Precio del vehículo */}
              <div className="p-2.5 sm:p-3 flex items-center justify-between bg-white">
                <span className="font-bold text-slate-800 text-xs sm:text-sm">Precio del vehículo</span>
                <span className="font-mono font-black text-slate-900 text-sm sm:text-base">
                  {formatCurrency(budget.precioVehiculo)}
                </span>
              </div>

              {/* Valor de la transferencia */}
              <div className="p-2.5 sm:p-3 flex items-center justify-between bg-white">
                <div>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm block">Valor de la transferencia</span>
                  <span className="text-[10px] text-slate-500">Estimativo - Radicación {budget.provincia}</span>
                </div>
                <span className="font-mono font-black text-emerald-700 text-sm sm:text-base">
                  {formatCurrency(budget.transferenciaEstimada)}
                </span>
              </div>

              {/* TOTAL ESTIMADO */}
              <div className="p-3 sm:p-3.5 bg-slate-900 text-white flex items-center justify-between print:bg-slate-100 print:text-slate-900 print:border-t-2 print:border-slate-900">
                <span className="font-black text-xs sm:text-sm uppercase tracking-wider">
                  TOTAL ESTIMADO
                </span>
                <span className="font-mono font-black text-lg sm:text-xl text-emerald-400 print:text-slate-900">
                  {formatCurrency(budget.totalEstimado)}
                </span>
              </div>
            </div>
          </div>

          {/* OPCIONES DE FINANCIACIÓN (Solo si fue solicitada y contiene opciones válidas) */}
          {budget.financiacion?.llevaFinanciacion && budget.financiacion.opciones.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-extrabold text-[11px] text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <span>OPCIONES DE FINANCIACIÓN</span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs divide-y divide-slate-100 bg-white">
                <div className="grid grid-cols-3 bg-slate-100 p-2 font-black text-[10px] text-slate-600 uppercase">
                  <span>Entidad</span>
                  <span className="text-center">Plan de Cuotas</span>
                  <span className="text-right">Monto Estimado</span>
                </div>

                {budget.financiacion.opciones.map((opc) => (
                  <div key={opc.id} className="grid grid-cols-3 p-2 items-center hover:bg-slate-50 transition-colors">
                    <div>
                      <span className="font-black text-slate-900 block text-xs">{opc.entidad}</span>
                      {opc.detalle && (
                        <span className="text-[10px] text-slate-500 block">{opc.detalle}</span>
                      )}
                    </div>
                    <span className="text-center font-bold text-slate-700 text-xs">
                      {opc.cuotas} cuotas
                    </span>
                    <span className="text-right font-mono font-black text-blue-700 text-xs sm:text-sm">
                      {formatCurrency(opc.montoCuota)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACLARACIÓN Y VALIDEZ */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-0.5">
              <Clock className="w-3 h-3 text-blue-600" />
              <span>Validez del presupuesto: 24 horas.</span>
            </div>
            <p className="italic text-slate-500">
              "El valor de la transferencia es estimativo y puede variar según los costos y conceptos aplicables al momento de realizar la liquidación definitiva en el Registro Seccional correspondiente."
            </p>
          </div>

          {/* FIRMA FIJA DEL ASESOR COMERCIAL AUTONET */}
          <div className="pt-3 border-t-2 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-700">
            <div>
              <div className="font-black text-slate-900 text-sm tracking-tight">
                {ADVISOR_INFO.nombre}
              </div>
              <div className="text-xs font-semibold text-blue-700">
                {ADVISOR_INFO.cargo}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{ADVISOR_INFO.direccion}, {ADVISOR_INFO.ciudad}, {ADVISOR_INFO.provincia}, {ADVISOR_INFO.pais}</span>
              </div>
            </div>

            <div className="font-mono text-xs font-bold text-slate-900 flex items-center gap-1 bg-slate-100 sm:bg-transparent px-2 py-1 rounded">
              <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Tel: {ADVISOR_INFO.telefono}</span>
            </div>
          </div>

        </div>

        {/* Footer con Acciones (oculto en impresión) */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-xs transition-colors shadow-xs"
            >
              {copiedWhatsApp ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedWhatsApp ? '¡Copiado para WhatsApp!' : 'COPIAR PARA WHATSAPP'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>IMPRIMIR / GUARDAR PDF</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};

