import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');

// SVG representation of the Autonet red icon with white Car
const carPath = `
  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.8 2 11 2 11.2V16c0 .6.4 1 1 1h2" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="7" cy="17" r="2.2" stroke="#ffffff" stroke-width="2.5" fill="none"/>
  <path d="M9.2 17h5.6" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="17" cy="17" r="2.2" stroke="#ffffff" stroke-width="2.5" fill="none"/>
`;

// 1. Regular icon (192, 512, apple-touch-icon 180)
function getSvg(size, isMaskable = false) {
  const pad = isMaskable ? size * 0.2 : size * 0.12;
  const contentSize = size - pad * 2;
  const radius = isMaskable ? 0 : size * 0.22;

  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${radius}" fill="#dc2626"/>
    <g transform="translate(${pad}, ${pad}) scale(${contentSize / 24})">
      ${carPath}
    </g>
    ${!isMaskable ? `
    <text x="${size / 2}" y="${size * 0.88}" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="${size * 0.11}" fill="#ffffff" text-anchor="middle" letter-spacing="-0.5">
      autonet
    </text>` : ''}
  </svg>
  `;
}

async function run() {
  // Save icon.svg
  const svgContent = getSvg(512, false);
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent.trim());

  // Generate PNGs
  await sharp(Buffer.from(getSvg(192, false)))
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));

  await sharp(Buffer.from(getSvg(512, false)))
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));

  await sharp(Buffer.from(getSvg(512, true)))
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  await sharp(Buffer.from(getSvg(180, false)))
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  console.log('PWA icons generated successfully in public/');
}

run().catch(console.error);
