import { BoletoCompanyKey, BoletoTemplateConfig } from '../types/boleto';
import { BOLETO_FIELD_MAPS } from './boletoFieldMaps';

/**
 * Normaliza la procedencia / empresa del vehículo para resolver la plantilla oficial.
 */
export function resolveBoletoCompany(empresaRaw?: string): BoletoCompanyKey | null {
  if (!empresaRaw) return null;
  const clean = empresaRaw
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ');

  if (clean.includes('MIRAGE')) {
    return 'MIRAGE';
  }
  if (clean.includes('IRUNA') || clean.includes('IRUNIA')) {
    return 'IRUNA';
  }
  if (clean.includes('OIL') || clean.includes('BULL')) {
    return 'OIL_BULL';
  }
  if (clean.includes('AKIRA')) {
    return 'AKIRA';
  }

  return null;
}

/**
 * Resuelve la clave de empresa a partir del vehículo asociado.
 * La plantilla se selecciona EXCLUSIVAMENTE a partir de `vehicle.empresa`.
 * Si no se puede determinar o no está configurada, devuelve null (NO usa fallback).
 */
export function resolveCompanyFromVehicle(vehicle?: { empresa?: string } | null): BoletoCompanyKey | null {
  if (!vehicle?.empresa) return null;
  return resolveBoletoCompany(vehicle.empresa);
}

export interface AuthorizedTemplateInfo {
  companyKey: BoletoCompanyKey;
  fileName: string;
  expectedSize: number;
  expectedSha256: string;
  expectedFields: number;
}

export const AUTHORIZED_TEMPLATES_DATA: Record<BoletoCompanyKey, AuthorizedTemplateInfo> = {
  IRUNA: {
    companyKey: 'IRUNA',
    fileName: 'ORIGINAL_IRUNA.pdf',
    expectedSize: 1600820,
    expectedSha256: '47e5a41c031739c6097a465c671d51b1f0ffac56987fb0297daa4e541c1fcaf3',
    expectedFields: 83,
  },
  MIRAGE: {
    companyKey: 'MIRAGE',
    fileName: 'ORIGINAL_MIRAGE.pdf',
    expectedSize: 768080,
    expectedSha256: '8fc91b44b9dafd0ea75b8987f1ac19d66550278d01a642ea61a769ae952b859f',
    expectedFields: 84,
  },
  OIL_BULL: {
    companyKey: 'OIL_BULL',
    fileName: 'ORIGINAL_OIL_BULL.pdf',
    expectedSize: 1370582,
    expectedSha256: 'cbc05697ee1c8a6c5059dae60a2754852b8160c6d039eebf2240a61ad3277e16',
    expectedFields: 83,
  },
  AKIRA: {
    companyKey: 'AKIRA',
    fileName: '',
    expectedSize: 0,
    expectedSha256: '',
    expectedFields: 0,
  },
};

const baseUrl = (import.meta.env?.BASE_URL || '/').endsWith('/')
  ? (import.meta.env?.BASE_URL || '/')
  : `${import.meta.env?.BASE_URL}/`;

export const BOLETO_TEMPLATES_CONFIG: Record<BoletoCompanyKey, BoletoTemplateConfig> = {
  MIRAGE: {
    key: 'MIRAGE',
    displayName: 'MIRAGE S.A.',
    templateFileName: 'ORIGINAL_MIRAGE.pdf',
    templateUrl: `${baseUrl}templates/ORIGINAL_MIRAGE.pdf`,
    available: true,
    fieldMap: BOLETO_FIELD_MAPS.MIRAGE,
  },

  IRUNA: {
    key: 'IRUNA',
    displayName: 'IRUÑA S.A.',
    templateFileName: 'ORIGINAL_IRUNA.pdf',
    templateUrl: `${baseUrl}templates/ORIGINAL_IRUNA.pdf`,
    available: true,
    fieldMap: BOLETO_FIELD_MAPS.IRUNA,
  },

  OIL_BULL: {
    key: 'OIL_BULL',
    displayName: 'OIL BULL S.A.',
    templateFileName: 'ORIGINAL_OIL_BULL.pdf',
    templateUrl: `${baseUrl}templates/ORIGINAL_OIL_BULL.pdf`,
    available: true,
    fieldMap: BOLETO_FIELD_MAPS.OIL_BULL,
  },

  AKIRA: {
    key: 'AKIRA',
    displayName: 'AKIRA',
    templateFileName: '',
    templateUrl: '',
    available: false,
    unavailableReason: 'Plantilla de boleto todavía no configurada para AKIRA.',
    fieldMap: BOLETO_FIELD_MAPS.AKIRA,
  },
};
