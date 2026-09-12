const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');

const AUTHORIZED_TEMPLATES = {
  IRUNA: {
    companyName: 'IRUÑA S.A.',
    fileName: 'ORIGINAL_IRUNA.pdf',
    expectedSize: 1600820,
    expectedSha256: '47e5a41c031739c6097a465c671d51b1f0ffac56987fb0297daa4e541c1fcaf3',
    expectedFields: 83,
  },
  MIRAGE: {
    companyName: 'MIRAGE S.A.',
    fileName: 'ORIGINAL_MIRAGE.pdf',
    expectedSize: 768080,
    expectedSha256: '8fc91b44b9dafd0ea75b8987f1ac19d66550278d01a642ea61a769ae952b859f',
    expectedFields: 84,
  },
  OIL_BULL: {
    companyName: 'OIL BULL S.A.',
    fileName: 'ORIGINAL_OIL_BULL.pdf',
    expectedSize: 1370582,
    expectedSha256: 'cbc05697ee1c8a6c5059dae60a2754852b8160c6d039eebf2240a61ad3277e16',
    expectedFields: 83,
  },
};

async function verifyDirectory(dirPath, label) {
  console.log(`\n========================================`);
  console.log(`VERIFICACIÓN SHA-256 Y CAMPOS EN: ${label} (${dirPath})`);
  console.log(`========================================`);

  let allMatch = true;
  const results = [];

  for (const [key, auth] of Object.entries(AUTHORIZED_TEMPLATES)) {
    const filePath = path.join(dirPath, auth.fileName);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ [${key}] ARCHIVO NO ENCONTRADO: ${filePath}`);
      allMatch = false;
      results.push({ key, exists: false, matches: false });
      continue;
    }

    const buffer = fs.readFileSync(filePath);
    const size = buffer.length;
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    let fieldCount = 0;
    try {
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      fieldCount = pdf.getForm().getFields().length;
    } catch (err) {
      console.error(`Error leyendo PDF ${auth.fileName}:`, err.message);
    }

    const sizeMatch = size === auth.expectedSize;
    const shaMatch = sha256.toLowerCase() === auth.expectedSha256.toLowerCase();
    const fieldsMatch = fieldCount === auth.expectedFields;
    const itemMatch = sizeMatch && shaMatch && fieldsMatch;

    if (!itemMatch) {
      allMatch = false;
    }

    console.log(`\nEmpresa: ${auth.companyName} (${auth.fileName})`);
    console.log(`  Tamaño:        ${size} bytes (Esperado: ${auth.expectedSize}) -> ${sizeMatch ? '✅ COINCIDE' : '❌ NO COINCIDE'}`);
    console.log(`  SHA-256:       ${sha256}`);
    console.log(`  SHA Esperado:  ${auth.expectedSha256}`);
    console.log(`  Estado Hash:   ${shaMatch ? '✅ COINCIDE' : '❌ NO COINCIDE'}`);
    console.log(`  Campos Form:   ${fieldCount} campos (Esperado: ${auth.expectedFields}) -> ${fieldsMatch ? '✅ COINCIDE' : '❌ NO COINCIDE'}`);

    results.push({
      key,
      fileName: auth.fileName,
      size,
      sha256,
      fieldCount,
      sizeMatch,
      shaMatch,
      fieldsMatch,
      itemMatch,
    });
  }

  return { allMatch, results };
}

module.exports = {
  AUTHORIZED_TEMPLATES,
  verifyDirectory,
};

if (require.main === module) {
  (async () => {
    const publicTemplatesDir = path.join(__dirname, '..', 'public', 'templates');
    const { allMatch } = await verifyDirectory(publicTemplatesDir, 'public/templates');
    if (!allMatch) {
      console.log('\nADVERTENCIA / ERROR: Las plantillas actuales no coinciden aún con los originales autorizados.');
      // En modo diagnóstico informamos el resultado
    } else {
      console.log('\n✅ TODAS LAS PLANTILLAS COINCIDEN 100% CON LOS ARCHIVOS ORIGINALES AUTORIZADOS.');
    }
  })();
}
