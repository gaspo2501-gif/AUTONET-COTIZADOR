const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function inspect(templateName) {
  const p = path.join(__dirname, '..', 'public', 'templates', templateName);
  const pdfBytes = fs.readFileSync(p);
  const pdf = await PDFDocument.load(pdfBytes);
  const form = pdf.getForm();
  const fields = form.getFields();

  console.log(`\n======================================================`);
  console.log(`INSPECTION: ${templateName}`);
  console.log(`Total Pages: ${pdf.getPageCount()}, Total Fields: ${fields.length}`);
  console.log(`======================================================`);

  const results = fields.map((f, i) => {
    const type = f.constructor.name;
    const name = f.getName();
    const widgets = f.acroField.getWidgets();
    let rect = 'N/A';
    if (widgets && widgets.length > 0) {
      const r = widgets[0].getRectangle();
      rect = `[x:${r.x.toFixed(1)}, y:${r.y.toFixed(1)}, w:${r.width.toFixed(1)}, h:${r.height.toFixed(1)}]`;
    }
    return { index: i + 1, name, type, rect };
  });

  console.table(results);
  return results;
}

async function run() {
  await inspect('boleto-mirage-template.pdf');
  await inspect('boleto-iruna-template.pdf');
  await inspect('boleto-oil-bull-template.pdf');
}

run().catch(console.error);
