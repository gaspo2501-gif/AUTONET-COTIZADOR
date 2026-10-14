import { BoletoCliente } from '../types/boleto';
import { onlyDigits, formatCuit, isValidCuit } from './argentinaIds';

/**
 * Extrae datos del comprador desde un texto pegado (mensaje de WhatsApp, foto transcripta, etc.).
 * Reconoce etiquetas comunes ("DNI:", "CUIL", "Domicilio", "Tel") y patrones sueltos.
 * Devuelve solo los campos encontrados.
 */
export function parseClientText(raw: string): Partial<BoletoCliente> {
  const text = raw.replace(/\r/g, '').trim();
  const out: Partial<BoletoCliente> = {};
  if (!text) return out;

  const lines = text.split(/\n|;|\|/).map((l) => l.trim()).filter(Boolean);
  const label = (re: RegExp) => {
    for (const l of lines) {
      const m = l.match(re);
      if (m && m[1]?.trim()) return m[1].trim().replace(/[.,;]+$/, '');
    }
    return undefined;
  };

  // CUIT / CUIL
  const cuitMatch = text.match(/\b(2[03-7]|3[034])[-. ]?(\d{1,2}[. ]?\d{3}[. ]?\d{3})[-. ]?(\d)\b/);
  if (cuitMatch) {
    const c = onlyDigits(cuitMatch[0]);
    if (c.length === 11) out.cuitCuil = isValidCuit(c) ? formatCuit(c) : c;
  }

  // DNI (etiquetado o número suelto de 7-8 dígitos que no sea parte del CUIT ni teléfono)
  const dniLabeled = text.match(/\b(?:dni|d\.n\.i\.?|documento|doc\.?)\s*(?:n[°ºo.]*)?\s*:?\s*([\d.\s]{7,11})/i);
  if (dniLabeled) out.dni = onlyDigits(dniLabeled[1]);
  else if (out.cuitCuil) out.dni = String(Number(onlyDigits(out.cuitCuil).slice(2, 10)));
  else {
    const loose = text.match(/\b\d{1,2}\.?\d{3}\.?\d{3}\b/);
    if (loose && onlyDigits(loose[0]).length <= 8) out.dni = onlyDigits(loose[0]);
  }

  // Teléfono
  const tel = label(/(?:tel(?:[eé]fono)?|cel(?:ular)?|whats?app|wsp)\s*:?\s*(.+)/i);
  if (tel) out.telefono = tel.replace(/[^\d+ -]/g, '').trim();
  else {
    const t = text.match(/(?:\+?54\s?9?\s?)?\(?\d{2,4}\)?[\s-]?(?:15[\s-]?)?\d{3,4}[\s-]?\d{4}/);
    if (t && onlyDigits(t[0]).length >= 10 && onlyDigits(t[0]) !== onlyDigits(out.cuitCuil)) out.telefono = t[0].trim();
  }

  // Email
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (email) out.email = email[0].toLowerCase();

  // Domicilio, localidad, CP
  const dir = label(/(?:domicilio|direcci[oó]n|dir\.?|calle|vive en)\s*:?\s*(.+)/i);
  if (dir) out.direccion = dir.toUpperCase();
  const loc = label(/(?:localidad|ciudad)\s*:?\s*(.+)/i);
  if (loc) out.localidad = loc.toUpperCase();
  const cp = text.match(/\b(?:c\.?p\.?|c[oó]digo postal)\s*:?\s*([A-Z]?\d{4}[A-Z]{0,3})\b/i);
  if (cp) out.codigoPostal = cp[1].toUpperCase();

  // Nacimiento
  const nac = text.match(/(?:nac(?:imiento|ido|ida)?|f\.?\s?nac\.?|fecha de nac\w*)\s*:?\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/i);
  if (nac) {
    out.nacimientoDia = nac[1].padStart(2, '0');
    out.nacimientoMes = nac[2].padStart(2, '0');
    out.nacimientoAnio = nac[3].length === 2 ? `19${nac[3]}` : nac[3];
  }

  // Estado civil
  const ec = text.match(/\b(solter[oa]|casad[oa]|divorciad[oa]|viud[oa]|uni[oó]n convivencial)\b/i);
  if (ec) {
    const v = ec[1].toLowerCase();
    out.estadoCivil = v.startsWith('solter') ? 'SOLTERO/A' : v.startsWith('casad') ? 'CASADO/A' : v.startsWith('divorc') ? 'DIVORCIADO/A' : v.startsWith('viud') ? 'VIUDO/A' : 'UNIÓN CONVIVENCIAL';
  }

  // Ocupación
  const act = label(/(?:ocupaci[oó]n|actividad|profesi[oó]n|trabajo)\s*:?\s*(.+)/i);
  if (act) out.actividad = act.toUpperCase();

  // Nombre: etiqueta explícita o primera línea con solo letras (2+ palabras)
  const nom = label(/(?:nombre(?: y apellido| completo)?|apellido y nombre|comprador|cliente)\s*:?\s*(.+)/i);
  if (nom) out.nombreCompleto = nom.toUpperCase();
  else {
    const first = lines.find((l) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ'.\s,]{5,}$/.test(l) && l.trim().split(/\s+/).length >= 2 && !/^(hola|buen|te paso|mis datos|datos)/i.test(l));
    if (first) out.nombreCompleto = first.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  return out;
}
