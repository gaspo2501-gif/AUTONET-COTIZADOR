import React from 'react';
import { 
  Car, 
  FileUp, 
  History, 
  Calculator, 
  FileText, 
  Settings, 
  CheckCircle2, 
  Menu, 
  X,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { ADVISOR_INFO } from '../constants/advisor';

export type NavTab = 'stock' | 'ventas' | 'actualizar' | 'historial' | 'cotizaciones' | 'presupuestos' | 'configuracion';


interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  availableCount: number;
  totalCount: number;
  mySalesCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  availableCount,
  totalCount,
  mySalesCount = 0,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleTabClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Marca Autonet */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleTabClick('stock')}>
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-inner font-black text-xl text-white tracking-wider">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">AUTONET</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  COTIZADOR
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium hidden sm:block">
                Gestión comercial de stock de usados
              </p>
            </div>
          </div>

          {/* Navegación Desktop */}
          <nav className="hidden lg:flex items-center gap-1">
            <button
              id="nav-tab-stock"
              onClick={() => handleTabClick('stock')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                currentTab === 'stock'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Stock</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                currentTab === 'stock' ? 'bg-blue-800 text-white' : 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
              }`}>
                {availableCount} disp.
              </span>
            </button>

            <button
              id="nav-tab-ventas"
              onClick={() => handleTabClick('ventas')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                currentTab === 'ventas'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Mis Ventas</span>
              {mySalesCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-700/80 text-white">
                  {mySalesCount}
                </span>
              )}
            </button>

            <button
              id="nav-tab-actualizar"
              onClick={() => handleTabClick('actualizar')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                currentTab === 'actualizar'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileUp className="w-4 h-4 text-sky-400" />
              <span>Actualizar stock</span>
            </button>

            <button
              id="nav-tab-historial"
              onClick={() => handleTabClick('historial')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                currentTab === 'historial'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <History className="w-4 h-4 text-amber-400" />
              <span>Actualizaciones</span>
            </button>

            <button
              id="nav-tab-cotizaciones"
              onClick={() => handleTabClick('cotizaciones')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                currentTab === 'cotizaciones'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span>Cotizaciones</span>
            </button>

            <button
              id="nav-tab-presupuestos"
              onClick={() => handleTabClick('presupuestos')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                currentTab === 'presupuestos'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileText className="w-4 h-4 text-violet-400" />
              <span>Presupuestos</span>
            </button>

            <button
              id="nav-tab-configuracion"
              onClick={() => handleTabClick('configuracion')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'configuracion'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Configuración</span>
            </button>
          </nav>

          {/* Quick Advisor Info */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-200">{ADVISOR_INFO.nombre}</div>
              <div className="text-[11px] text-emerald-400 font-medium flex items-center justify-end gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {ADVISOR_INFO.cargo}
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-blue-600 border border-blue-400 flex items-center justify-center text-xs font-black text-white shadow-xs">
              GN
            </div>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex lg:hidden items-center">
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-4 space-y-1">
          <button
            onClick={() => handleTabClick('stock')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentTab === 'stock' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4" />
              <span>Stock ({totalCount} unidades)</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
              {availableCount} disp.
            </span>
          </button>

          <button
            onClick={() => handleTabClick('ventas')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentTab === 'ventas' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Mis Ventas (Control Comercial)</span>
            </div>
            {mySalesCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-700 text-white font-bold">
                {mySalesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabClick('actualizar')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentTab === 'actualizar' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FileUp className="w-4 h-4 text-sky-400" />
            <span>Actualizar stock (Importar PDF)</span>
          </button>

          <button
            onClick={() => handleTabClick('historial')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentTab === 'historial' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4 text-amber-400" />
            <span>Actualizaciones (Historial)</span>
          </button>

          <button
            onClick={() => handleTabClick('cotizaciones')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentTab === 'cotizaciones' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Calculator className="w-4 h-4 text-emerald-400" />
            <span>Cotizaciones</span>
          </button>

          <button
            onClick={() => handleTabClick('presupuestos')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentTab === 'presupuestos' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-violet-400" />
            <span>Presupuestos</span>
          </button>

          <button
            onClick={() => handleTabClick('configuracion')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentTab === 'configuracion' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configuración y Respaldo</span>
          </button>
        </div>
      )}
    </header>
  );
};
