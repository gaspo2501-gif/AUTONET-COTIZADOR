import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Registro automático de service worker PWA con verificación periódica de actualizaciones
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, r) {
    if (r) {
      // Verificar periódicamente cada 30 minutos si hay una nueva versión publicada
      setInterval(() => {
        r.update().catch(() => {});
      }, 30 * 60 * 1000);
    }
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
