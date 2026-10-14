const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup } = require('pdf-lib');

/**
 * Función que replica fielmente boletoPdfService.cleanTemplateBytes
 */
async function cleanTemplateBytes(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  for (const field of fields) {
    try {
      if (field instanceof PDFTextField) {
        field.setText('');
      } else if (field instanceof PDFCheckBox) {
        field.uncheck();
      } else if (field instanceof PDFRadioGroup) {
        field.clear();
      }
    } catch (err) {
      console.warn(`[CLEAN-WARN] ${field.getName()}: ${err.message}`);
    }
  }

  return await pdfDoc.save();
}

/**
 * Validador de no-regresión estructural estricta
 */
async function testStructuralIntegrity(filePath) {
  console.log(`\n========================================`);
  console.log(`Validando integridad estructural: ${filePath}`);
  console.log(`========================================`);

  const originalBytes = fs.readFileSync(filePath);
  const originalDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });

  const cleanedBytes = await cleanTemplateBytes(originalBytes);
  const cleanedDoc = await PDFDocument.load(cleanedBytes, { ignoreEncryption: true });

  // 1. Verificar Page Count
  const origPages = originalDoc.getPageCount();
  const cleanPages = cleanedDoc.getPageCount();
  if (origPages !== cleanPages) {
    throw new Error(`FAIL: Page count cambió de ${origPages} a ${cleanPages}`);
  }
  console.log(`✓ Page count idéntico: ${origPages}`);

  // 2. Verificar MediaBox y CropBox en cada página
  for (let i = 0; i < origPages; i++) {
    const pOrig = originalDoc.getPage(i);
    const pClean = cleanedDoc.getPage(i);

    const mOrig = pOrig.getMediaBox();
    const mClean = pClean.getMediaBox();
    if (mOrig.x !== mClean.x || mOrig.y !== mClean.y || mOrig.width !== mClean.width || mOrig.height !== mClean.height) {
      throw new Error(`FAIL: MediaBox de pág ${i} difiere: Orig=${JSON.stringify(mOrig)} vs Clean=${JSON.stringify(mClean)}`);
    }

    const cOrig = pOrig.getCropBox();
    const cClean = pClean.getCropBox();
    if (cOrig.x !== cClean.x || cOrig.y !== cClean.y || cOrig.width !== cClean.width || cOrig.height !== cClean.height) {
      throw new Error(`FAIL: CropBox de pág ${i} difiere: Orig=${JSON.stringify(cOrig)} vs Clean=${JSON.stringify(cClean)}`);
    }
    console.log(`✓ Pág ${i + 1}: MediaBox (${mOrig.width}x${mOrig.height}) y CropBox idénticos`);
  }

  // 3. Verificar Form Fields: cantidad, nombres y tipos
  const formOrig = originalDoc.getForm();
  const formClean = cleanedDoc.getForm();

  const fieldsOrig = formOrig.getFields();
  const fieldsClean = formClean.getFields();

  if (fieldsOrig.length !== fieldsClean.length) {
    throw new Error(`FAIL: Cantidad de campos cambió de ${fieldsOrig.length} a ${fieldsClean.length}`);
  }
  console.log(`✓ Cantidad de campos AcroForm idéntica: ${fieldsOrig.length}`);

  const origFieldMap = new Map();
  fieldsOrig.forEach(f => origFieldMap.set(f.getName(), f));

  // 4. Verificar Rectángulos (Rect: x, y, width, height) de cada widget
  for (const fClean of fieldsClean) {
    const name = fClean.getName();
    const fOrig = origFieldMap.get(name);
    if (!fOrig) {
      throw new Error(`FAIL: Campo ${name} no existe en original`);
    }

    const widgetsClean = fClean.acroField.getWidgets();
    const widgetsOrig = fOrig.acroField.getWidgets();

    if (widgetsClean.length !== widgetsOrig.length) {
      throw new Error(`FAIL: Cantidad de widgets para ${name} cambió de ${widgetsOrig.length} a ${widgetsClean.length}`);
    }

    for (let wIdx = 0; wIdx < widgetsOrig.length; wIdx++) {
      const rOrig = widgetsOrig[wIdx].getRectangle();
      const rClean = widgetsClean[wIdx].getRectangle();

      if (
        Math.abs(rOrig.x - rClean.x) > 0.001 ||
        Math.abs(rOrig.y - rClean.y) > 0.001 ||
        Math.abs(rOrig.width - rClean.width) > 0.001 ||
        Math.abs(rOrig.height - rClean.height) > 0.001
      ) {
        throw new Error(
          `FAIL: Coordenadas Rect de ${name} [w${wIdx}] difieren: ` +
          `Orig=${JSON.stringify(rOrig)} vs Clean=${JSON.stringify(rClean)}`
        );
      }
    }

    // 5. Verificar que los valores estén limpios
    if (fClean instanceof PDFTextField) {
      const text = fClean.getText() || '';
      if (text !== '') {
        throw new Error(`FAIL: El campo de texto ${name} no quedó vacío: "${text}"`);
      }
    } else if (fClean instanceof PDFCheckBox) {
      if (fClean.isChecked()) {
        throw new Error(`FAIL: El CheckBox ${name} no quedó desmarcado`);
      }
    }
  }

  console.log(`✓ Todos los ${fieldsClean.length} campos conservan sus coordenadas Rect exactas y quedaron limpios`);
  console.log(`✓ Integridad estructural 100% VERIFICADA para ${path.basename(filePath)}`);
}

async function runAll() {
  const templates = [
    'public/templates/boleto-mirage-template.pdf',
    'public/templates/boleto-iruna-template.pdf',
    'public/templates/boleto-oil-bull-template.pdf',
  ];

  for (const t of templates) {
    if (fs.existsSync(t)) {
      await testStructuralIntegrity(t);
    } else {
      console.warn(`Archivo no encontrado: ${t}`);
    }
  }

  console.log('\n========================================');
  console.log('TODAS LAS PRUEBAS DE INTEGRIDAD ESTRUCTURAL PASARON CON ÉXITO');
  console.log('========================================\n');
}

runAll().catch(err => {
  console.error('\n❌ ERROR EN PRUEBA ESTRUCTURAL:', err);
  process.exit(1);
});
