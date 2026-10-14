import { Vehicle } from '../types/stock';
import { ADVISOR_INFO } from '../constants/advisor';
import { formatCurrency, formatKm } from '../utils/formatters';
import { SyncedCollection } from './syncedCollection';

export interface MessageTemplate {
  id: string;
  nombre: string;
  texto: string;
  orden?: number;
  updatedAt?: string;
  deleted?: boolean;
}

export const TEMPLATE_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'unidad', label: 'Marca, modelo y versión' },
  { key: 'marca', label: 'Marca' },
  { key: 'modelo', label: 'Modelo' },
  { key: 'anio', label: 'Año' },
  { key: 'km', label: 'Kilometraje' },
  { key: 'precio', label: 'Precio contado' },
  { key: 'color', label: 'Color' },
  { key: 'combustible', label: 'Combustible' },
  { key: 'caja', label: 'Transmisión' },
  { key: 'patente', label: 'Patente' },
  { key: 'link', label: 'Link a la web de Autonet' },
  { key: 'firma', label: 'Tu firma' },
];

const SIGNATURE = `━━━━━━━━━━━━━━━━━━━━━\n${ADVISOR_INFO.nombre} | ${ADVISOR_INFO.cargo}\n📞 ${ADVISOR_INFO.telefono}\n📍 ${ADVISOR_INFO.direccion}, ${ADVISOR_INFO.ciudad}`;

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl-primera',
    nombre: 'Primera respuesta',
    orden: 1,
    texto:
      '¡Hola! ¿Cómo estás? Soy {firmaNombre}, asesor de Autonet. Te paso la info del *{unidad}*:\n\n📅 Año: {anio}\n🛣️ Km: {km}\n🎨 Color: {color}\n⛽ {combustible} · {caja}\n💰 *Precio contado: {precio}*\n\n{link}\n¿Querés que coordinemos para que lo veas? Tomamos tu usado y hay financiación.\n\n{firma}',
  },
  {
    id: 'tpl-disponible',
    nombre: '¿Sigue disponible? Sí',
    orden: 2,
    texto: '¡Hola! Sí, el *{unidad} {anio}* sigue disponible 🙌\nPrecio contado: *{precio}*.\n¿Te queda bien pasar hoy o mañana a verlo?\n\n{firma}',
  },
  {
    id: 'tpl-usado',
    nombre: 'Te tomo tu usado',
    orden: 3,
    texto:
      'Para el *{unidad} {anio}* ({precio}) podemos tomar tu usado como parte de pago 🚗➡️🚙\nMandame: marca, modelo, versión, año, km y 4 fotos (frente, atrás, laterales e interior) y te paso una cotización.\n\n{firma}',
  },
  {
    id: 'tpl-financiacion',
    nombre: 'Financiación',
    orden: 4,
    texto:
      'El *{unidad} {anio}* tiene precio contado *{precio}*. Podés financiar una parte con crédito prendario 🏦\nPasame tu DNI y si trabajás en relación de dependencia o sos monotributista, y te armo las opciones de cuotas.\n\n{firma}',
  },
];

const store = new SyncedCollection<MessageTemplate>('messageTemplates', 'autonet_message_templates_v1', {
  sort: (a, b) => (a.orden ?? 99) - (b.orden ?? 99),
});

export const messageTemplates = {
  /** Plantillas propias; si nunca se editaron, las predeterminadas. */
  getAll(): MessageTemplate[] {
    const own = store.getAll();
    return own.length ? own : DEFAULT_TEMPLATES;
  },
  subscribe: (l: (list: MessageTemplate[]) => void) => store.subscribe(() => l(messageTemplates.getAll())),
  save(t: MessageTemplate) {
    // Al editar por primera vez, se copian las predeterminadas para que queden como propias
    if (store.getAll().length === 0) DEFAULT_TEMPLATES.forEach((d) => d.id !== t.id && store.upsert(d));
    store.upsert(t);
  },
  remove(id: string) {
    if (store.getAll().length === 0) DEFAULT_TEMPLATES.forEach((d) => d.id !== id && store.upsert(d));
    store.remove(id);
  },
  resetToDefaults() {
    store.getAll().forEach((t) => store.remove(t.id));
  },

  render(texto: string, v: Vehicle): string {
    const link = v.urlAutonetOriginal && v.urlAutonetOriginal.startsWith('http') ? `🔗 Fotos y ficha: ${v.urlAutonetOriginal}` : '';
    const map: Record<string, string> = {
      unidad: `${v.marca} ${v.modelo} ${v.version || ''}`.replace(/\s+/g, ' ').trim(),
      marca: v.marca,
      modelo: v.modelo,
      anio: String(v.anio || ''),
      km: formatKm(v.kilometraje),
      precio: formatCurrency(v.precio, v.moneda),
      color: v.color || 'a confirmar',
      combustible: v.combustible || '',
      caja: v.caja || '',
      patente: v.patente || '',
      link,
      firma: SIGNATURE,
      firmaNombre: ADVISOR_INFO.nombre.split(' ')[0],
    };
    return texto
      .replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m))
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  },
};

/** Link de WhatsApp: con número abre ese chat; sin número deja elegir el contacto. */
export function whatsappLink(text: string, phone?: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length >= 8) {
    const intl = digits.startsWith('54') ? digits : `549${digits.replace(/^0/, '')}`;
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
