import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { BoletoData, BoletoUifData, toBoletoText } from '../types/boleto';

/**
 * PLANILLA DE DATOS PERSONALES – RES. 200/2024 UIF (CREDINET / WUNDER S.A.)
 *
 * Se escribe SOBRE el PDF original que entrega Credinet (public/templates/UIF_CREDINET.pdf):
 * el documento no tiene campos de formulario, así que cada dato se dibuja en la coordenada
 * del casillero correspondiente. No se genera un documento nuevo.
 */

const baseUrl = (import.meta.env?.BASE_URL || '/').endsWith('/') ? import.meta.env?.BASE_URL || '/' : `${import.meta.env?.BASE_URL}/`;
export const UIF_TEMPLATE_URL = `${baseUrl}templates/UIF_CREDINET.pdf`;

const PAGE_H = 841.92;

/** Casilleros: x inicial / final y línea de base, medidos desde ARRIBA de la hoja (en puntos). */
type Slot = { x: number; right: number; top: number; align?: 'left' | 'center' };
const SLOTS = {
  nombre: { x: 183, right: 548, top: 113.9 },
  documento: { x: 347, right: 548, top: 139.4 },
  nacionalidad: { x: 139, right: 236, top: 164.8 },
  lugarNacimiento: { x: 342, right: 548, top: 164.8 },
  fechaNacimiento: { x: 258, right: 548, top: 189.4 },
  sexo: { x: 132, right: 220, top: 214.4 },
  estadoCivil: { x: 302, right: 548, top: 214.4 },
  cuit: { x: 163, right: 548, top: 241.1 },
  domicilio: { x: 160, right: 548, top: 267.6 },
  pais: { x: 72, right: 212, top: 309, align: 'center' },
  calle: { x: 212, right: 461, top: 309, align: 'center' },
  numero: { x: 461, right: 551, top: 309, align: 'center' },
  codigoPostal: { x: 72, right: 156, top: 352, align: 'center' },
  localidad: { x: 156, right: 354, top: 352, align: 'center' },
  provincia: { x: 354, right: 551, top: 352, align: 'center' },
  telefono: { x: 210, right: 550, top: 377.4 },
  email: { x: 210, right: 550, top: 400.8 },
  contactoNombre: { x: 297, right: 550, top: 424.7 },
  contactoVinculo: { x: 178, right: 268, top: 448.2 },
  contactoTelefono: { x: 381, right: 550, top: 448.2 },
  actividad: { x: 267, right: 550, top: 472.6 },
  empresa: { x: 210, right: 550, top: 497.4 },
  cargo: { x: 138, right: 248, top: 520.9 },
  cargoDesde: { x: 448, right: 550, top: 520.9 },
  fechaIngreso: { x: 225, right: 550, top: 544.2 },
  emailLaboral: { x: 210, right: 550, top: 567.5 },
  telefonoLaboral: { x: 210, right: 550, top: 590.6 },
  pepNombre: { x: 130, right: 332, top: 632.3 },
  soNombre: { x: 130, right: 336, top: 722.9 },
  fechaDia: { x: 104, right: 131, top: 794, align: 'center' },
  fechaMes: { x: 137, right: 163, top: 794, align: 'center' },
  fechaAnio: { x: 168, right: 210, top: 794, align: 'center' },
} satisfies Record<string, Slot>;

/** Ubicación de la palabra "SI" en cada declaración (se tacha con una cruz). */
const SI_BOXES = [
  { x1: 348.6, x2: 356.2, top: 635.7, bottom: 644.7 }, // PEP
  { x1: 238.8, x2: 246.3, top: 737.0, bottom: 745.9 }, // SO
];

/** Separa "Av. Argentina 1234" en calle y número. */
export function splitAddress(direccion?: string): { calle: string; numero: string } {
  // Lo que va después de la primera coma suele ser la localidad: no forma parte de calle/número
  const base = String(direccion || '').split(',')[0].trim();
  const extraMatch = base.match(/\s+((?:piso|dpto|depto|dto|of|local|casa)\b.*)$/i);
  const extra = extraMatch ? extraMatch[1].trim() : '';
  const sinExtra = extraMatch ? base.slice(0, extraMatch.index).trim() : base;
  const m = sinExtra.match(/^(.*\S)\s+(?:N[°º]?\s*)?(\d{1,6})$/i);
  if (!m) return { calle: base, numero: '' };
  return { calle: m[1].replace(/\s+N[°º]?$/i, '').trim(), numero: extra ? `${m[2]} ${extra}` : m[2] };
}

export function defaultUif(data: BoletoData): BoletoUifData {
  const { calle, numero } = splitAddress(data.cliente.direccion);
  return { nacionalidad: 'ARGENTINA', pais: 'ARGENTINA', calle, numero, ...(data.uif || {}) };
}

const pad2 = (v?: string) => (v ? String(v).padStart(2, '0') : '');

function fechaNacimiento(data: BoletoData): string {
  const c = data.cliente;
  if (c.nacimientoDia && c.nacimientoMes && c.nacimientoAnio) {
    return `${pad2(c.nacimientoDia)}/${pad2(c.nacimientoMes)}/${c.nacimientoAnio}`;
  }
  return c.fechaNacimiento || '';
}

/** Fecha dd/mm/aaaa a partir de "aaaa-mm-dd" o texto ya formateado. */
const toDmy = (v?: string) => {
  const s = String(v || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

export const uifPdfService = {
  /** Lista de datos que faltan para presentar la planilla (aviso, no bloquea). */
  missing(data: BoletoData): string[] {
    const u = defaultUif(data);
    const c = data.cliente;
    const req: [string, unknown][] = [
      ['nombre', c.nombreCompleto],
      ['DNI', c.dni],
      ['CUIT/CUIL', c.cuitCuil],
      ['fecha de nacimiento', fechaNacimiento(data)],
      ['lugar de nacimiento', u.lugarNacimiento],
      ['sexo', u.sexo],
      ['estado civil', c.estadoCivil],
      ['domicilio', c.direccion],
      ['teléfono', c.telefono],
      ['contacto de referencia', u.contactoNombre],
      ['actividad', c.actividad],
    ];
    return req.filter(([, v]) => !String(v ?? '').trim()).map(([k]) => k);
  },

  async generate(data: BoletoData, templateBytes?: Uint8Array, today = new Date()): Promise<Uint8Array> {
    let bytes = templateBytes;
    if (!bytes) {
      const res = await fetch(`${UIF_TEMPLATE_URL}?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudo cargar la planilla UIF de Credinet (templates/UIF_CREDINET.pdf).');
      bytes = new Uint8Array(await res.arrayBuffer());
    }
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const page = pdf.getPages()[0];
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);

    const put = (slot: Slot, value: unknown, size = 9) => {
      const text = toBoletoText(value);
      if (!text) return;
      const avail = slot.right - slot.x - 4;
      let fs = size;
      const w0 = font.widthOfTextAtSize(text, fs);
      if (w0 > avail) fs = Math.max(5.5, fs * (avail / w0));
      const w = font.widthOfTextAtSize(text, fs);
      const x = slot.align === 'center' ? slot.x + Math.max(2, (slot.right - slot.x - w) / 2) : slot.x;
      page.drawText(text, { x, y: PAGE_H - slot.top, size: fs, font, color: black });
    };

    const c = data.cliente;
    const u = defaultUif(data);
    const nombre = c.nombreCompleto;

    put(SLOTS.nombre, nombre);
    put(SLOTS.documento, c.dni ? `DNI ${c.dni}` : '');
    put(SLOTS.nacionalidad, u.nacionalidad);
    put(SLOTS.lugarNacimiento, u.lugarNacimiento);
    put(SLOTS.fechaNacimiento, fechaNacimiento(data));
    put(SLOTS.sexo, u.sexo);
    put(SLOTS.estadoCivil, c.estadoCivil);
    const cuitDigits = String(c.cuitCuil || '').replace(/\D/g, '');
    put(SLOTS.cuit, cuitDigits.length === 11 ? `${cuitDigits.slice(0, 2)}-${cuitDigits.slice(2, 10)}-${cuitDigits.slice(10)}` : c.cuitCuil);
    const dir = String(c.direccion || '').trim();
    const loc = String(c.localidad || '').trim();
    const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    put(SLOTS.domicilio, loc && !sinTildes(dir).includes(sinTildes(loc)) ? `${dir}, ${loc}` : dir);
    put(SLOTS.pais, u.pais);
    put(SLOTS.calle, u.calle);
    put(SLOTS.numero, u.numero);
    put(SLOTS.codigoPostal, c.codigoPostal);
    put(SLOTS.localidad, c.localidad);
    put(SLOTS.provincia, c.provincia);
    put(SLOTS.telefono, c.telefono);
    if (c.email) page.drawText(String(c.email).trim(), { x: SLOTS.email.x, y: PAGE_H - SLOTS.email.top, size: 9, font, color: black });
    put(SLOTS.contactoNombre, u.contactoNombre);
    put(SLOTS.contactoVinculo, u.contactoVinculo);
    put(SLOTS.contactoTelefono, u.contactoTelefono);
    put(SLOTS.actividad, c.actividad);
    put(SLOTS.empresa, u.empresa);
    put(SLOTS.cargo, u.cargo);
    put(SLOTS.cargoDesde, toDmy(u.cargoDesde));
    put(SLOTS.fechaIngreso, toDmy(u.fechaIngreso));
    if (u.emailLaboral) page.drawText(u.emailLaboral.trim(), { x: SLOTS.emailLaboral.x, y: PAGE_H - SLOTS.emailLaboral.top, size: 9, font, color: black });
    put(SLOTS.telefonoLaboral, u.telefonoLaboral);

    // Declaraciones PEP y SO: nombre en "Quien suscribe" y el "SI" tachado con una cruz
    put(SLOTS.pepNombre, nombre, 8);
    put(SLOTS.soNombre, nombre, 8);
    for (const b of SI_BOXES) {
      const pad = 1;
      const x1 = b.x1 - pad, x2 = b.x2 + pad;
      const yTop = PAGE_H - b.top + 0.5, yBot = PAGE_H - b.bottom + 0.5;
      page.drawLine({ start: { x: x1, y: yBot }, end: { x: x2, y: yTop }, thickness: 1, color: black });
      page.drawLine({ start: { x: x1, y: yTop }, end: { x: x2, y: yBot }, thickness: 1, color: black });
    }

    // Fecha de confección: hoy
    put(SLOTS.fechaDia, String(today.getDate()).padStart(2, '0'), 10);
    put(SLOTS.fechaMes, String(today.getMonth() + 1).padStart(2, '0'), 10);
    put(SLOTS.fechaAnio, String(today.getFullYear()), 10);

    pdf.setTitle(`Planilla UIF - ${toBoletoText(nombre) || 'CLIENTE'}`);
    return pdf.save();
  },

  /** Genera la planilla y la descarga en el dispositivo. */
  async download(data: BoletoData): Promise<void> {
    const bytes = await uifPdfService.generate(data);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = uifPdfService.fileName(data);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  },

  fileName(data: BoletoData): string {
    const n = toBoletoText(data.cliente.nombreCompleto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'CLIENTE';
    return `UIF_CREDINET_${n}.pdf`;
  },
};
