import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss()],
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
