import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { defineConfig, Plugin } from 'vite';

function templateManagementPlugin(): Plugin {
  return {
    name: 'template-management-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/template-status' && req.method === 'GET') {
          const authorized = {
            IRUNA: {
              fileName: 'ORIGINAL_IRUNA.pdf',
              expectedSize: 1600820,
              expectedSha256: '47e5a41c031739c6097a465c671d51b1f0ffac56987fb0297daa4e541c1fcaf3',
              expectedFields: 83,
            },
            MIRAGE: {
              fileName: 'ORIGINAL_MIRAGE.pdf',
              expectedSize: 768080,
              expectedSha256: '8fc91b44b9dafd0ea75b8987f1ac19d66550278d01a642ea61a769ae952b859f',
              expectedFields: 84,
            },
            OIL_BULL: {
              fileName: 'ORIGINAL_OIL_BULL.pdf',
              expectedSize: 1370582,
              expectedSha256: 'cbc05697ee1c8a6c5059dae60a2754852b8160c6d039eebf2240a61ad3277e16',
              expectedFields: 83,
            },
          };

          const templatesDir = path.join(process.cwd(), 'public', 'templates');
          const report: Record<string, any> = {};

          for (const [key, item] of Object.entries(authorized)) {
            const filePath = path.join(templatesDir, item.fileName);
            if (!fs.existsSync(filePath)) {
              report[key] = { exists: false, matches: false };
              continue;
            }
            const buffer = fs.readFileSync(filePath);
            const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
            const size = buffer.length;
            report[key] = {
              exists: true,
              size,
              sha256,
              expectedSize: item.expectedSize,
              expectedSha256: item.expectedSha256,
              expectedFields: item.expectedFields,
              matches: sha256.toLowerCase() === item.expectedSha256.toLowerCase(),
            };
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, report }));
          return;
        }

        if (req.url === '/api/upload-template' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (chunk) => chunks.push(chunk));
          req.on('end', async () => {
            try {
              const body = Buffer.concat(chunks);
              const json = JSON.parse(body.toString('utf-8'));
              const { fileName, base64Data } = json;

              const ALLOWED_NAMES = ['ORIGINAL_IRUNA.pdf', 'ORIGINAL_MIRAGE.pdf', 'ORIGINAL_OIL_BULL.pdf'];
              if (!ALLOWED_NAMES.includes(fileName)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Nombre de archivo no permitido' }));
                return;
              }

              const buffer = Buffer.from(base64Data, 'base64');
              const templatesDir = path.join(process.cwd(), 'public', 'templates');
              if (!fs.existsSync(templatesDir)) {
                fs.mkdirSync(templatesDir, { recursive: true });
              }

              const targetPath = path.join(templatesDir, fileName);
              fs.writeFileSync(targetPath, buffer);

              const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
              const size = buffer.length;

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, fileName, size, sha256 }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    base: '/AUTONET-COTIZADOR/',
    plugins: [react(), tailwindcss(), templateManagementPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/autonet-api': {
          target: 'https://api.deconcesionarias.com.ar/api',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/autonet-api/, ''),
          headers: {
            'api-key': '9a169d80-e446-4b45-b1d3-6fd0003d810c',
            'Origin': 'https://autonet.com.ar',
            'Referer': 'https://autonet.com.ar/',
          },
        },
      },
    },
  };
});
