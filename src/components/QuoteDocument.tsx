import React from 'react';
import { FinancingOption } from '../services/quoteService';
import { Vehicle } from '../types/stock';
import { formatCurrency, formatKm } from '../utils/formatters';
import { ADVISOR_INFO } from '../constants/advisor';

export interface QuoteDocumentProps {
  vehicle: Vehicle;
  vehiclePrice: number;
  transferValue: number;
  total: number;
  financingOptions?: FinancingOption[];
  quoteDate?: string;
  validUntil?: string;
  advisor?: typeof ADVISOR_INFO;
  clientName?: string;
  clientPhone?: string;
}

/**
 * DOCUMENTO DE PRESUPUESTO COMERCIAL EXCLUSIVO — AUTONET
 * 
 * Diseñado estrictamente para 1 SOLA HOJA A4 vertical.
 * Independiente de la interfaz interna de cotización.
 * Sin inputs, sin botones, sin fórmulas DNRPA internas, sin scroll containers.
 */
export const QuoteDocument: React.FC<QuoteDocumentProps> = ({
  vehicle,
  vehiclePrice,
  transferValue,
  total,
  financingOptions = [],
  quoteDate,
  validUntil,
  advisor = ADVISOR_INFO,
  clientName,
  clientPhone,
}) => {
  const formattedDate = React.useMemo(() => {
    if (!quoteDate) {
      const now = new Date();
      return now.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
    const d = new Date(quoteDate);
    return isNaN(d.getTime())
      ? quoteDate
      : d.toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
  }, [quoteDate]);

  const vehicleTitle = `${vehicle.marca} ${vehicle.modelo} ${vehicle.version || ''}`.trim();
  const kmFormatted = formatKm(vehicle.kilometraje);

  return (
    <div 
      id="quote-document-a4" 
      className="quote-document bg-white text-slate-900 font-sans w-[210mm] max-w-[210mm] min-h-[297mm] max-h-[297mm] mx-auto p-[14mm] box-border flex flex-col justify-between shadow-xs print:shadow-none"
      style={{ width: '210mm', minHeight: '297mm', maxHeight: '297mm' }}
    >
      {/* 1. ENCABEZADO AUTONET */}
      <header className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-black tracking-tighter text-slate-950 font-sans">
              AUTONET
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white tracking-widest uppercase">
              Usados Seleccionados
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Concesionario Oficial • Neuquén y Río Negro
          </p>
        </div>

        <div className="text-right">
          <div className="text-sm font-black uppercase tracking-wider text-blue-700">
            PRESUPUESTO
          </div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">
            Fecha: <strong className="text-slate-900">{formattedDate}</strong>
          </div>
          {clientName && (
            <div className="text-xs text-slate-600 mt-1">
              Cliente: <strong className="text-slate-900">{clientName}</strong>
              {clientPhone && <span className="text-slate-400"> ({clientPhone})</span>}
            </div>
          )}
        </div>
      </header>

      {/* 2. VEHÍCULO */}
      <section className="mb-6">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          Vehículo
        </div>
        <div className="text-xl font-black text-slate-900 tracking-tight mb-2">
          {vehicleTitle}
        </div>
        
        <div className="grid grid-cols-3 gap-3 py-2.5 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Año</span>
            <strong className="text-slate-800 text-sm">{vehicle.anio}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Kilometraje</span>
            <strong className="text-slate-800 text-sm">{kmFormatted}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Patente</span>
            <strong className="font-mono text-slate-950 text-sm tracking-wider">{vehicle.patente}</strong>
          </div>
        </div>
      </section>

      {/* 3. DETALLE ECONÓMICO */}
      <section className="mb-6 border-t border-slate-200 pt-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-1 text-slate-700">
            <span className="font-medium">VALOR DEL VEHÍCULO</span>
            <strong className="font-mono text-base text-slate-900">
              {formatCurrency(vehiclePrice, vehicle.moneda || 'ARS')}
            </strong>
          </div>

          <div className="flex items-center justify-between py-1 text-slate-700">
            <span className="font-medium">VALOR DE TRANSFERENCIA (Estimado)</span>
            <strong className="font-mono text-base text-slate-800">
              {formatCurrency(transferValue, vehicle.moneda || 'ARS')}
            </strong>
          </div>

          <div className="flex items-center justify-between py-3 px-3.5 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 mt-2">
            <div>
              <span className="font-black text-sm text-blue-900 uppercase tracking-tight block">
                TOTAL ESTIMADO
              </span>
              <span className="text-[10px] text-blue-700 font-medium">
                (Unidad + Transferencia estimada)
              </span>
            </div>
            <strong className="font-mono text-2xl font-black text-blue-900">
              {formatCurrency(total, vehicle.moneda || 'ARS')}
            </strong>
          </div>
        </div>
      </section>

      {/* 4. FINANCIACIÓN (SOLO SI EXISTE) */}
      {financingOptions && financingOptions.length > 0 && (
        <section className="mb-6 border-t border-slate-200 pt-4">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
            Alternativas de Financiación
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2 px-3">Entidad</th>
                  <th className="py-2 px-3">Plazo</th>
                  <th className="py-2 px-3 text-right">Cuota Estimada</th>
                  <th className="py-2 px-3">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {financingOptions.map((opt, index) => (
                  <tr key={index} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-bold text-slate-900">{opt.entidad}</td>
                    <td className="py-2 px-3">{opt.cuotas} cuotas</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      aprox. {formatCurrency(opt.montoCuota, vehicle.moneda || 'ARS')}
                    </td>
                    <td className="py-2 px-3 text-slate-500 text-[11px]">{opt.observaciones || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 5. CONDICIONES Y VALIDEZ */}
      <section className="mb-6 border-t border-slate-200 pt-3.5 text-xs text-slate-500 space-y-1">
        <p className="font-semibold text-slate-700">
          • Presupuesto válido por 24 horas.
        </p>
        <p>
          • Los valores informados son estimativos y pueden variar al momento de formalizar la operación según aranceles oficiales vigentes y disponibilidad de la unidad.
        </p>
      </section>

      {/* 6. FIRMA DEL ASESOR COMERCIAL */}
      <footer className="border-t-2 border-slate-900 pt-3.5 mt-auto">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-bold text-sm text-slate-900">
              {advisor?.nombre || 'Gaspar Nicolau'}
            </div>
            <div className="text-xs text-slate-600 font-medium">
              {advisor?.cargo || 'Asesor comercial Autonet'}
            </div>
            <div className="text-xs font-mono font-bold text-slate-800 mt-0.5">
              2994290620
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Felix San Martin, 1650, NEUQUEN, Neuquén, Argentina
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold">
              Autonet Usados Seleccionados
            </div>
            <div className="text-xs font-bold text-slate-700">
              www.autonet.com.ar
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
