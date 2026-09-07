import { Vehicle } from '../types/stock';

export interface SituacionInfo {
  code: string;
  label: string;
  shortLabel: string;
  badgeClass: string;
  dotColor: string;
  description: string;
}

/**
 * Traduce el campo `Ub` (situación operativa / localización) a su descripción oficial
 * sin perder el código original del PDF.
 */
export const getSituacionOperativaInfo = (ub?: string): SituacionInfo => {
  const code = (ub || '').trim().toUpperCase();
  switch (code) {
    case 'A':
      return {
        code: 'A',
        label: 'Autonet Central (A)',
        shortLabel: 'Autonet',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
        dotColor: 'bg-blue-500',
        description: 'Autonet Central / Sucursal Neuquén',
      };
    case 'P':
      return {
        code: 'P',
        label: 'Pendiente de Ingreso / Preparación (P)',
        shortLabel: 'Pendiente',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        dotColor: 'bg-amber-500',
        description: 'Unidad pendiente de reacondicionamiento o ingreso a salón',
      };
    case 'S':
      return {
        code: 'S',
        label: 'Sucursal Solalique (S)',
        shortLabel: 'Solalique',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        dotColor: 'bg-emerald-500',
        description: 'Ubicación física en Salón Solalique',
      };
    case 'GR':
      return {
        code: 'GR',
        label: 'General Roca (GR)',
        shortLabel: 'GR',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
        dotColor: 'bg-purple-500',
        description: 'Localización en General Roca',
      };
    case 'FINAN':
      return {
        code: 'FINAN',
        label: 'Financiación / Prenda (FINAN)',
        shortLabel: 'FINAN',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        dotColor: 'bg-rose-500',
        description: 'Operación crediticia o prendaria',
      };
    default:
      return {
        code: code || '-',
        label: code || 'No informada',
        shortLabel: code || '-',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        dotColor: 'bg-slate-400',
        description: code ? `Situación operativa: ${code}` : 'Situación no informada',
      };
  }
};

/**
 * Retorna badge styling para el campo `Empresa` (MIRAGE, IRUÑA, AKIRA, OIL BULL, etc.)
 */
export const getEmpresaBadgeClass = (empresa?: string): string => {
  const emp = (empresa || '').trim().toUpperCase();
  switch (emp) {
    case 'MIRAGE':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'IRUÑA':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'AKIRA':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'OIL BULL':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

/**
 * Comprueba si el vehículo tiene fotos reales de Autonet
 */
export const hasAutonetWebPhotos = (vehicle: Vehicle): boolean => {
  return Boolean(
    vehicle.sincronizadoAutonetWeb &&
    (vehicle.fotos && vehicle.fotos.length > 0 || vehicle.fotoPrincipal)
  );
};
