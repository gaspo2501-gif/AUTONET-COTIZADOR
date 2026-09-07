import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Share2, 
  Check, 
  Car, 
  ShieldCheck, 
  Clock, 
  FileText, 
  Building2, 
  User, 
  Phone,
  AlertCircle
} from 'lucide-react';
import { CommercialBudget, quoteService } from '../services/quoteService';
import { formatCurrency } from '../utils/formatters';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-slate-200 print:max-w-none print:w-full print:border-none print:shadow-none print:rounded-none print:max-h-none">
        
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

        {/* CONTENIDO DEL PRESUPUESTO FORMAL (Imprimible) */}
        <div id="printable-budget" className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-800 print:p-8 print:overflow-visible">
          
          {/* Encabezado Formal */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    AUTONET
                  </h1>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                    USADOS SELECCIONADOS
                  </span>
                </div>
                <h2 className="text-sm font-extrabold text-slate-700 tracking-wide mt-1 uppercase">
                  PRESUPUESTO DE VEHÍCULO USADO
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {budget.datosAsesor.concesionaria} • {budget.datosAsesor.sucursal}
                </p>
              </div>

              <div className="text-left sm:text-right text-xs space-y-1 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-0 border-slate-200">
                <div className="font-mono font-bold text-slate-900 text-sm">
                  {budget.numeroPresupuesto}
                </div>
                <div className="text-slate-600">
                  <span className="font-medium">Emisión:</span> {formatDateTime(emisionDate)}
                </div>
                <div className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 print:border-none print:p-0">
                  <Clock className="w-3 h-3 text-rose-600 print:hidden" />
                  <span>Válido por 24 horas</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Válido hasta: <span className="font-semibold text-slate-700">{formatDateTime(vencimientoDate)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* DATOS DEL CLIENTE (Opcional) */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
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
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-slate-700">
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

          {/* DATOS DEL VEHÍCULO (Sin fotografías) */}
          <div className="space-y-2">
            <div className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-slate-600" />
              <span>DATOS DEL VEHÍCULO</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-50 border-b border-slate-200">
                <div className="p-2.5 border-r border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Marca</span>
                  <span className="font-black text-slate-900 text-sm">{v.marca}</span>
                </div>
                <div className="p-2.5 sm:border-r border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Modelo</span>
                  <span className="font-black text-slate-900 text-sm">{v.modelo}</span>
                </div>
                <div className="p-2.5 border-r border-slate-200 border-t sm:border-t-0">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Año</span>
                  <span className="font-bold text-slate-900 text-sm">{v.anio}</span>
                </div>
                <div className="p-2.5 border-t sm:border-t-0">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Patente</span>
                  <span className="font-mono font-black text-slate-900 text-sm tracking-wider">{v.patente}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 p-2.5 bg-white gap-3">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Versión</span>
                  <span className="font-semibold text-slate-800">{v.version || 'Estándar'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Kilometraje</span>
                  <span className="font-semibold text-slate-800">{kmFormatted} km</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Color</span>
                  <span className="font-semibold text-slate-800">{v.color || 'A confirmar'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* VALORES DE LA OPERACIÓN (Formato simple para el cliente: sin porcentajes, sin tabla DNRPA, sin fórmulas) */}
          <div className="space-y-2">
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs divide-y divide-slate-100">
              {/* Precio del vehículo */}
              <div className="p-3.5 flex items-center justify-between bg-white">
                <div>
                  <span className="font-bold text-slate-800 text-sm block">Precio del vehículo</span>
                </div>
                <span className="font-mono font-black text-slate-900 text-base">
                  {formatCurrency(budget.precioVehiculo)}
                </span>
              </div>

              {/* Valor de la transferencia */}
              <div className="p-3.5 flex items-center justify-between bg-white">
                <div>
                  <span className="font-bold text-slate-800 text-sm block">Valor de la transferencia</span>
                </div>
                <span className="font-mono font-black text-emerald-700 text-base">
                  {formatCurrency(budget.transferenciaEstimada)}
                </span>
              </div>

              {/* TOTAL ESTIMADO */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:bg-slate-100 print:text-slate-900 print:border-t-2 print:border-slate-900">
                <div>
                  <span className="font-black text-sm uppercase tracking-wider block">
                    TOTAL ESTIMADO
                  </span>
                </div>
                <span className="font-mono font-black text-xl sm:text-2xl text-emerald-400 print:text-slate-900">
                  {formatCurrency(budget.totalEstimado)}
                </span>
              </div>
            </div>
          </div>

          {/* ACLARACIÓN Y VALIDEZ (Secciones 20 y 21) */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2 text-slate-600 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Validez del presupuesto: 24 horas.</span>
            </div>
            <p className="italic text-slate-500">
              "El valor de la transferencia es estimativo y puede variar según la liquidación definitiva."
            </p>
          </div>

          {/* DATOS DEL ASESOR COMERCIAL */}
          <div className="pt-4 border-t border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-600">
            <div>
              <span className="font-bold text-slate-800 block">
                {budget.datosAsesor.nombre || 'Asesor Comercial'}
              </span>
              <span className="text-[11px] text-slate-500 block">
                {budget.datosAsesor.concesionaria} • {budget.datosAsesor.sucursal}
              </span>
            </div>

            {budget.datosAsesor.telefono && (
              <div className="font-mono text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400 print:hidden" />
                <span>Tel: {budget.datosAsesor.telefono}</span>
              </div>
            )}
          </div>

        </div>

        {/* Footer con Acciones (oculto en impresión) */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
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
              <span>IMPRIMIR / PDF</span>
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
