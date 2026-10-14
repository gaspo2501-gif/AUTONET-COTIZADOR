import { Vehicle } from '../types/stock';
import { ADVISOR_INFO } from '../constants/advisor';
import { formatCurrency, formatKm } from '../utils/formatters';

/**
 * GENERADOR DE HISTORIAS 1080×1920 (Instagram / estados de WhatsApp)
 * Estilo Autonet claro: logo + servicios, cinta roja con la marca, modelo grande,
 * auto protagonista, año/km, precio destacado, beneficios y WhatsApp + asesor al pie.
 */

export const STORY_W = 1080;
export const STORY_H = 1920;

const C = {
  navy: '#0b1b3a',
  navySoft: '#1e3a6e',
  red: '#dc2626',
  redDark: '#b91c1c',
  ink: '#0f172a',
  muted: '#64748b',
  line: '#e2e8f0',
  bg1: '#ffffff',
  bg2: '#eef2f7',
  green: '#16a34a',
};

const SANS = "'Plus Jakarta Sans', 'Segoe UI', Roboto, Arial, sans-serif";
const DISPLAY = "'Space Grotesk', 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif";

export interface StoryOptions {
  photo?: HTMLImageElement | null;
  /** Precio anterior: activa la variante "¡NUEVO PRECIO!". */
  oldPrice?: number | null;
  benefits?: string[];
}

export async function ensureStoryFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`800 120px ${SANS}`),
      document.fonts.load(`700 120px ${DISPLAY}`),
      document.fonts.load(`600 40px ${SANS}`),
    ]);
  } catch {
    /* se usan las fuentes de respaldo */
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, weight: number, family: string, min = 40) {
  let size = start;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > min);
  return size;
}

function drawCheck(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = s * 0.14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + s * 0.28, y + s * 0.52);
  ctx.lineTo(x + s * 0.44, y + s * 0.68);
  ctx.lineTo(x + s * 0.73, y + s * 0.36);
  ctx.stroke();
  ctx.restore();
}

function drawWhatsappIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.fillStyle = '#25d366';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Globo de diálogo + tubo simplificado
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = r * 0.13;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.52, Math.PI * 0.75, Math.PI * 2.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.38, cy + r * 0.36);
  ctx.lineTo(cx - r * 0.5, cy + r * 0.6);
  ctx.lineTo(cx - r * 0.18, cy + r * 0.5);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx - r * 0.12, cy - r * 0.1, r * 0.09, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.16, cy + r * 0.16, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawStory(canvas: HTMLCanvasElement, v: Vehicle, opts: StoryOptions = {}): void {
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext('2d')!;
  const W = STORY_W;
  const PAD = 72;
  const isNewPrice = Boolean(opts.oldPrice && v.precio && opts.oldPrice > v.precio);

  // ---------- Fondo claro con acentos ----------
  const g = ctx.createLinearGradient(0, 0, 0, STORY_H);
  g.addColorStop(0, C.bg1);
  g.addColorStop(1, C.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, STORY_H);
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = C.navy;
  ctx.beginPath();
  ctx.moveTo(W, 380);
  ctx.lineTo(W, 1250);
  ctx.lineTo(W - 520, 1250);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ---------- Encabezado: logo + servicios ----------
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.red;
  roundRect(ctx, PAD, 70, 96, 96, 24);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `800 58px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('a', PAD + 48, 136);
  ctx.textAlign = 'left';
  ctx.font = `800 64px ${SANS}`;
  ctx.fillStyle = C.navy;
  ctx.fillText('auto', PAD + 120, 132);
  const autoW = ctx.measureText('auto').width;
  ctx.fillStyle = C.red;
  ctx.fillText('net', PAD + 120 + autoW, 132);
  ctx.font = `700 22px ${SANS}`;
  ctx.fillStyle = C.muted;
  ctx.fillText('USADOS SELECCIONADOS', PAD + 122, 164);

  ctx.textAlign = 'right';
  ctx.font = `700 25px ${SANS}`;
  ctx.fillStyle = C.navySoft;
  ['FINANCIACIÓN', 'TOMAMOS TU USADO', 'GESTORÍA PROPIA'].forEach((t, i) => ctx.fillText(t, W - PAD, 104 + i * 34));
  ctx.textAlign = 'left';

  // ---------- Cinta roja con la marca ----------
  const ribbonY = 236;
  const brand = (isNewPrice ? '¡NUEVO PRECIO!' : v.marca || '').toUpperCase();
  ctx.font = `800 46px ${SANS}`;
  const brandW = ctx.measureText(brand).width;
  ctx.fillStyle = isNewPrice ? C.redDark : C.red;
  ctx.beginPath();
  ctx.moveTo(0, ribbonY);
  ctx.lineTo(PAD + brandW + 70, ribbonY);
  ctx.lineTo(PAD + brandW + 30, ribbonY + 78);
  ctx.lineTo(0, ribbonY + 78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(brand, PAD, ribbonY + 56);

  // ---------- Modelo grande + versión ----------
  const model = (isNewPrice ? `${v.marca} ${v.modelo}` : v.modelo || '').toUpperCase();
  const mSize = fitText(ctx, model, W - PAD * 2, 150, 700, DISPLAY, 70);
  ctx.fillStyle = C.navy;
  ctx.font = `700 ${mSize}px ${DISPLAY}`;
  ctx.fillText(model, PAD - 4, 330 + mSize * 0.92);
  const versionY = 330 + mSize * 0.92 + 58;
  ctx.font = `600 38px ${SANS}`;
  ctx.fillStyle = C.muted;
  const version = (v.version || '').toUpperCase();
  fitText(ctx, version, W - PAD * 2, 38, 600, SANS, 26);
  ctx.fillText(version, PAD, versionY);

  // ---------- Foto protagonista ----------
  const photoY = versionY + 44;
  const photoH = 1270 - photoY;
  const photoX = PAD - 24;
  const photoW = W - (PAD - 24) * 2;
  ctx.save();
  roundRect(ctx, photoX, photoY, photoW, photoH, 44);
  ctx.clip();
  if (opts.photo && opts.photo.naturalWidth) {
    const img = opts.photo;
    const scale = Math.max(photoW / img.naturalWidth, photoH / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, photoX + (photoW - dw) / 2, photoY + (photoH - dh) / 2, dw, dh);
  } else {
    const pg = ctx.createLinearGradient(0, photoY, 0, photoY + photoH);
    pg.addColorStop(0, '#dbe3ee');
    pg.addColorStop(1, '#c7d2e0');
    ctx.fillStyle = pg;
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.fillStyle = 'rgba(11,27,58,0.35)';
    ctx.font = `700 40px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('Agregá la foto de la unidad', W / 2, photoY + photoH / 2);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  // ---------- Datos: año / km / combustible / caja ----------
  const chips = [String(v.anio || ''), formatKm(v.kilometraje).toUpperCase(), (v.combustible || '').toUpperCase(), v.caja === 'Automática' ? 'AUTOMÁTICA' : 'MANUAL'].filter(Boolean);
  let cx = PAD;
  const chipY = 1308;
  chips.forEach((t, i) => {
    ctx.font = `${i < 2 ? 800 : 700} ${i < 2 ? 40 : 32}px ${SANS}`;
    const tw = ctx.measureText(t).width;
    const w = tw + 52;
    ctx.fillStyle = i < 2 ? C.navy : '#fff';
    roundRect(ctx, cx, chipY, w, 76, 38);
    ctx.fill();
    if (i >= 2) {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.fillStyle = i < 2 ? '#fff' : C.navy;
    ctx.fillText(t, cx + 26, chipY + (i < 2 ? 52 : 49));
    cx += w + 16;
  });

  // ---------- Precio destacado ----------
  const priceY = 1418;
  const priceH = 210;
  ctx.fillStyle = C.navy;
  roundRect(ctx, PAD - 24, priceY, W - (PAD - 24) * 2, priceH, 40);
  ctx.fill();
  ctx.fillStyle = C.red;
  roundRect(ctx, PAD - 24, priceY, 22, priceH, 11);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `700 28px ${SANS}`;
  ctx.fillText(isNewPrice ? 'AHORA CONTADO' : 'PRECIO CONTADO', PAD + 26, priceY + 58);
  if (isNewPrice) {
    const old = formatCurrency(opts.oldPrice!, v.moneda);
    ctx.font = `600 34px ${SANS}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(old, W - PAD - 8, priceY + 58);
    const ow = ctx.measureText(old).width;
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(W - PAD - 8 - ow, priceY + 46);
    ctx.lineTo(W - PAD - 8, priceY + 46);
    ctx.stroke();
    ctx.textAlign = 'left';
  }
  const priceText = formatCurrency(v.precio, v.moneda);
  const pSize = fitText(ctx, priceText, W - PAD * 2 - 40, 112, 800, SANS, 60);
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${pSize}px ${SANS}`;
  ctx.fillText(priceText, PAD + 22, priceY + 168);

  // ---------- Beneficios ----------
  const benefits = (opts.benefits && opts.benefits.length ? opts.benefits : ['Financiación', 'Tomamos tu usado', 'Transferencia']).slice(0, 3);
  // Tamaño común que entra en todas las columnas
  const gap = 28;
  let bSize = 32;
  const widthFor = (size: number) => {
    ctx.font = `700 ${size}px ${SANS}`;
    return benefits.reduce((acc, b) => acc + 50 + ctx.measureText(b).width, 0) + gap * (benefits.length - 1);
  };
  while (bSize > 20 && widthFor(bSize) > W - PAD * 2) bSize -= 1;
  const total = widthFor(bSize);
  let bx = (W - total) / 2;
  benefits.forEach((b) => {
    drawCheck(ctx, bx, 1672, 38, C.green);
    ctx.fillStyle = C.navy;
    ctx.fillText(b, bx + 50, 1702);
    bx += 50 + ctx.measureText(b).width + gap;
  });

  // ---------- Pie: WhatsApp + asesor ----------
  const footY = 1770;
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, footY, W, STORY_H - footY);
  ctx.fillStyle = C.red;
  ctx.fillRect(0, footY, W, 8);
  drawWhatsappIcon(ctx, PAD + 34, footY + 78, 36);
  ctx.fillStyle = '#fff';
  ctx.font = `800 44px ${SANS}`;
  const phone = ADVISOR_INFO.telefonoFormateado || ADVISOR_INFO.telefono;
  ctx.fillText(phone, PAD + 88, footY + 76);
  ctx.font = `600 26px ${SANS}`;
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText(`${ADVISOR_INFO.nombre} · Asesor comercial`, PAD + 88, footY + 114);
  ctx.textAlign = 'right';
  ctx.font = `italic 700 30px ${SANS}`;
  ctx.fillStyle = '#fff';
  ctx.fillText('Tus sueños en marcha', W - PAD, footY + 94);
  ctx.textAlign = 'left';
}

/** Carga una imagen intentando que el canvas pueda exportarse (CORS). */
export function loadImage(src: string, cors = true): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = src;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo exportar la imagen'))), 'image/png');
    } catch (e) {
      reject(e);
    }
  });
}

export function storyFileName(v: Vehicle, variant: 'normal' | 'precio') {
  const base = `${v.marca}-${v.modelo}-${v.anio}-${v.patente}`.replace(/[^\w-]+/g, '_');
  return `historia_${variant === 'precio' ? 'nuevo-precio_' : ''}${base}.png`;
}
