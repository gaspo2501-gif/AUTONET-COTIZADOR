import React, { useState } from 'react';
import { 
  History, 
  FileText, 
  Calendar, 
  PlusCircle, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp,
  Clock,
  ArrowRight
} from 'lucide-react';
import { UpdateHistoryRecord } from '../types/stock';
import { stockService } from '../services/stockService';
import { formatDate, formatCurrency } from '../utils/formatters';

export const UpdateHistoryView: React.FC = () => {
  const [history, setHistory] = useState<UpdateHistoryRecord[]>(() => stockService.getUpdateHistory());
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedRecordId(expandedRecordId === id ? null : id);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      
      {/* Cabecera */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <History className="w-6 h-6 text-amber-500" />
            <span>Historial de Actualizaciones</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Registro de cada lista PDF procesada y confirmada en el sistema de Autonet.
          </p>
        </div>

        <div className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          {history.length} {history.length === 1 ? 'registro' : 'registros'}
        </div>
      </div>

      {/* Lista de Registros */}
      {history.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
          <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">No hay actualizaciones registradas</h3>
          <p className="text-xs text-slate-400 mt-1">
            Los registros aparecerán aquí cada vez que cargue y confirme un nuevo PDF de Autonet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((record) => {
            const isExpanded = expandedRecordId === record.id;
            return (
              <div 
                key={record.id}
                className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden transition-all"
              >
                {/* Fila principal del registro */}
                <div 
                  onClick={() => toggleExpand(record.id)}
                  className="p-5 cursor-pointer hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                          {record.archivoNombre}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {record.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(record.fecha)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Resumen de cantidades */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                      {record.vehiculosEncontrados} leídos
                    </div>
                    {record.nuevos > 0 && (
                      <div className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                        <PlusCircle className="w-3 h-3" />
                        +{record.nuevos} nuevos
                      </div>
                    )}
                    {record.modificados > 0 && (
                      <div className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 font-bold flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        {record.modificados} modif.
                      </div>
                    )}
                    {record.cambiosPrecio > 0 && (
                      <div className="px-2.5 py-1 rounded-md bg-violet-100 text-violet-800 font-bold flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {record.cambiosPrecio} precios
                      </div>
                    )}
                    {record.noAparecen > 0 && (
                      <div className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {record.noAparecen} ausentes
                      </div>
                    )}

                    <div className="ml-2 text-slate-400">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Detalle desplegable si hay cambios registrados */}
                {isExpanded && record.cambiosDetectados && record.cambiosDetectados.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                      Detalle de unidades afectadas ({record.cambiosDetectados.length})
                    </h4>
                    
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {record.cambiosDetectados.map((item, index) => (
                        <div key={index} className="bg-white p-3 rounded-lg border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-white text-[11px]">
                              {item.patente}
                            </span>
                            <span className="font-semibold text-slate-800">{item.marcaModelo}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.tipo === 'nuevo' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : item.tipo === 'modificado'
                                ? 'bg-blue-100 text-blue-800'
                                : item.tipo === 'no_aparece'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {item.tipo.toUpperCase()}
                            </span>

                            {item.cambios && item.cambios.length > 0 && (
                              <div className="text-slate-600 text-[11px]">
                                {item.cambios.map((c, i) => (
                                  <span key={i} className="mr-2">
                                    {c.etiqueta}: {c.campo === 'precio' ? formatCurrency(c.valorNuevo) : c.valorNuevo}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
