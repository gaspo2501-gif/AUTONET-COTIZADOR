/** Fecha local YYYY-MM-DD (toISOString usa UTC: en Argentina, después de las 21 h da el día siguiente). */
export const todayISO = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
