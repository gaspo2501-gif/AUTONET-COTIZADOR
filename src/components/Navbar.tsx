import React from 'react';
import { 
  Car, 
  FileUp, 
  History, 
  Calculator, 
  FileText, 
  Settings, 
  Menu, 
  X,
  UserCheck,
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
  LogOut,
  LogIn
} from 'lucide-react';
import { ADVISOR_INFO } from '../constants/advisor';
import { SyncStatus } from '../services/firestoreService';
import { User } from 'firebase/auth';

export type NavTab = 'stock' | 'ventas' | 'actualizar' | 'historial' | 'cotizaciones' | 'presupuestos' | 'configuracion';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  availableCount: number;
  totalCount: number;
  mySalesCount?: number;
  syncStatus?: SyncStatus;
  user?: User | null;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  availableCount,
  totalCount,
  mySalesCount = 0,
  syncStatus = 'offline',
  user = null,
  onLoginClick,
  onLogoutClick,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const handleTabClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMenuOpen(false);
  };

  // Cerrar al hacer clic afuera
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // Cerrar con Escape
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 text-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* IZQUIERDA: Logo & Marca Autonet */}
          <div 
            className="flex items-center gap-3 cursor-pointer select-none min-w-0 shrink" 
            onClick={() => handleTabClick('stock')}
            title="Ir al Stock de Usados"
          >
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center shadow-xs font-black text-xl text-white tracking-wider shrink-0">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tighter text-slate-950 whitespace-nowrap">
                  auto<span className="text-red-600">net</span>
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
                  COTIZADOR
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate hidden md:block leading-tight mt-0.5">
                Gestión comercial de stock de usados
              </p>
            </div>
          </div>

          {/* DERECHA: Asesor + Avatar + Botón Menú Hamburguesa */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0" ref={menuRef}>
            {/* Sync Badge */}
            <div 
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                syncStatus === 'synced'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : syncStatus === 'syncing'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : syncStatus === 'error'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title={
                syncStatus === 'synced'
                  ? 'Sincronizado con Cloud Firestore'
                  : syncStatus === 'syncing'
                  ? 'Sincronizando con Cloud Firestore...'
                  : syncStatus === 'error'
                  ? 'Error de sincronización con Firestore'
                  : 'Modo local (Sin sincronización en la nube)'
              }
            >
              {syncStatus === 'synced' && <Cloud className="w-3.5 h-3.5 text-emerald-600" />}
              {syncStatus === 'syncing' && <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />}
              {syncStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-600" />}
              {syncStatus === 'offline' && <CloudOff className="w-3.5 h-3.5 text-slate-500" />}
              <span className="capitalize">{syncStatus === 'synced' ? 'Nube OK' : syncStatus === 'syncing' ? 'Sincronizando' : syncStatus === 'error' ? 'Error Nube' : 'Local'}</span>
            </div>

            {/* Info Asesor */}
            <div className="text-right leading-tight max-w-[140px] sm:max-w-[200px]">
              <div className="text-xs font-bold text-slate-900 truncate">
                {ADVISOR_INFO.nombre}
              </div>
              <div className="text-[11px] text-red-600 font-semibold flex items-center justify-end gap-1 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0"></span>
                <span className="truncate">{user ? (user.email?.split('@')[0] || ADVISOR_INFO.cargo) : ADVISOR_INFO.cargo}</span>
              </div>
            </div>

            {/* Avatar GN */}
            <div 
              className="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-xs font-black text-slate-800 shadow-2xs shrink-0 select-none"
              title={`${ADVISOR_INFO.nombre} - ${ADVISOR_INFO.cargo}`}
            >
              GN
            </div>

            {/* Botón Menú Hamburguesa (Siempre presente en todas las resoluciones) */}
            <button
              id="main-menu-toggle"
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className={`p-2 rounded-lg transition-colors cursor-pointer shrink-0 border ${
                menuOpen 
                  ? 'bg-red-50 text-red-700 border-red-200' 
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 border-slate-200 bg-slate-50/50'
              }`}
              aria-label={menuOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
              aria-expanded={menuOpen}
              title="Menú de navegación"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Menú Desplegable / Drawer Flotante */}
            {menuOpen && (
              <div 
                className="absolute right-4 sm:right-6 lg:right-8 top-16 mt-1 w-72 sm:w-80 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in-50 zoom-in-95 duration-100 divide-y divide-slate-100"
              >
                {/* Header del menú con resumen rápido */}
                <div className="px-4 py-2.5 bg-slate-50/80 mb-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Módulos Comerciales
                  </div>
                  <div className="text-xs font-semibold text-slate-700 mt-0.5">
                    Navegación Autonet Cotizador
                  </div>
                </div>

                <div className="p-1.5 space-y-1">
                  {/* 1. Stock */}
                  <button
                    id="nav-tab-stock"
                    type="button"
                    onClick={() => handleTabClick('stock')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      currentTab === 'stock'
                        ? 'bg-red-50 text-red-700 font-bold border-l-4 border-red-600'
                        : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Car className={`w-4 h-4 ${currentTab === 'stock' ? 'text-red-600' : 'text-slate-500'}`} />
                      <span>Stock</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      currentTab === 'stock' 
                        ? 'bg-red-600 text-white' 
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {availableCount} disp.
                    </span>
                  </button>

                  {/* 2. Mis Ventas */}
                  <button
                    id="nav-tab-ventas"
                    type="button"
                    onClick={() => handleTabClick('ventas')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      currentTab === 'ventas'
                        ? 'bg-red-50 text-red-700 font-bold border-l-4 border-red-600'
                        : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      <span>Mis Ventas</span>
                    </div>
                    {mySalesCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-teal-600 text-white">
                        {mySalesCount}
                      </span>
                    )}
                  </button>

                  {/* 3. Actualizar stock */}
                  <button
                    id="nav-tab-actualizar"
                    type="button"
                    onClick={() => handleTabClick('actualizar')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      currentTab === 'actualizar'
                        ? 'bg-red-50 text-red-700 font-bold border-l-4 border-red-600'
                        : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileUp className="w-4 h-4 text-blue-600" />
                      <span>Actualizar stock</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Importar PDF
                    </span>
                  </button>

                  {/* 4. Actualizaciones */}
                  <button
                    id="nav-tab-historial"
                    type="button"
                    onClick={() => handleTabClick('historial')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      currentTab === 'historial'
                        ? 'bg-red-50 text-red-700 font-bold border-l-4 border-red-600'
                        : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <History className="w-4 h-4 text-amber-600" />
                      <span>Actualizaciones</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Historial
                    </span>
                  </button>

                  {/* 5. Cotizaciones */}
                  <button
                    id="nav-tab-cotizaciones"
                    type="button"
                    onClick={() => handleTabClick('cotizaciones')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      currentTab === 'cotizaciones'
                        ? 'bg-red-50 text-red-700 font-bold border-l-4 border-red-600'
                        : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Calculator className="w-4 h-4 text-slate-700" />
                      <span>Cotizaciones</span>
                    </div>
                  </button>

                  {/* 6. Presupuestos */}
                  <button
                    id="nav-tab-presupuestos"
                    type="button"
                    onClick={() => handleTabClick('presupuestos')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      currentTab === 'presupuestos'
                        ? 'bg-red-50 text-red-700 font-bold border-l-4 border-red-600'
                        : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-violet-600" />
                      <span>Presupuestos</span>
                    </div>
                  </button>

                  {/* 7. Configuración */}
                  <button
                    id="nav-tab-configuracion"
                    type="button"
                    onClick={() => handleTabClick('configuracion')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      currentTab === 'configuracion'
                        ? 'bg-red-50 text-red-700 font-bold border-l-4 border-red-600'
                        : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings className="w-4 h-4 text-slate-600" />
                      <span>Configuración</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Respaldo
                    </span>
                  </button>
                </div>

                {/* Sección Sesión y Sincronización */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Sincronización Nube
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      syncStatus === 'synced' ? 'bg-emerald-100 text-emerald-800' :
                      syncStatus === 'syncing' ? 'bg-blue-100 text-blue-800' :
                      syncStatus === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {syncStatus === 'synced' ? 'Sincronizado' : syncStatus === 'syncing' ? 'Sincronizando...' : syncStatus === 'error' ? 'Error' : 'Modo Local'}
                    </span>
                  </div>

                  {user ? (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-600 truncate max-w-[170px]" title={user.email || ''}>
                        {user.email}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onLogoutClick?.();
                        }}
                        className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Salir</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onLoginClick?.();
                      }}
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Iniciar Sesión Cloud</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
