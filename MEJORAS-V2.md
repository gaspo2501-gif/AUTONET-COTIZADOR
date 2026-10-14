# Autonet Cotizador — Versión 2

## Qué cambió

### Navegación
- Barra lateral fija en PC (Comercial / Gestión) y barra inferior en celular (Stock, Ventas, Comisiones, Presupuestos, Más).
- Cada sección tiene su dirección (`#stock`, `#ventas`, `#presupuestos`…): el botón "atrás" del celular funciona.
- Buscador global **Ctrl/⌘ + K**: encuentra cualquier unidad (incluso vendidas) y abre la ficha o la cotiza (Ctrl+Enter).

### Stock (búsqueda y filtros)
- Búsqueda inteligente: varias palabras a la vez ("amarok 2022 diesel"), sin importar acentos ni mayúsculas, patente con o sin espacios. Resalta lo encontrado.
- Tecla `/` para ir directo al buscador; `Esc` lo borra.
- Un solo panel de filtros para PC (lateral) y celular (hoja inferior), con cantidades por marca, combustible, caja y tracción, precio desde/hasta con formato $, año desde/hasta, km máximo.
- Filtros activos visibles como chips (un toque los quita) y atajos rápidos: 0 km, últimos años, hasta $20M/$30M, automáticos, 4x4, diésel, pendientes.
- Más órdenes (ingresos recientes, mayor km, año más antiguo, A-Z). En la tabla, se ordena tocando el encabezado.
- El orden y la vista (tarjetas/tabla) quedan recordados.
- Carga progresiva automática al hacer scroll.

### Presupuestos (nuevo)
- Reemplaza las secciones "Cotizaciones" y "Presupuestos" que estaban a medio hacer.
- Historial agrupado por día, vigencia en vivo ("vence en 3 h"), búsqueda por cliente/teléfono/patente/modelo.
- Avisa si la unidad ya se vendió o si el precio cambió desde que se presupuestó.
- WhatsApp directo al cliente (si tiene teléfono cargado) o copiar mensaje; recotizar; eliminar.
- Los datos de cliente que se cargan en un presupuesto ahora quedan guardados.

### Correcciones de errores
- **Presupuestos fantasma**: con el boleto abierto desde el cotizador se creaba y guardaba un presupuesto nuevo en cada render. Ahora se usa un borrador que no se guarda.
- **Imprimir desde el historial**: imprimía una hoja vacía porque el presupuesto no llegaba al área de impresión. Ahora todo abre por el mismo camino.
- Cabecera del celular que se superponía (nombre del asesor sobre el logo).
- Los modales ahora cierran con `Esc` y bloquean el scroll del fondo.
- Las animaciones `animate-in` no funcionaban (faltaba el plugin); ahora están definidas en el CSS.

### Técnico
- Secciones pesadas (Ventas, Comisiones, Importar PDF, Historial, Configuración) se cargan recién al abrirlas.
- Sistema de diseño en `src/index.css`: rojo = marca/navegación, azul = acciones, verde/ámbar = estados.
- Archivos nuevos: `components/layout/AppShell.tsx`, `components/stock/StockView.tsx`, `components/stock/FilterPanel.tsx`, `components/presupuestos/BudgetsView.tsx`, `components/CommandPalette.tsx`, `components/ui/*`, `hooks/*`, `utils/search.ts`, `utils/stockSort.ts`.
- Archivos eliminados (reemplazados): `Navbar.tsx`, `MobileStockHeader.tsx`, `StockFiltersBar.tsx`.
- Sin cambios: lógica de stock, Firebase, comisiones, parser de PDF, boletos, plantillas PDF, workflow de GitHub Actions, `package.json`.

## Cómo subirlo
1. Hacé una rama nueva en el repo (ej. `v2`) por si querés volver atrás.
2. Reemplazá la carpeta `src/` completa y `index.html` por los de este zip (borrando los 3 archivos eliminados).
3. Push a `main` → GitHub Actions compila y publica como siempre.

## Pendiente sugerido (no incluido)
- Quitar dependencias que no se usan (`@google/genai`, `express`, `dotenv`, `motion`): requiere regenerar `package-lock.json` con `npm install`.
- La API key de deconcesionarias está escrita en `vite.config.ts` (solo se usa en modo desarrollo); conviene moverla a una variable de entorno.
