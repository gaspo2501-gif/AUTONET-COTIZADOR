import React, { useState } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { 
  X, 
  Printer, 
  Share2, 
  Check, 
  FileText, 
  User,
  Phone,
  Edit2,
  FileCheck2
} from 'lucide-react';
import { CommercialBudget, quoteService } from '../services/quoteService';
import { QuoteDocument } from './QuoteDocument';
import { BoletoModal } from './boleto/BoletoModal';

interface BudgetModalProps {
  budget: CommercialBudget;
  onClose: () => void;
  onUpdateClientData?: (clientName: string, clientPhone: string) => void;
}

/** Escala la hoja A4 (210mm ≈ 794px) para que entre completa en pantallas angostas. */
const ScaledA4: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / 796));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="w-full">
      <div className="mx-auto overflow-hidden rounded-lg shadow-md border border-slate-300 bg-white" style={{ width: 796 * scale, height: 1125 * scale }}>
        <div style={{ width: 796, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
    </div>
  );
};

export const BudgetModal: React.FC<BudgetModalProps> = ({
  budget,
  onClose,
  onUpdateClientData,
}) => {
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [clientName, setClientName] = useState(budget.datosCliente.nombre || '');
  const [clientPhone, setClientPhone] = useState(budget.datosCliente.telefono || '');
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [isBoletoOpen, setIsBoletoOpen] = useState(false);

  // Escape para cerrar + bloqueo del scroll de fondo
  useModalBehavior(isBoletoOpen ? undefined : onClose);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Barra superior de control */}
        <div className="px-3 sm:px-5 py-3 sm:py-3.5 bg-white text-slate-900 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="hidden sm:flex w-7 h-7 rounded-lg bg-red-50 text-red-600 border border-red-200 items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <span className="hidden sm:inline font-bold text-sm tracking-tight text-slate-900">Presupuesto Formal Autonet</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono border border-slate-200">
              {budget.numeroPresupuesto}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
              title="Copiar texto para WhatsApp"
            >
              {copiedWhatsApp ? <Check className="w-3.5 h-3.5 text-white" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedWhatsApp ? '¡Copiado!' : <><span className="sm:hidden">WhatsApp</span><span className="hidden sm:inline">Copiar WhatsApp</span></>}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
              title="Imprimir o guardar como PDF (1 hoja A4)"
            >
              <Printer className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">Imprimir / PDF</span><span className="sm:hidden">PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1 cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de asignación de cliente rápida */}
        <div className="bg-slate-100 px-5 py-2 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-slate-700">
            <span className="font-semibold flex items-center gap-1 text-slate-500">
              <User className="w-3.5 h-3.5" /> Cliente:
            </span>
            <span className="font-bold text-slate-900">
              {clientName || 'Sin asignar (Mostrador)'}
            </span>
            {clientPhone && (
              <span className="text-slate-500 flex items-center gap-1">
                <Phone className="w-3 h-3" /> {clientPhone}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsEditingClient(!isEditingClient)}
            className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 text-[11px]"
          >
            <Edit2 className="w-3 h-3" />
            {isEditingClient ? 'Ocultar edición' : (clientName ? 'Modificar datos' : 'Asignar cliente')}
          </button>
        </div>

        {/* Panel desplegable de edición de cliente */}
        {isEditingClient && (
          <div className="bg-slate-50 p-4 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nombre y Apellido:</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Teléfono:</label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Ej. 299 1234567"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveClient}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
              >
                Actualizar Presupuesto
              </button>
            </div>
          </div>
        )}

        {/* VISTA PREVIA DEL DOCUMENTO A4 (Exactamente el mismo documento que se imprime) */}
        <div className="flex-1 overflow-auto p-2 sm:p-6 bg-slate-200/80">
          <ScaledA4>
            <QuoteDocument
              vehicle={budget.vehiculo}
              vehiclePrice={budget.precioVehiculo}
              transferValue={budget.transferenciaEstimada}
              total={budget.totalEstimado}
              financingOptions={budget.financiacion?.opciones}
              quoteDate={budget.fechaEmision}
              validUntil={budget.fechaVencimiento}
              clientName={clientName}
              clientPhone={clientPhone}
              advisor={budget.datosAsesor}
            />
          </ScaledA4>
        </div>

        {/* Footer con botones de acción rápida */}
        <div className="px-3 sm:px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="hidden sm:block text-xs text-slate-500 font-medium">
            Formato certificado de 1 sola página A4 vertical.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-budget-generar-boleto"
              onClick={() => setIsBoletoOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-xs transition-colors shadow-xs cursor-pointer"
              title="Generar Boleto Oficial Autonet de 2 páginas con los datos de esta cotización"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>GENERAR BOLETO</span>
            </button>

            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedWhatsApp ? '¡Copiado!' : <><span className="sm:hidden">WhatsApp</span><span className="hidden sm:inline">Copiar WhatsApp</span></>}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>IMPRIMIR / PDF</span>
            </button>
          </div>
        </div>

      </div>

      {/* Modal de Boleto de Compraventa Oficial */}
      {isBoletoOpen && (
        <BoletoModal
          isOpen={isBoletoOpen}
          onClose={() => setIsBoletoOpen(false)}
          vehicle={budget.vehiculo}
          budget={currentBudget}
          financingAlternatives={budget.financiacion?.opciones}
        />
      )}
    </div>
  );
};
