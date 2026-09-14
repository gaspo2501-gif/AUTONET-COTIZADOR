import React, { useState } from 'react';
import { 
  Car, 
  Lock, 
  Mail, 
  AlertCircle, 
  Loader2, 
  ShieldCheck 
} from 'lucide-react';
import { authService } from '../services/authService';
import { isFirebaseConfigured } from '../services/firebase';

interface LoginModalProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onSuccess, onCancel }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Por favor ingresa tu email y contraseña.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await authService.signIn(email, password);
      onSuccess();
    } catch (err: any) {
      console.error('Error al iniciar sesión en Firebase:', err);
      let msg = 'Error al iniciar sesión. Verifique sus credenciales.';
      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' || err?.code === 'auth/user-not-found') {
        msg = 'Email o contraseña incorrectos.';
      } else if (err?.code === 'auth/too-many-requests') {
        msg = 'Demasiados intentos fallidos. Intente más tarde.';
      } else if (err?.message) {
        msg = err.message;
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        
        {/* Cabecera */}
        <div className="bg-slate-950 p-6 text-white text-center relative">
          <div className="w-12 h-12 rounded-xl bg-red-600 mx-auto flex items-center justify-center shadow-md mb-3">
            <Car className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-black tracking-tight">
            auto<span className="text-red-600">net</span> <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 align-middle">COTIZADOR</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Iniciar sesión comercial en Cloud Firestore
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!isFirebaseConfigured && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Firebase todavía no está configurado en las variables de entorno. Puede configurar las variables en GitHub Pages o <code>.env.local</code>.
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="asesor@autonet.com.ar"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:bg-slate-300"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>INGRESANDO...</span>
              </>
            ) : (
              <span>INGRESAR</span>
            )}
          </button>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Acceso privado restringido para asesor comercial</span>
          </div>

          {onCancel && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Continuar en modo local temporal
              </button>
            </div>
          )}
        </form>

      </div>
    </div>
  );
};
