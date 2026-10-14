import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  Firestore,
  getFirestore
} from 'firebase/firestore';
import { 
  getAuth, 
  browserLocalPersistence, 
  setPersistence,
  Auth 
} from 'firebase/auth';

/**
 * Verificación de configuración de Firebase desde variables de entorno Vite.
 */
export const firebaseEnvConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseEnvConfig.apiKey &&
  firebaseEnvConfig.projectId &&
  firebaseEnvConfig.appId
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseEnvConfig) : getApp();
    
    // Configurar cache persistente moderno multinavegador para Firestore offline
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });

    auth = getAuth(app);
    // Asegurar persistencia local de la sesión de autenticación
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('No se pudo establecer persistencia local para Auth:', err);
    });
  } catch (error) {
    console.error('Error inicializando Firebase:', error);
    // Fallback seguro a getFirestore si ya fue inicializado
    if (app) {
      try {
        db = getFirestore(app);
        auth = getAuth(app);
      } catch (e) {
        console.error('Fallback Firebase error:', e);
      }
    }
  }
}

export { app, db, auth };
