# Autonet Cotizador — Versión 2

## Quinta etapa: toma de usado, gestoría del boleto y planilla UIF de Credinet

### Toma de usado en los presupuestos
- En el cotizador, nuevo bloque **¿ENTREGA USADO?** con marca/modelo, año y valor de toma.
- El valor de toma **se descuenta de la entrega mínima** de cada opción de financiación.
- Se muestra como "TOMA DE USADO (MODELO AÑO) $ X" en el mensaje de WhatsApp, en el presupuesto A4 y en el historial. Si no hay financiación, se muestra además el saldo a abonar.
- Al generar el boleto desde el presupuesto, la sección "Usado entregado" ya viene completa.

### Boleto: sección GESTORÍA
- PATENTAMIENTO = valor de la transferencia, impreso como "833.000 (TRANSFERENCIA)".
- GASTO CREDITICIO y PRENDA solo se imprimen cuando hay una financiación activa de BBVA, SANTANDER o GALICIA (se completan solos con los gastos calculados; botón para recalcular).
- El TOTAL de gestoría es la suma de los ítems de la sección (ya no repite el total de la operación).
- El TOTAL de FORMAS DE PAGO no cambia.

### Planilla UIF (Res. 200/2024) – solo Credinet
- Cuando el boleto tiene una financiación activa de CREDINET aparece la sección "Planilla UIF" con los datos que faltan (lugar de nacimiento, sexo, contacto de referencia, empresa, cargo, fechas, datos laborales) y el botón **Descargar planilla UIF** (también en el pie del boleto).
- Se completa el PDF original de Credinet (`public/templates/UIF_CREDINET.pdf`), no un documento nuevo. Nacionalidad y país: Argentina; fecha de confección: hoy; en PEP y Sujeto Obligado el "SI" sale tachado con una cruz y el nombre del cliente en "Quien suscribe".
- Calle y número se separan solos del domicilio (se pueden corregir).

Archivos: `services/uifPdfService.ts`, `components/boleto/UifSection.tsx` (nuevos), `public/templates/UIF_CREDINET.pdf` (nuevo); cambios en `services/financingService.ts`, `services/quoteService.ts`, `services/boletoPdfService.ts`, `config/boletoFieldMaps.ts`, `types/boleto.ts`, `components/VehicleQuoteModal.tsx`, `components/QuoteDocument.tsx`, `components/BudgetModal.tsx`, `components/presupuestos/BudgetsView.tsx`, `components/boleto/BoletoForm.tsx`, `components/boleto/BoletoModal.tsx`, `App.tsx`.

## Cuarta etapa: fotos y publicaciones automáticas desde autonet.com.ar

- GitHub Actions lee la web de Autonet **4 veces por día** (8:15, 12:15, 16:15 y 20:15, hora Argentina) y en cada publicación de la app:
  - todas las unidades publicadas, con su link, precio web y galería;
  - la **foto principal de cada unidad**, achicada a 1080 px y guardada junto a la app (así las historias se descargan sin tener que subir la foto);
  - qué unidades aparecieron nuevas en la web y cuáles bajaron de precio.
- La app lee ese catálogo al abrirse, al volver a la pestaña y cada 30 minutos. No toca Firebase: solo superpone fotos, link y precio web al stock.
- Publicidad:
  - Banner con la última lectura de la web ("hace 2 h · 150 publicadas · 140 con foto") y botón "Revisar ahora".
  - **Novedades** y **Bajaron de precio** ahora también se alimentan de la web (no solo del PDF).
  - Nueva lista **Solo en la web**: unidades publicadas en autonet.com.ar que todavía no están en tu PDF de stock; se pueden publicar igual.
- Si la web no responde, la publicación sigue y se mantiene el último catálogo.
- Para forzar una lectura en el momento: GitHub → Actions → "Deploy to GitHub Pages" → **Run workflow**.
- Archivos: `scripts/fetchAutonetWeb.mjs` (lectura de la web), `src/services/webCatalogService.ts` (uso en la app) y `.github/workflows/deploy.yml` (horarios).


## Tercera etapa: financiación y entrega mínima

- En la cotización, cada alternativa de financiación tiene: entidad, **monto a prestar**, cuotas y valor de cuota (los datos del simulador del banco).
- La app calcula la **entrega mínima** de cada entidad:
  - Sin gastos (CREDINET, BNA, BPN): auto + transferencia − monto prestado.
  - Con gastos (SANTANDER, BBVA, GALICIA): auto + transferencia + otorgamiento (4,83 % del monto) + inscripción de prenda (3 % de cuotas × valor de cuota) − monto prestado.
  - Redondeo hacia arriba configurable (por defecto a $10.000, como en el mensaje modelo).
- Se pueden cargar varias entidades a la vez para comparar entregas.
- **Mensaje de WhatsApp con tu formato nuevo**: vehículo, precio, transferencia, total, y por cada entidad la entrega mínima y el capital financiado (y los gastos y cuotas cuando corresponden). Botones "Copiar WhatsApp" y "Abrir en WhatsApp".
- El presupuesto A4 muestra una tabla con capital, plazo, gastos del crédito y entrega mínima por entidad.
- En Presupuestos se ve la entrega mínima de cada entidad en cada presupuesto.
- Configuración → **Entidades de financiación**: marcar cada entidad con o sin gastos, cambiar los porcentajes, agregar o quitar entidades y elegir el redondeo. Se sincroniza entre PC y celular.
- El boleto toma el monto financiado real de la cotización (antes ponía el 50 % del precio por defecto).


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
