import React from 'react';
import {
  Car,
  UserCheck,
  BadgePercent,
  FileText,
  FileUp,
  History,
  Settings,
  Search,
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
  LogIn,
  LogOut,
  Download,
  MoreHorizontal,
  X,
  FileCheck2,
  Megaphone,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { SyncStatus } from '../../services/firestoreService';
import { ADVISOR_INFO } from '../../constants/advisor';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useModalBehavior } from '../../hooks/useModalBehavior';

export type NavTab =
  | 'stock'
  | 'ventas'
  | 'comisiones'
  | 'presupuestos'
  | 'boletos'
  | 'publicidad'
  | 'actualizar'
  | 'historial'
  | 'configuracion';

interface NavItem {
  key: NavTab;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'comercial' | 'gestion';
  /** Aparece en la barra inferior del celular (el resto va en "Más"). */
  bottom?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'stock', label: 'Stock de usados', shortLabel: 'Stock', icon: Car, group: 'comercial', bottom: true },
  { key: 'presupuestos', label: 'Presupuestos', shortLabel: 'Presup.', icon: FileText, group: 'comercial', bottom: true },
  { key: 'boletos', label: 'Boletos', shortLabel: 'Boletos', icon: FileCheck2, group: 'comercial', bottom: true },
  { key: 'ventas', label: 'Mis ventas', shortLabel: 'Ventas', icon: UserCheck, group: 'comercial', bottom: true },
  { key: 'comisiones', label: 'Comisiones', shortLabel: 'Comisiones', icon: BadgePercent, group: 'comercial' },
  { key: 'publicidad', label: 'Publicidad', shortLabel: 'Publicidad', icon: Megaphone, group: 'comercial' },
  { key: 'actualizar', label: 'Actualizar stock', icon: FileUp, group: 'gestion' },
  { key: 'historial', label: 'Historial de cargas', icon: History, group: 'gestion' },
  { key: 'configuracion', label: 'Configuración', icon: Settings, group: 'gestion' },
];

export const TAB_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  stock: { title: 'Stock de usados', subtitle: 'Autonet Usados Seleccionados · Neuquén y Río Negro' },
  ventas: { title: 'Mis ventas', subtitle: 'Unidades vendidas y datos de facturación' },
  comisiones: { title: 'Comisiones', subtitle: 'Liquidación mensual y proyección de premios' },
  presupuestos: { title: 'Presupuestos', subtitle: 'Seguimiento de lo que enviaste a cada cliente' },
  boletos: { title: 'Boletos', subtitle: 'Boletos de compraventa generados' },
  publicidad: { title: 'Publicidad', subtitle: 'Historias para Instagram y estados de WhatsApp' },
  actualizar: { title: 'Actualizar stock', subtitle: 'Importar la lista oficial en PDF' },
  historial: { title: 'Historial de cargas', subtitle: 'Registro de actualizaciones de stock' },
  configuracion: { title: 'Configuración', subtitle: 'Asesor, respaldo y sincronización' },
};

interface AppShellProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  badges: Partial<Record<NavTab, number | string>>;
  syncStatus: SyncStatus;
  user: User | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onOpenSearch: () => void;
  children: React.ReactNode;
}

const SYNC_META: Record<SyncStatus, { label: string; cls: string; dot: string; Icon: React.ComponentType<{ className?: string }> }> = {
  synced: { label: 'Nube OK', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', Icon: Cloud },
  syncing: { label: 'Sincronizando', cls: 'text-action-700 bg-action-50 border-action-200', dot: 'bg-action-600', Icon: RefreshCw },
  error: { label: 'Error de nube', cls: 'text-brand-700 bg-brand-50 border-brand-200', dot: 'bg-brand-600', Icon: AlertCircle },
  offline: { label: 'Modo local', cls: 'text-slate-600 bg-slate-100 border-slate-200', dot: 'bg-slate-400', Icon: CloudOff },
};

export const SyncPill: React.FC<{ status: SyncStatus; compact?: boolean }> = ({ status, compact }) => {
  const m = SYNC_META[status] || SYNC_META.offline;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border text-[11px] font-semibold ${compact ? 'px-2 py-1' : 'px-2.5 py-1'} ${m.cls}`}
      title={m.label}
    >
      <m.Icon className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      {!compact && <span>{m.label}</span>}
    </span>
  );
};

const BrandMark: React.FC<{ subtitle?: boolean }> = ({ subtitle = true }) => (
  <div className="flex items-center gap-2.5 min-w-0">
    <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm shrink-0">
      <Car className="w-5 h-5 text-white" />
    </div>
    <div className="min-w-0 leading-none">
      <div className="font-black text-[19px] tracking-tighter text-slate-950">
        auto<span className="text-brand-600">net</span>
      </div>
      {subtitle && (
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mt-1">Cotizador</div>
      )}
    </div>
  </div>
);

const Avatar: React.FC<{ size?: string }> = ({ size = 'w-9 h-9' }) => (
  <div
    className={`${size} rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-black tracking-wide shrink-0 select-none`}
    title={`${ADVISOR_INFO.nombre} · ${ADVISOR_INFO.cargo}`}
  >
    {ADVISOR_INFO.nombre
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')}
  </div>
);

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onSelectTab,
  badges,
  syncStatus,
  user,
  onLoginClick,
  onLogoutClick,
  onOpenSearch,
  children,
}) => {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const { isInstallable, install } = usePWAInstall();
  const head = TAB_TITLES[currentTab];

  const go = (tab: NavTab) => {
    onSelectTab(tab);
    setMoreOpen(false);
    window.scrollTo({ top: 0 });
  };

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

  return (
    <div className="min-h-screen lg:pl-[var(--sidebar-w)]">
      {/* ============ SIDEBAR (escritorio) ============ */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[var(--sidebar-w)] flex-col bg-white border-r border-slate-200/80 z-40">
        <button type="button" onClick={() => go('stock')} className="px-5 h-16 flex items-center border-b border-slate-100 text-left">
          <BrandMark />
        </button>

        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-6" aria-label="Navegación principal">
          {(['comercial', 'gestion'] as const).map((group) => (
            <div key={group}>
              <div className="px-3 mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                {group === 'comercial' ? 'Comercial' : 'Gestión'}
              </div>
              <ul className="space-y-0.5">
                {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
                  const active = currentTab === item.key;
                  const badge = badges[item.key];
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        id={`nav-tab-${item.key}`}
                        onClick={() => go(item.key)}
                        aria-current={active ? 'page' : undefined}
                        className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                          active
                            ? 'bg-brand-50 text-brand-700 font-bold'
                            : 'text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-brand-600" />}
                        <item.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {badge !== undefined && badge !== 0 && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular ${
                              active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {isInstallable && (
            <button type="button" onClick={() => install()} className="mx-1 w-[calc(100%-0.5rem)] flex items-center gap-2.5 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-[12px] font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/50">
              <Download className="w-4 h-4" />
              Instalar app en este equipo
            </button>
          )}
        </nav>

        {/* Usuario + sincronización */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
            <Avatar />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[13px] font-bold text-slate-900 truncate">{ADVISOR_INFO.nombre}</div>
              <div className="text-[11px] text-slate-500 truncate">{user?.email || ADVISOR_INFO.cargo}</div>
            </div>
            {user ? (
              <button type="button" onClick={onLogoutClick} className="btn btn-ghost btn-icon !p-1.5" title="Cerrar sesión">
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={onLoginClick} className="btn btn-ghost btn-icon !p-1.5" title="Iniciar sesión en la nube">
                <LogIn className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <SyncPill status={syncStatus} />
            {!user && (
              <button type="button" onClick={onLoginClick} className="text-[11px] font-bold text-action-700 hover:underline">
                Conectar nube
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ============ TOP BAR ============ */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
        <div className="h-14 lg:h-16 px-4 sm:px-6 lg:px-8 flex items-center gap-3 max-w-[1440px] mx-auto">
          {/* Móvil: marca */}
          <div className="lg:hidden flex-1 min-w-0">
            <BrandMark subtitle={false} />
          </div>

          {/* Escritorio: título de sección */}
          <div className="hidden lg:block flex-1 min-w-0">
            <h1 className="text-[17px] font-extrabold text-slate-900 tracking-tight leading-tight truncate">{head.title}</h1>
            <p className="text-[12px] text-slate-500 truncate">{head.subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onOpenSearch}
            className="hidden sm:flex items-center gap-2 w-64 xl:w-80 px-3 py-2 rounded-xl bg-slate-100/80 hover:bg-slate-100 border border-transparent hover:border-slate-200 text-[13px] text-slate-400 transition-colors"
            aria-label="Buscar unidad en todo el stock"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Buscar unidad…</span>
            <span className="kbd">{isMac ? '⌘' : 'Ctrl'} K</span>
          </button>
          <button type="button" onClick={onOpenSearch} className="sm:hidden btn-ghost btn-icon" aria-label="Buscar unidad">
            <Search className="w-5 h-5" />
          </button>

          <div className="lg:hidden">
            <SyncPill status={syncStatus} compact />
          </div>
        </div>
      </header>

      {/* ============ CONTENIDO ============ */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-[calc(var(--bottomnav-h)+1.5rem+env(safe-area-inset-bottom))] lg:pb-10">
        {children}
      </main>

      {/* ============ BOTTOM NAV (celular / tablet) ============ */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 safe-bottom"
        aria-label="Navegación"
      >
        <div className="grid grid-cols-5 h-[var(--bottomnav-h)]">
          {NAV_ITEMS.filter((i) => i.bottom).map((item) => {
            const active = currentTab === item.key;
            const badge = badges[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => go(item.key)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 text-[10.5px] font-bold transition-colors ${
                  active ? 'text-brand-600' : 'text-slate-500'
                }`}
              >
                {active && <span className="absolute top-0 inset-x-5 h-[3px] rounded-b bg-brand-600" />}
                <span className="relative">
                  <item.icon className="w-[22px] h-[22px]" />
                  {item.key !== 'stock' && typeof badge === 'number' && badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-brand-600 text-white text-[9.5px] font-black flex items-center justify-center border-2 border-white">
                      {badge}
                    </span>
                  )}
                </span>
                <span>{item.shortLabel || item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-1 text-[10.5px] font-bold ${
              !NAV_ITEMS.some((i) => i.bottom && i.key === currentTab) ? 'text-brand-600' : 'text-slate-500'
            }`}
          >
            <MoreHorizontal className="w-[22px] h-[22px]" />
            <span>Más</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <MoreSheet
          onClose={() => setMoreOpen(false)}
          currentTab={currentTab}
          onGo={go}
          user={user}
          syncStatus={syncStatus}
          onLoginClick={() => {
            setMoreOpen(false);
            onLoginClick();
          }}
          onLogoutClick={() => {
            setMoreOpen(false);
            onLogoutClick();
          }}
          isInstallable={isInstallable}
          onInstall={() => {
            setMoreOpen(false);
            install();
          }}
        />
      )}
    </div>
  );
};

const MoreSheet: React.FC<{
  onClose: () => void;
  currentTab: NavTab;
  onGo: (t: NavTab) => void;
  user: User | null;
  syncStatus: SyncStatus;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  isInstallable: boolean;
  onInstall: () => void;
}> = ({ onClose, currentTab, onGo, user, syncStatus, onLoginClick, onLogoutClick, isInstallable, onInstall }) => {
  useModalBehavior(onClose);
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Más opciones">
      <div className="absolute inset-0 bg-slate-950/50 anim-fade" onClick={onClose} />
      <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl shadow-[var(--shadow-sheet)] anim-sheet safe-bottom">
        <div className="flex justify-center pt-2.5">
          <span className="w-10 h-1.5 rounded-full bg-slate-200" />
        </div>
        <div className="px-5 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar size="w-10 h-10" />
            <div className="leading-tight">
              <div className="text-sm font-bold text-slate-900">{ADVISOR_INFO.nombre}</div>
              <div className="text-xs text-slate-500">{user?.email || ADVISOR_INFO.cargo}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-3 pb-3 space-y-1">
          {NAV_ITEMS.filter((i) => !i.bottom).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onGo(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${
                currentTab === item.key ? 'bg-brand-50 text-brand-700' : 'text-slate-700 active:bg-slate-100'
              }`}
            >
              <item.icon className={`w-5 h-5 ${currentTab === item.key ? 'text-brand-600' : 'text-slate-400'}`} />
              {item.label}
            </button>
          ))}
          {isInstallable && (
            <button type="button" onClick={onInstall} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-700 active:bg-slate-100">
              <Download className="w-5 h-5 text-slate-400" />
              Instalar app
            </button>
          )}
        </div>
        <div className="mx-5 mb-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <SyncPill status={syncStatus} />
          {user ? (
            <button type="button" onClick={onLogoutClick} className="btn btn-sm btn-secondary">
              <LogOut className="w-3.5 h-3.5" /> Salir
            </button>
          ) : (
            <button type="button" onClick={onLoginClick} className="btn btn-sm btn-dark">
              <LogIn className="w-3.5 h-3.5" /> Conectar nube
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
