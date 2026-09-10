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
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 text-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Marca Autonet */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleTabClick('stock')}>
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center shadow-xs font-black text-xl text-white tracking-wider">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tighter text-slate-950">
                  auto<span className="text-red-600">net</span>
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                  COTIZADOR
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Gestión comercial de stock de usados
              </p>
            </div>
          </div>

          {/* Navegación Desktop */}
          <nav className="hidden lg:flex items-center gap-1">
            <button
              id="nav-tab-stock"
              onClick={() => handleTabClick('stock')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                currentTab === 'stock'
                  ? 'bg-red-50 text-red-700 border-b-2 border-red-600 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Stock</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                currentTab === 'stock' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {availableCount} disp.
              </span>
            </button>

            <button
              id="nav-tab-ventas"
              onClick={() => handleTabClick('ventas')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                currentTab === 'ventas'
                  ? 'bg-red-50 text-red-700 border-b-2 border-red-600 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Mis Ventas</span>
              {mySalesCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-teal-600 text-white">
                  {mySalesCount}
                </span>
              )}
            </button>

            <button
              id="nav-tab-actualizar"
              onClick={() => handleTabClick('actualizar')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                currentTab === 'actualizar'
                  ? 'bg-red-50 text-red-700 border-b-2 border-red-600 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <FileUp className="w-4 h-4 text-blue-600" />
              <span>Actualizar stock</span>
            </button>

            <button
              id="nav-tab-historial"
              onClick={() => handleTabClick('historial')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                currentTab === 'historial'
                  ? 'bg-red-50 text-red-700 border-b-2 border-red-600 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <History className="w-4 h-4 text-amber-600" />
              <span>Actualizaciones</span>
            </button>

            <button
              id="nav-tab-cotizaciones"
              onClick={() => handleTabClick('cotizaciones')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                currentTab === 'cotizaciones'
                  ? 'bg-red-50 text-red-700 border-b-2 border-red-600 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Calculator className="w-4 h-4 text-slate-700" />
              <span>Cotizaciones</span>
            </button>

            <button
              id="nav-tab-presupuestos"
              onClick={() => handleTabClick('presupuestos')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                currentTab === 'presupuestos'
                  ? 'bg-red-50 text-red-700 border-b-2 border-red-600 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <FileText className="w-4 h-4 text-violet-600" />
              <span>Presupuestos</span>
            </button>

            <button
              id="nav-tab-configuracion"
              onClick={() => handleTabClick('configuracion')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                currentTab === 'configuracion'
                  ? 'bg-red-50 text-red-700 border-b-2 border-red-600 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Configuración</span>
            </button>
          </nav>

          {/* Quick Advisor Info */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-900">{ADVISOR_INFO.nombre}</div>
              <div className="text-[11px] text-red-600 font-semibold flex items-center justify-end gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                {ADVISOR_INFO.cargo}
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-xs font-black text-slate-800 shadow-2xs">
              GN
            </div>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex lg:hidden items-center">
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-4 space-y-1 shadow-md">
          <button
            onClick={() => handleTabClick('stock')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
              currentTab === 'stock' ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4" />
              <span>Stock ({totalCount} unidades)</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
              {availableCount} disp.
            </span>
          </button>

          <button
            onClick={() => handleTabClick('ventas')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
              currentTab === 'ventas' ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Mis Ventas (Control Comercial)</span>
            </div>
            {mySalesCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-600 text-white font-bold">
                {mySalesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabClick('actualizar')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
              currentTab === 'actualizar' ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <FileUp className="w-4 h-4 text-blue-600" />
            <span>Actualizar stock (Importar PDF)</span>
          </button>

          <button
            onClick={() => handleTabClick('historial')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
              currentTab === 'historial' ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4 text-amber-600" />
            <span>Actualizaciones (Historial)</span>
          </button>

          <button
            onClick={() => handleTabClick('cotizaciones')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
              currentTab === 'cotizaciones' ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Calculator className="w-4 h-4 text-slate-700" />
            <span>Cotizaciones</span>
          </button>

          <button
            onClick={() => handleTabClick('presupuestos')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
              currentTab === 'presupuestos' ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4 text-violet-600" />
            <span>Presupuestos</span>
          </button>

          <button
            onClick={() => handleTabClick('configuracion')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
              currentTab === 'configuracion' ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
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
