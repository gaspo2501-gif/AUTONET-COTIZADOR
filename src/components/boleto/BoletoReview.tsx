import React from 'react';
import { CheckCircle2, AlertTriangle, FileCode2, Copy, Check } from 'lucide-react';
import { BoletoDiagnosticReport } from '../../types/boleto';

interface BoletoReviewProps {
  report: BoletoDiagnosticReport | null;
  loading: boolean;
}

export const BoletoReview: React.FC<BoletoReviewProps> = ({ report, loading }) => {
  const [copied, setCopied] = React.useState(false);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold">Analizando campos AcroForm del documento...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs">
        No hay reporte de diagnóstico disponible.
      </div>
    );
  }

  const handleCopyRaw = () => {
    const text = report.fields
      .map((f) => `${f.pdfFieldName}: ${f.valueToApply || '(vacío)'}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-xl overflow-hidden text-slate-800">
      {/* Header del Diagnóstico */}
      <div className="p-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Revisión de Campos AcroForm (Uso Interno)
            </h4>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-bold border border-blue-200">
              {report.company}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Plantilla: <span className="font-mono text-slate-700">{report.templateName}</span> • Total campos PDF: {report.totalFieldsInPdf}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopyRaw}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? '¡Copiado!' : 'Copiar Diagnóstico'}</span>
        </button>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-slate-100/70 border-b border-slate-200 text-xs">
        <div className="bg-white p-2 rounded-lg border border-slate-200">
          <span className="block text-[10px] text-slate-500 uppercase font-bold">Campos Mapeados</span>
          <span className="font-mono font-bold text-slate-900 text-sm">{report.mappedFieldsCount}</span>
        </div>
        <div className="bg-white p-2 rounded-lg border border-slate-200">
          <span className="block text-[10px] text-emerald-600 uppercase font-bold">Encontrados en PDF</span>
          <span className="font-mono font-bold text-emerald-700 text-sm">{report.matchedFieldsCount}</span>
        </div>
        <div className="bg-white p-2 rounded-lg border border-slate-200">
          <span className="block text-[10px] text-amber-600 uppercase font-bold">No Detectados</span>
          <span className="font-mono font-bold text-amber-700 text-sm">{report.missingFieldsCount}</span>
        </div>
      </div>

      {/* Tabla detallada de mapeo */}
      <div className="flex-1 overflow-y-auto max-h-[500px]">
        <table className="w-full text-[11px] text-left border-collapse">
          <thead className="bg-slate-200/70 text-slate-700 sticky top-0 font-bold uppercase text-[10px] tracking-wider z-10">
            <tr>
              <th className="py-2 px-3">Campo AcroForm</th>
              <th className="py-2 px-3">Concepto Autonet</th>
              <th className="py-2 px-3">Valor que se Escribe</th>
              <th className="py-2 px-2 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {report.fields.map((f, idx) => {
              const hasValue = Boolean(f.valueToApply && f.valueToApply.trim());
              return (
                <tr key={`${f.pdfFieldName}-${idx}`} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 font-mono font-semibold text-blue-900">
                    {f.pdfFieldName}
                  </td>
                  <td className="py-2 px-3 text-slate-600">
                    {f.mappedConcept}
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-900">
                    {hasValue ? (
                      <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {f.valueToApply}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">(vacío)</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {f.fieldFoundInPdf ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        <AlertTriangle className="w-3 h-3" /> Opcional
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
