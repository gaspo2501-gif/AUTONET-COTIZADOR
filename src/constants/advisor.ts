export interface AdvisorInfo {
  nombre: string;
  cargo: string;
  telefono: string;
  telefonoFormateado: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  pais: string;
  concesionaria: string;
  sucursal: string;
  textoFirmaCompleta: string;
}

/**
 * Datos del asesor que firma mensajes, presupuestos e historias.
 * Es un objeto VIVO: al iniciar sesión se completa con el perfil de cada usuario
 * (ver services/advisorProfileService.ts). Estos valores son solo los de arranque.
 */
export const ADVISOR_INFO: AdvisorInfo = {
  nombre: 'Gaspar Nicolau',
  cargo: 'Asesor comercial Autonet',
  telefono: '2994290620',
  telefonoFormateado: '2994290620',
  direccion: 'Felix San Martin, 1650',
  ciudad: 'NEUQUEN',
  provincia: 'Neuquén',
  pais: 'Argentina',
  concesionaria: 'Autonet Usados Seleccionados',
  sucursal: 'Neuquén',
  textoFirmaCompleta: `Gaspar Nicolau | Asesor comercial Autonet\n2994290620\nFelix San Martin, 1650, NEUQUEN, Neuquén, Argentina`,
};

export const DEFAULT_ADVISOR_INFO: AdvisorInfo = { ...ADVISOR_INFO };

/** Aplica el perfil del usuario que inició sesión. */
export function applyAdvisorProfile(p: { nombre?: string; cargo?: string; telefono?: string } | null): void {
  const nombre = p?.nombre?.trim() || DEFAULT_ADVISOR_INFO.nombre;
  const cargo = p?.cargo?.trim() || DEFAULT_ADVISOR_INFO.cargo;
  const telefono = p?.telefono?.replace(/\s+/g, '') || DEFAULT_ADVISOR_INFO.telefono;
  Object.assign(ADVISOR_INFO, {
    nombre,
    cargo,
    telefono,
    telefonoFormateado: telefono,
    textoFirmaCompleta: `${nombre} | ${cargo}\n${telefono}\n${ADVISOR_INFO.direccion}, ${ADVISOR_INFO.ciudad}, ${ADVISOR_INFO.provincia}, ${ADVISOR_INFO.pais}`,
  });
}
