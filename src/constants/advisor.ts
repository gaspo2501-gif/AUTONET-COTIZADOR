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

export const ADVISOR_INFO: AdvisorInfo = {
  nombre: 'Gaspar Nicolau',
  cargo: 'Asesor comercial Autonet',
  telefono: '2994290620',
  telefonoFormateado: '299 429-0620',
  direccion: 'Felix San Martin, 1650',
  ciudad: 'NEUQUEN',
  provincia: 'Neuquén',
  pais: 'Argentina',
  concesionaria: 'Autonet Usados Seleccionados',
  sucursal: 'Neuquén',
  textoFirmaCompleta: `Gaspar Nicolau | Asesor comercial Autonet\n2994290620\nFelix San Martin, 1650, NEUQUEN, Neuquén, Argentina`,
};
