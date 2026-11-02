/**
 * DETECCIÓN DE FILAS RESALTADAS EN EL PDF DE STOCK (unidades críticas)
 *
 * Las unidades críticas vienen con la fila pintada de un color (celeste claro #D9E1F2 en la lista
 * de Autonet). Se recorren las operaciones de dibujo de la página, se juntan los rectángulos
 * rellenos con color (sin blanco, sin negro/gris oscuro de bordes) y se pasan a coordenadas de
 * página, las mismas que usa el texto (PDF.js item.transform).
 *
 * Una fila de texto se considera resaltada si los rellenos de color que la cruzan cubren buena
 * parte del ancho de la tabla (así se ignoran columnas pintadas, como la columna de numeración).
 */

export interface FillRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string; // #rrggbb
}

type Matrix = [number, number, number, number, number, number];

const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: Matrix, x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function toHex(args: any): string | null {
  if (!args) return null;
  const a = Array.isArray(args) ? args : [args];
  if (typeof a[0] === 'string') return a[0].toLowerCase();
  if (a.length >= 3 && a.every((n: any) => typeof n === 'number')) {
    const c = (n: number) => Math.round(n <= 1 ? n * 255 : n).toString(16).padStart(2, '0');
    return `#${c(a[0])}${c(a[1])}${c(a[2])}`;
  }
  return null;
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Color de resaltado: ni blanco ni casi blanco, ni oscuro (bordes/texto). */
export function isHighlightColor(hex: string): boolean {
  if (!/^#[0-9a-f]{6}$/.test(hex)) return false;
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (min >= 248) return false; // blanco
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 120) return false; // negro / gris oscuro de bordes
  // Gris neutro (sin color) muy claro: lo tomamos igual, Excel a veces usa gris para resaltar
  return max - min > 6 || lum < 245;
}

/** Rectángulos rellenos con color de una página PDF.js (en coordenadas de página). */
export async function extractFillRects(page: any, OPS: any): Promise<FillRect[]> {
  const ops = await page.getOperatorList();
  const rects: FillRect[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: { ctm: Matrix; fill: string | null }[] = [];
  let fill: string | null = '#000000';
  let pending: number[][] = []; // bboxes del path actual (coordenadas de usuario)

  const FILL_OPS = new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].filter((x) => x !== undefined));

  const flush = (paintOp: number | undefined) => {
    if (paintOp !== undefined && FILL_OPS.has(paintOp) && fill && isHighlightColor(fill)) {
      for (const [minX, minY, maxX, maxY] of pending) {
        const pts = [apply(ctm, minX, minY), apply(ctm, maxX, maxY), apply(ctm, minX, maxY), apply(ctm, maxX, minY)];
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        const r = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), color: fill };
        if (r.x1 - r.x0 >= 2 && r.y1 - r.y0 >= 3) rects.push(r);
      }
    }
    pending = [];
  };

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.save) stack.push({ ctm: [...ctm] as Matrix, fill });
    else if (fn === OPS.restore) {
      const s = stack.pop();
      if (s) {
        ctm = s.ctm;
        fill = s.fill;
      }
    } else if (fn === OPS.transform) ctm = mul(ctm, args as Matrix);
    else if (fn === OPS.setFillRGBColor || fn === OPS.setFillColor || fn === OPS.setFillColorN || fn === OPS.setFillGray || fn === OPS.setFillCMYKColor) {
      const hex =
        fn === OPS.setFillGray && typeof args?.[0] === 'number'
          ? toHex([args[0], args[0], args[0]])
          : fn === OPS.setFillCMYKColor && Array.isArray(args) && typeof args[0] === 'number' && args.length === 4
            ? toHex([(1 - args[0]) * (1 - args[3]), (1 - args[1]) * (1 - args[3]), (1 - args[2]) * (1 - args[3])])
            : toHex(args);
      if (hex) fill = hex;
    } else if (fn === OPS.constructPath) {
      // PDF.js ≥ 5: [operación de pintado, [path], minMax]; versiones viejas: [ops, args, minMax]
      const minMax = args?.[2];
      if (minMax && minMax.length >= 4 && Number.isFinite(minMax[0])) pending.push([minMax[0], minMax[1], minMax[2], minMax[3]]);
      if (typeof args?.[0] === 'number') flush(args[0]);
    } else if (fn === OPS.rectangle && Array.isArray(args)) {
      const [x, y, w, h] = args;
      pending.push([Math.min(x, x + w), Math.min(y, y + h), Math.max(x, x + w), Math.max(y, y + h)]);
    } else if (FILL_OPS.has(fn) || fn === OPS.endPath || fn === OPS.stroke || fn === OPS.closeStroke) {
      flush(fn);
    }
  }
  return rects;
}

/**
 * ¿La fila de texto a la altura `y` está resaltada?
 * Se suman los anchos de los rellenos de color que cruzan esa altura y se comparan con el ancho de la tabla.
 */
export function rowHighlightColor(rects: FillRect[], y: number, tableX0: number, tableX1: number, minCoverage = 0.45): string | null {
  const width = Math.max(1, tableX1 - tableX0);
  const byColor = new Map<string, [number, number][]>();
  for (const r of rects) {
    if (y < r.y0 - 0.5 || y > r.y1 + 0.5) continue;
    const a = Math.max(r.x0, tableX0);
    const b = Math.min(r.x1, tableX1);
    if (b <= a) continue;
    if (!byColor.has(r.color)) byColor.set(r.color, []);
    byColor.get(r.color)!.push([a, b]);
  }
  let best: string | null = null;
  let bestCov = 0;
  for (const [color, segs] of byColor) {
    segs.sort((p, q) => p[0] - q[0]);
    let cov = 0;
    let cs = -Infinity;
    let ce = -Infinity;
    for (const [a, b] of segs) {
      if (a > ce) {
        if (ce > cs) cov += ce - cs;
        cs = a;
        ce = b;
      } else ce = Math.max(ce, b);
    }
    if (ce > cs) cov += ce - cs;
    if (cov / width > bestCov) {
      bestCov = cov / width;
      best = color;
    }
  }
  return bestCov >= minCoverage ? best : null;
}
