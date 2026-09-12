import React from 'react';
import { 
  User, 
  Car, 
  DollarSign, 
  CreditCard, 
  Repeat, 
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  Info
} from 'lucide-react';
import { BoletoData, BoletoCompanyKey, BoletoFinancingEntry } from '../../types/boleto';
import { FinancingOption } from '../../services/quoteService';

interface BoletoFormProps {
  data: BoletoData;
  onChange: (updater: (prev: BoletoData) => BoletoData) => void;
  companyKey: BoletoCompanyKey;
  financingAlternatives?: FinancingOption[];
  isMirage?: boolean;
}

export const BoletoForm: React.FC<BoletoFormProps> = ({
  data,
  onChange,
  companyKey,
  financingAlternatives = [],
}) => {
  // Manejo de cambios en cliente
  const handleClientChange = (field: keyof BoletoData['cliente'], value: string) => {
    onChange((prev) => ({
      ...prev,
      cliente: {
        ...prev.cliente,
        [field]: value,
      },
    }));
  };

  // Manejo de cambios en operación
  const handleOperacionChange = (field: keyof BoletoData['operacion'], value: any) => {
    onChange((prev) => ({
      ...prev,
      operacion: {
        ...prev.operacion,
        [field]: value,
      },
    }));
  };

  // Manejo de cambios en unidad adquirida
  const handleUnidadChange = (field: keyof BoletoData['unidadAdquirida'], value: any) => {
    onChange((prev) => ({
      ...prev,
      unidadAdquirida: {
        ...prev.unidadAdquirida,
        [field]: value,
      },
    }));
  };

  // Manejo de cambios en usado entregado
  const handleUsadoChange = (field: keyof BoletoData['entregaUsado'], value: any) => {
    onChange((prev) => ({
      ...prev,
      entregaUsado: {
        ...prev.entregaUsado,
        [field]: value,
      },
    }));
  };

  // Manejo de colecciones de financiaciones múltiples (V2 Requisito 8 y 9)
  const handleAddFinancing = (prefill?: Partial<BoletoFinancingEntry>) => {
    const newEntry: BoletoFinancingEntry = {
      id: `fin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      entidad: prefill?.entidad || 'BNA',
      montoFinanciado: prefill?.montoFinanciado || 0,
      cuotas: prefill?.cuotas || 36,
      valorCuota: prefill?.valorCuota || 0,
      activo: prefill?.activo ?? true,
    };
    onChange((prev) => {
      const currentList = prev.operacion.financiaciones || [];
      const updatedList = [...currentList, newEntry];
      return {
        ...prev,
        operacion: {
          ...prev.operacion,
          financiaciones: updatedList,
          llevaFinanciacion: updatedList.some((f) => f.activo),
        },
      };
    });
  };

  const handleUpdateFinancing = (id: string, updates: Partial<BoletoFinancingEntry>) => {
    onChange((prev) => {
      const updatedList = (prev.operacion.financiaciones || []).map((f) =>
        f.id === id ? { ...f, ...updates } : f
      );
      return {
        ...prev,
        operacion: {
          ...prev.operacion,
          financiaciones: updatedList,
          llevaFinanciacion: updatedList.some((f) => f.activo),
        },
      };
    });
  };

  const handleRemoveFinancing = (id: string) => {
    onChange((prev) => {
      const updatedList = (prev.operacion.financiaciones || []).filter((f) => f.id !== id);
      return {
        ...prev,
        operacion: {
          ...prev.operacion,
          financiaciones: updatedList,
          llevaFinanciacion: updatedList.some((f) => f.activo),
        },
      };
    });
  };

  // Cálculo de cuadre de medios de pago (V2 Requisito 40)
  const sena = Number(data.operacion.sena) || 0;
  const efectivo = Number(data.operacion.efectivoAdicional) || 0;
  const valorUsado = data.entregaUsado.enabled ? (Number(data.entregaUsado.valorToma) || 0) : 0;
  const financiacionesList = data.operacion.financiaciones || [];
  const financiacionesActivas = financiacionesList.filter((f) => f.activo);
  const totalFinanciado = financiacionesActivas.reduce((acc, f) => acc + (Number(f.montoFinanciado) || 0), 0);

  const totalMediosPago = sena + efectivo + valorUsado + totalFinanciado;
  const totalOperacion = Number(data.operacion.totalOperacion || data.operacion.precioVehiculo) || 0;
  const diferenciaCuadre = totalMediosPago - totalOperacion;

  return (
    <div className="space-y-6 text-slate-800 text-xs">

      {/* CONTROL DE CUADRE DE MEDIOS DE PAGO (V2 Requisito 40) */}
      <div className={`p-3.5 rounded-xl border transition-all ${
        diferenciaCuadre === 0 && totalOperacion > 0
          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
          : diferenciaCuadre < 0
          ? 'bg-amber-50/80 border-amber-300 text-amber-950'
          : 'bg-blue-50/80 border-blue-300 text-blue-950'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {diferenciaCuadre === 0 && totalOperacion > 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : diferenciaCuadre < 0 ? (
              <AlertCircle className="w-4 h-4 text-amber-600" />
            ) : (
              <Info className="w-4 h-4 text-blue-600" />
            )}
            <span className="font-bold uppercase tracking-wider text-[11px]">
              Control de Medios de Pago vs. Total Operación
            </span>
          </div>

          <div className="text-right">
            {diferenciaCuadre === 0 && totalOperacion > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px]">
                ✔ Cuadre exacto (100%)
              </span>
            ) : diferenciaCuadre < 0 ? (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-600 text-white font-bold text-[10px]">
                ⚠ Diferencia pendiente: ${new Intl.NumberFormat('es-AR').format(Math.abs(diferenciaCuadre))}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[10px]">
                ℹ Excedente: ${new Intl.NumberFormat('es-AR').format(diferenciaCuadre)}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] font-mono pt-1 border-t border-slate-200/60">
          <div>
            <span className="block text-slate-500 font-sans uppercase">Seña:</span>
            <span className="font-bold">${new Intl.NumberFormat('es-AR').format(sena)}</span>
          </div>
          <div>
            <span className="block text-slate-500 font-sans uppercase">Efectivo:</span>
            <span className="font-bold">${new Intl.NumberFormat('es-AR').format(efectivo)}</span>
          </div>
          <div>
            <span className="block text-slate-500 font-sans uppercase">Toma Usado:</span>
            <span className="font-bold">${new Intl.NumberFormat('es-AR').format(valorUsado)}</span>
          </div>
          <div>
            <span className="block text-slate-500 font-sans uppercase">Financiación:</span>
            <span className="font-bold">${new Intl.NumberFormat('es-AR').format(totalFinanciado)}</span>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-white/70 px-2 py-0.5 rounded border border-slate-200">
            <span className="block text-slate-500 font-sans uppercase">Total Cubierto:</span>
            <span className="font-bold text-slate-900">${new Intl.NumberFormat('es-AR').format(totalMediosPago)}</span>
          </div>
        </div>
      </div>
      
      {/* 1. SECCIÓN FECHA DE OPERACIÓN (Único campo visible en V2) */}
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 mb-2 text-slate-700 font-bold">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="uppercase tracking-wider text-[11px]">Fecha de la Operación</span>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Fecha de la Operación (dd/mm/aaaa)
          </label>
          <input
            type="text"
            value={
              data.fechaOperacion?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
                ? `${data.fechaOperacion.split('-')[2]}/${data.fechaOperacion.split('-')[1]}/${data.fechaOperacion.split('-')[0]}`
                : data.fechaOperacion || ''
            }
            onChange={(e) => {
              const val = e.target.value;
              onChange((prev) => ({
                ...prev,
                fechaOperacion: val,
              }));
            }}
            placeholder="Ej. 11/09/2026"
            className="w-full sm:max-w-xs px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-900 text-sm shadow-2xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Formato: dd/mm/aaaa. La separación de día, mes y año se realiza de forma automática en el boleto oficial.
          </p>
        </div>
      </div>

      {/* 2. SECCIÓN DATOS DEL CLIENTE */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-bold">
            <User className="w-4 h-4 text-blue-600" />
            <span className="uppercase tracking-wide text-xs">1. Datos del Cliente / Comprador</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Campos mínimos obligatorios *</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Nombre Completo / Razón Social *
            </label>
            <input
              type="text"
              value={data.cliente.nombreCompleto}
              onChange={(e) => handleClientChange('nombreCompleto', e.target.value)}
              placeholder="Ej. FIGUEROA DIEGO NICOLAS"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold uppercase text-slate-900"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              DNI (Documento) *
            </label>
            <input
              type="text"
              value={data.cliente.dni || ''}
              onChange={(e) => handleClientChange('dni', e.target.value)}
              placeholder="Ej. 36.852.147"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              CUIT / CUIL
            </label>
            <input
              type="text"
              value={data.cliente.cuitCuil || ''}
              onChange={(e) => handleClientChange('cuitCuil', e.target.value)}
              placeholder="20-36852147-3"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Teléfono / Celular *
            </label>
            <input
              type="text"
              value={data.cliente.telefono || ''}
              onChange={(e) => handleClientChange('telefono', e.target.value)}
              placeholder="Ej. 299-4123456"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Email
            </label>
            <input
              type="email"
              value={data.cliente.email || ''}
              onChange={(e) => handleClientChange('email', e.target.value)}
              placeholder="cliente@ejemplo.com"
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Dirección Real (Calle y N°) *
            </label>
            <input
              type="text"
              value={data.cliente.direccion || ''}
              onChange={(e) => handleClientChange('direccion', e.target.value)}
              placeholder="Ej. Av. Argentina 1234 Piso 2"
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Localidad
            </label>
            <input
              type="text"
              value={data.cliente.localidad || ''}
              onChange={(e) => handleClientChange('localidad', e.target.value)}
              placeholder="Neuquén"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Provincia (Text7)
            </label>
            <input
              type="text"
              value={data.cliente.provincia || ''}
              onChange={(e) => handleClientChange('provincia', e.target.value)}
              placeholder="Neuquén"
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Código Postal (Text8)
            </label>
            <input
              type="text"
              value={data.cliente.codigoPostal || ''}
              onChange={(e) => handleClientChange('codigoPostal', e.target.value)}
              placeholder="8300"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Condición ante el IVA
            </label>
            <select
              value={data.cliente.condicionIVA || 'Consumidor Final'}
              onChange={(e) => handleClientChange('condicionIVA', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
            >
              <option value="Consumidor Final">Consumidor Final</option>
              <option value="Responsable Inscripto">Responsable Inscripto</option>
              <option value="Monotributo">Monotributo</option>
              <option value="Exento">Exento</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Estado Civil (EstCivil)
            </label>
            <input
              type="text"
              value={data.cliente.estadoCivil || ''}
              onChange={(e) => handleClientChange('estadoCivil', e.target.value)}
              placeholder="Soltero/a, Casado/a"
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Actividad o Profesión
            </label>
            <input
              type="text"
              value={data.cliente.actividad || ''}
              onChange={(e) => handleClientChange('actividad', e.target.value)}
              placeholder="Empleado, Comerciante"
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-3 gap-1">
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Nac. Día (Text4)</label>
              <input
                type="text"
                value={data.cliente.nacimientoDia || ''}
                onChange={(e) => handleClientChange('nacimientoDia', e.target.value)}
                placeholder="15"
                className="w-full px-2 py-1.5 rounded border border-slate-300 text-center font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Mes (Text5)</label>
              <input
                type="text"
                value={data.cliente.nacimientoMes || ''}
                onChange={(e) => handleClientChange('nacimientoMes', e.target.value)}
                placeholder="05"
                className="w-full px-2 py-1.5 rounded border border-slate-300 text-center font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Año (Text6)</label>
              <input
                type="text"
                value={data.cliente.nacimientoAnio || ''}
                onChange={(e) => handleClientChange('nacimientoAnio', e.target.value)}
                placeholder="1988"
                className="w-full px-2 py-1.5 rounded border border-slate-300 text-center font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. SECCIÓN UNIDAD ADQUIRIDA */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 text-slate-900 font-bold">
          <Car className="w-4 h-4 text-blue-600" />
          <span className="uppercase tracking-wide text-xs">2. Unidad Adquirida (Stock Autonet)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Marca, Modelo y Versión (Modelo)
            </label>
            <input
              type="text"
              value={data.unidadAdquirida.descripcion}
              onChange={(e) => handleUnidadChange('descripcion', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold uppercase text-slate-900"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Año (Text36)
            </label>
            <input
              type="number"
              value={data.unidadAdquirida.anio || ''}
              onChange={(e) => handleUnidadChange('anio', Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Patente / Dominio
            </label>
            <input
              type="text"
              value={data.unidadAdquirida.patente || ''}
              onChange={(e) => handleUnidadChange('patente', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold uppercase text-blue-800"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Color (COLOR)
            </label>
            <input
              type="text"
              value={data.unidadAdquirida.color || ''}
              onChange={(e) => {
                handleUnidadChange('color', e.target.value);
                handleOperacionChange('color', e.target.value);
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold uppercase"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              N° Stock / Orden (STOCK)
            </label>
            <input
              type="text"
              value={data.unidadAdquirida.stockInterno || ''}
              onChange={(e) => handleUnidadChange('stockInterno', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Motor N° (opcional)
            </label>
            <input
              type="text"
              value={data.unidadAdquirida.motor || ''}
              onChange={(e) => handleUnidadChange('motor', e.target.value)}
              placeholder="No inventar si no existe"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Chasis N° (opcional)
            </label>
            <input
              type="text"
              value={data.unidadAdquirida.chasis || ''}
              onChange={(e) => handleUnidadChange('chasis', e.target.value)}
              placeholder="No inventar si no existe"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
            />
          </div>
        </div>
      </div>

      {/* 4. SECCIÓN DATOS DE LA OPERACIÓN & FORMAS DE PAGO */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-bold">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span className="uppercase tracking-wide text-xs">3. Condiciones de Pago & Importes</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Empresa: <strong className="text-slate-800">{companyKey}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Ref. Lista / Código (COD)
            </label>
            <input
              type="text"
              value={data.operacion.referenciaLista || ''}
              onChange={(e) => handleOperacionChange('referenciaLista', e.target.value)}
              placeholder="Ej. LISTA SEPTIEMBRE 2026"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold uppercase"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Precio del Vehículo (Text10) ($)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={data.operacion.precioVehiculo ? new Intl.NumberFormat('es-AR').format(data.operacion.precioVehiculo) : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '');
                handleOperacionChange('precioVehiculo', raw ? Number(raw) : 0);
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Seña / Reserva (Text18) ($)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={data.operacion.sena ? new Intl.NumberFormat('es-AR').format(data.operacion.sena) : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '');
                handleOperacionChange('sena', raw ? Number(raw) : 0);
              }}
              placeholder="Ej. 1.000.000"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-blue-900"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Efectivo Adicional (Text19) ($)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={data.operacion.efectivoAdicional ? new Intl.NumberFormat('es-AR').format(data.operacion.efectivoAdicional) : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '');
                handleOperacionChange('efectivoAdicional', raw ? Number(raw) : 0);
              }}
              placeholder="Dejar vacío si no integra efectivo extra"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-800"
            />
            <p className="text-[9px] text-slate-400 mt-0.5">Si no hay efectivo extra, queda vacío en el PDF.</p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Gestoría → Patentamiento (undefined_9) ($)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={data.operacion.patentamiento ? new Intl.NumberFormat('es-AR').format(data.operacion.patentamiento) : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '');
                handleOperacionChange('patentamiento', raw ? Number(raw) : undefined);
              }}
              placeholder="Ej: 1.396.500"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-800"
            />
            <p className="text-[9px] text-slate-400 mt-0.5">Transferencia calculada. Si no aplica, dejar vacío (no poner 0).</p>
          </div>

          <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
            <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">
              Total Operación (Formas de Pago y Gestoría: undefined / undefined_8) ($)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={data.operacion.totalOperacion ? new Intl.NumberFormat('es-AR').format(data.operacion.totalOperacion) : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '');
                handleOperacionChange('totalOperacion', raw ? Number(raw) : 0);
              }}
              className="w-full px-3 py-2 rounded-lg border border-emerald-300 bg-white font-mono font-black text-emerald-900 text-sm"
            />
            <span className="block text-[9px] text-emerald-700 mt-1">Imprime en TOTAL de FORMAS DE PAGO y en TOTAL de GESTORÍA</span>
          </div>
        </div>
      </div>

      {/* 5. SECCIÓN FINANCIACIONES COMBINADAS (V2 Requisitos 8 a 16) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-bold">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            <span className="uppercase tracking-wide text-xs">4. Financiaciones Combinadas</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAddFinancing()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Financiación</span>
            </button>
          </div>
        </div>

        {/* Alternativas rápidas de la cotización para agregar o vincular */}
        {financingAlternatives.length > 0 && (
          <div className="p-3 mb-3 bg-indigo-50/60 rounded-xl border border-indigo-200">
            <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-1.5">
              Alternativas disponibles en la Cotización (click para sumar):
            </label>
            <div className="flex flex-wrap gap-2">
              {financingAlternatives.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    handleAddFinancing({
                      entidad: opt.entidad,
                      montoFinanciado: Math.round(opt.cuotas * opt.montoCuota * 0.7) || 0,
                      cuotas: opt.cuotas,
                      valorCuota: opt.montoCuota,
                      activo: true,
                    });
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-900 hover:bg-indigo-100/60 text-[11px] font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-indigo-600" />
                  <span>{opt.entidad} ({opt.cuotas}x ${new Intl.NumberFormat('es-AR').format(opt.montoCuota)})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lista repetible de financiaciones */}
        {financiacionesList.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center">
            <p className="text-xs text-slate-500 italic">
              Operación de contado / sin crédito (0 financiaciones). Los campos de financiación quedarán limpios.
            </p>
            <button
              type="button"
              onClick={() => handleAddFinancing()}
              className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar primera financiación
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {financiacionesList.map((fin, idx) => (
              <div 
                key={fin.id} 
                className={`p-3.5 rounded-xl border transition-all ${
                  fin.activo 
                    ? 'bg-indigo-50/40 border-indigo-200 shadow-2xs' 
                    : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-indigo-100/60">
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={fin.activo}
                        onChange={(e) => handleUpdateFinancing(fin.id, { activo: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="text-xs font-bold text-slate-800 uppercase">
                        Financiación {idx + 1} {fin.activo ? '(Activa en Boleto)' : '(Desactivada)'}
                      </span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveFinancing(fin.id)}
                    className="p-1 rounded text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Eliminar financiación"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Entidad / Banco *
                    </label>
                    <input
                      type="text"
                      value={fin.entidad}
                      onChange={(e) => handleUpdateFinancing(fin.id, { entidad: e.target.value })}
                      placeholder="Ej: BNA, CREDINET, Santander"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold uppercase text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Monto Financiado ($) *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fin.montoFinanciado ? new Intl.NumberFormat('es-AR').format(fin.montoFinanciado) : ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        handleUpdateFinancing(fin.id, { montoFinanciado: raw ? Number(raw) : 0 });
                      }}
                      placeholder="Ej: 10.000.000"
                      className="w-full px-3 py-2 rounded-lg border border-indigo-300 bg-white font-mono font-bold text-indigo-950"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Cantidad de Cuotas
                    </label>
                    <input
                      type="number"
                      value={fin.cuotas || ''}
                      onChange={(e) => handleUpdateFinancing(fin.id, { cuotas: Number(e.target.value) })}
                      placeholder="36"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Valor Aprox. Cuota ($)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fin.valorCuota ? new Intl.NumberFormat('es-AR').format(fin.valorCuota) : ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        handleUpdateFinancing(fin.id, { valorCuota: raw ? Number(raw) : undefined });
                      }}
                      placeholder="Dejar vacío si no aplica"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="mt-2.5">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Observación Opcional
                  </label>
                  <input
                    type="text"
                    value={fin.observacion || ''}
                    onChange={(e) => handleUpdateFinancing(fin.id, { observacion: e.target.value })}
                    placeholder="Ej. Sujeto a aprobación crediticia, tasa preferencial, prenda BNA"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. SECCIÓN USADO ENTREGADO EN PARTE DE PAGO */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-bold">
            <Repeat className="w-4 h-4 text-amber-600" />
            <span className="uppercase tracking-wide text-xs">5. Unidad Usada Entregada en Parte de Pago</span>
          </div>

          <label className="relative inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={data.entregaUsado.enabled}
              onChange={(e) => handleUsadoChange('enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
            <span className="text-xs font-bold text-slate-700">
              {data.entregaUsado.enabled ? 'SÍ, entrega vehículo usado' : 'NO entrega usado'}
            </span>
          </label>
        </div>

        {data.entregaUsado.enabled ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Marca y Modelo Usado (Modelo_2)
              </label>
              <input
                type="text"
                value={data.entregaUsado.modelo || ''}
                onChange={(e) => handleUsadoChange('modelo', e.target.value)}
                placeholder="Ej. FORD FOCUS SE 2.0"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold uppercase text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Año Usado (Text37)
              </label>
              <input
                type="number"
                value={data.entregaUsado.anio || ''}
                onChange={(e) => handleUsadoChange('anio', Number(e.target.value))}
                placeholder="2017"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Patente / Dominio Usado (Dominio_2)
              </label>
              <input
                type="text"
                value={data.entregaUsado.patente || ''}
                onChange={(e) => handleUsadoChange('patente', e.target.value)}
                placeholder="AA999ZZ"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold uppercase text-amber-800"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Valor de Toma Aceptado (Text11) ($)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={data.entregaUsado.valorToma ? new Intl.NumberFormat('es-AR').format(data.entregaUsado.valorToma) : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  handleUsadoChange('valorToma', raw ? Number(raw) : 0);
                }}
                placeholder="Ej. 5.000.000"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Motor N° Usado (Motor_2, opcional)
              </label>
              <input
                type="text"
                value={data.entregaUsado.motor || ''}
                onChange={(e) => handleUsadoChange('motor', e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Chasis N° Usado (Chasis_2, opcional)
              </label>
              <input
                type="text"
                value={data.entregaUsado.chasis || ''}
                onChange={(e) => handleUsadoChange('chasis', e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic py-1">
            No se entrega vehículo en parte de pago. Todos los campos de unidad entregada quedarán en blanco.
          </p>
        )}
      </div>

    </div>
  );
};
