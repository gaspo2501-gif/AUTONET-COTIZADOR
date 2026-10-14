# Autonet Cotizador — Versión 2

## Segunda etapa (piloto)

### Boletos
- **Revisión antes de generar**: DNI (7-8 dígitos), CUIT/CUIL con dígito verificador y que coincida con el DNI, chasis de 17 caracteres, patentes, cónyuge si es casado, toma de usado completa y montos que cierran.
  - Errores bloquean la generación (con la opción "Revisé los datos y quiero generar el boleto igual"). Avisos solo informan.
- **Borrador automático**: si se cierra la ventana, al volver a abrir el boleto de esa unidad se recupera lo cargado ("Empezar de cero" lo descarta).
- **Pegar datos del cliente**: se pega el mensaje de WhatsApp con sus datos y completa nombre, DNI, CUIT, domicilio, teléfono, email, nacimiento, estado civil y actividad.
- **CUIL sugerido** a partir del DNI (para confirmar con el cliente).
- **Historial de boletos** (sección Boletos): volver a descargar el PDF idéntico o abrirlo para corregir.
- **Registrar la venta desde el boleto**: abre "Registrar venta" con precio, toma de usado y Credinet/Wunder ya completos.

### Consultas
- **Mensajes listos** en la ficha de cada unidad (primera respuesta, ¿sigue disponible?, toma de usado, financiación), editables en Configuración. Abrir en WhatsApp o copiar.
- **Para ofrecer también**: 3 unidades parecidas en precio, año y tipo dentro de la ficha.
- **Comparar** hasta 3 unidades (ícono en la tarjeta o botón en la ficha) y enviar la comparación por WhatsApp.

### Seguimiento (sin cargar clientes)
- Estado de cada presupuesto: enviado / respondió / perdido / vendido.
- Recordatorio (mañana, 3 días, 7 días o fecha).
- **Para hacer hoy**: recordatorios vencidos, unidades presupuestadas que bajaron de precio y unidades que se vendieron (con mensaje armado para escribirle al cliente). El número aparece en el menú.

### Publicidad
- Generador de historias 1080×1920 con el estilo Autonet claro (cinta roja con la marca, modelo grande, foto protagonista, año/km, precio destacado, beneficios, WhatsApp y nombre).
- Variante **¡Nuevo precio!** con el precio anterior tachado (automática si el PDF trajo una baja).
- Listas: Novedades (ingresos de los últimos 30 días), Bajaron de precio, Sin publicar (nunca o hace 15+ días), Todas.
- Descarga en tanda de las seleccionadas y registro de cuándo se publicó cada unidad.
- Foto: la de la web de Autonet si el servidor lo permite; si no, "Subir foto" (tu foto mejorada).

### Técnico
- Presupuestos, boletos, mensajes y registro de publicaciones se guardan en el dispositivo **y** en Firebase (users/{uid}/budgets, boletos, messageTemplates, publications) cuando hay sesión: se ven en PC y celular.
- El lector de PDF de stock se carga solo al importar: la app abre más rápido.
- Corregido: la fecha de venta/facturación por defecto usaba la hora UTC; después de las 21 h quedaba con el día siguiente (y una venta del último día del mes podía caer en el mes siguiente).
- La ruta de publicación se toma del nombre del repositorio (sirve para el repo de pruebas sin tocar código).
- La clave de DeConcesionarias salió del código: va en `.env.local` como `AUTONET_API_KEY` (solo se usa con `npm run dev`).

---

## Primera etapa

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

## Cómo armar el repositorio de pruebas
1. Creá un repositorio nuevo en GitHub (ej. `autonet-piloto`) y subí todo el contenido del zip.
2. En Settings → Pages, elegí **GitHub Actions** como origen.
3. En Settings → Secrets and variables → Actions → **Variables**, cargá las mismas `VITE_FIREBASE_*` del repo actual (o dejalas vacías para probar en modo local, sin nube).
4. Si usás Firebase: en la consola de Firebase → Authentication → Settings → Dominios autorizados, verificá que esté `TU_USUARIO.github.io`.
5. La app queda en `https://TU_USUARIO.github.io/autonet-piloto/`.

**Importante:** si el piloto usa el mismo proyecto de Firebase que la app oficial, comparten los datos (stock, ventas, comisiones). Para probar sin riesgo, usá otro proyecto de Firebase o dejá las variables vacías.

## Pendiente sugerido (no incluido)
- Quitar dependencias que no se usan (`@google/genai`, `express`, `dotenv`, `motion`): requiere regenerar `package-lock.json` con `npm install`.
