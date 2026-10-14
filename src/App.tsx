import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { Vehicle, StockFilters, VehicleStatus, ProvinceTransfer } from './types/stock';
import { stockService } from './services/stockService';
import { CommercialBudget, quoteService } from './services/quoteService';
import { authService } from './services/authService';
import { migrationService } from './services/migrationService';
import { SyncStatus } from './services/firestoreService';
import { normalizePatent, isSameVehicle } from './utils/vehicleIdentity';
import { calculateStockCounts, applyStockFilters, validateVisibleVehiclesIntegrity } from './utils/stockSelectors';

import { AppShell, NavTab } from './components/layout/AppShell';
import { StockView } from './components/stock/StockView';
import { CommandPalette } from './components/CommandPalette';
import { Toaster, useToasts } from './components/ui/Toaster';
import { VehicleDetailModal } from './components/VehicleDetailModal';
import { VehicleQuoteModal } from './components/VehicleQuoteModal';
import { BudgetModal } from './components/BudgetModal';
import { QuoteDocument } from './components/QuoteDocument';
import { MarkAsSoldModal } from './components/MarkAsSoldModal';
import { LoginModal } from './components/LoginModal';

// Secciones pesadas: se cargan recién cuando se abren (la app inicia más rápido, sobre todo en el celular)
const MySalesView = lazy(() => import('./components/MySalesView').then((m) => ({ default: m.MySalesView })));
const CommissionsView = lazy(() => import('./components/CommissionsView').then((m) => ({ default: m.CommissionsView })));
const UpdateStockView = lazy(() => import('./components/UpdateStockView').then((m) => ({ default: m.UpdateStockView })));
const UpdateHistoryView = lazy(() => import('./components/UpdateHistoryView').then((m) => ({ default: m.UpdateHistoryView })));
const FutureModulesView = lazy(() => import('./components/FutureModulesView').then((m) => ({ default: m.FutureModulesView })));
const BudgetsView = lazy(() => import('./components/presupuestos/BudgetsView').then((m) => ({ default: m.BudgetsView })));
const MigrationModal = lazy(() => import('./components/MigrationModal').then((m) => ({ default: m.MigrationModal })));

const DEFAULT_FILTERS: StockFilters = {
  searchQuery: '',
  marca: '',
  modelo: '',
  anioMin: '',
  anioMax: '',
  kmMin: '',
  kmMax: '',
  precioMin: '',
  precioMax: '',
  combustible: '',
  caja: '',
  traccion: '',
  estado: '',
  estadoComercial: 'activo', // Por defecto muestra únicamente stock activo (Disponible + Reservado)
  ubicacion: '',
  empresa: '',
  fotosAutonet: 'todas',
};

// ---- Navegación por URL (#stock, #ventas…) para que funcione el botón "atrás" del celular ----
const VALID_TABS: NavTab[] = ['stock', 'ventas', 'comisiones', 'presupuestos', 'actualizar', 'historial', 'configuracion'];
const tabFromHash = (): NavTab => {
  const h = (typeof window !== 'undefined' ? window.location.hash : '').replace('#', '');
  if (h === 'cotizaciones') return 'presupuestos';
  return (VALID_TABS as string[]).includes(h) ? (h as NavTab) : 'stock';
};

const SectionLoader = () => (
  <div className="space-y-3 py-2" aria-busy="true" aria-label="Cargando sección">
    <div className="skeleton h-8 w-48" />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-24" />
      ))}
    </div>
    <div className="skeleton h-64" />
  </div>
);

export default function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => stockService.getAllVehicles());
  const [currentTab, setCurrentTab] = useState<NavTab>(tabFromHash);
  const [filters, setFilters] = useState<StockFilters>(DEFAULT_FILTERS);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [quoteVehicle, setQuoteVehicle] = useState<Vehicle | null>(null);
  const [activeBudget, setActiveBudget] = useState<CommercialBudget | null>(null);
  const [soldModalVehicle, setSoldModalVehicle] = useState<Vehicle | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { toasts, show: showToast, dismiss } = useToasts();

  // Firebase Auth y sincronización
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => stockService.getSyncStatus());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);

  // ---------- Navegación ----------
  const navigate = useCallback((tab: NavTab) => {
    setCurrentTab(tab);
    if (window.location.hash !== `#${tab}`) {
      window.history.pushState(null, '', `#${tab}`);
    }
  }, []);

  useEffect(() => {
    const onPop = () => setCurrentTab(tabFromHash());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  // Buscador global: Ctrl/⌘ + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- Suscripciones ----------
  useEffect(() => {
    const unsubAuth = authService.subscribe((user, isInitializing) => {
      if (isInitializing) return;
      setCurrentUser(user);
      if (user) {
        migrationService.checkMigrationNeeded(user.uid).then((needed) => {
          if (needed) setShowMigrationModal(true);
        });
      }
    });
    const unsubSync = stockService.subscribeSyncStatus(setSyncStatus);
    return () => {
      unsubAuth();
      unsubSync();
    };
  }, []);

  // Una sola suscripción al stock; los modales abiertos se refrescan con la versión más reciente
  useEffect(() => {
    const refresh = (list: Vehicle[]) => (prev: Vehicle | null) => (prev ? list.find((v) => isSameVehicle(v, prev)) || prev : prev);
    return stockService.subscribe((updatedList) => {
      setVehicles([...updatedList]);
      setSelectedVehicle(refresh(updatedList));
      setQuoteVehicle(refresh(updatedList));
      setSoldModalVehicle(refresh(updatedList));
    });
  }, []);

  // ---------- Acciones comerciales ----------
  const handleOpenQuote = useCallback((vehicle: Vehicle) => setQuoteVehicle(vehicle), []);
  const handleOpenMarkAsSold = useCallback((vehicle: Vehicle) => setSoldModalVehicle(vehicle), []);

  const handleConfirmSale = (options: {
    saleOwner: 'self' | 'other';
    soldAt?: string;
    soldPrice?: number;
    observaciones?: string;
    precioRealVenta?: number;
    ivaVenta?: 21 | 10.5;
    comisionBaseCalculada?: number;
    esCritico?: boolean;
    usaCredinet?: boolean;
    tieneTomaUsado?: boolean;
    valorTomaUsado?: number;
    ivaTomaUsado?: 21 | 10.5;
    comisionTomaCalculada?: number;
    marcaModeloTomaUsado?: string;
    patenteTomaUsado?: string;
    fechaFacturacion?: string;
  }) => {
    if (!soldModalVehicle) return;
    const targetIdentifier = normalizePatent(soldModalVehicle.patente) || soldModalVehicle.id;
    const updated = stockService.markVehicleAsSold(targetIdentifier, options);
    if (updated) {
      showToast(
        `${updated.marca} ${updated.modelo} (${updated.patente}) registrada como vendida · ${options.saleOwner === 'self' ? 'venta propia' : 'otro vendedor'}.`,
        'success'
      );
    }
  };

  const handleRevertSale = (vehicleOrPatent: Vehicle | string) => {
    const identifier = typeof vehicleOrPatent === 'string' ? vehicleOrPatent : normalizePatent(vehicleOrPatent.patente) || vehicleOrPatent.id;
    const updated = stockService.revertVehicleToAvailable(identifier);
    if (updated) showToast(`Unidad ${updated.patente} reactivada como DISPONIBLE.`, 'success');
  };

  const handleUpdateVehicleTableValue = (vehicleIdOrPatent: string, tableValue: number, province: ProvinceTransfer) => {
    const updated = stockService.updateVehicle(vehicleIdOrPatent, {
      valorTablaDnrpaEstimado: tableValue,
      provinciaRadicacion: province,
    });
    if (updated) {
      showToast(`Valor de tabla DNRPA ($ ${new Intl.NumberFormat('es-AR').format(tableValue)}) guardado para ${updated.patente}.`, 'success');
    }
  };

  const handleStatusChange = useCallback(
    (vehicleOrIdentifier: Vehicle | string, newStatus: VehicleStatus) => {
      let current: Vehicle | undefined;
      if (typeof vehicleOrIdentifier === 'object') {
        current = vehicleOrIdentifier;
      } else {
        const cleanPat = normalizePatent(vehicleOrIdentifier);
        current = stockService.getAllVehicles().find((v) => (cleanPat ? normalizePatent(v.patente) === cleanPat : v.id === vehicleOrIdentifier));
      }
      if (!current) return;

      if (newStatus === 'Vendido') {
        setSoldModalVehicle(current);
        return;
      }

      const targetKey = normalizePatent(current.patente) || current.id;
      if (newStatus === 'Disponible') {
        const updated = stockService.revertVehicleToAvailable(targetKey);
        if (updated) showToast(`Unidad ${updated.patente} marcada como DISPONIBLE.`, 'success');
        return;
      }

      const updated = stockService.updateVehicleStatus(targetKey, newStatus, true);
      if (updated) showToast(`Unidad ${updated.patente} marcada como RESERVADA.`, 'info');
    },
    [showToast]
  );

  const resetFilters = useCallback(() => setFilters({ ...DEFAULT_FILTERS }), []);

  // ---------- Datos derivados ----------
  const stockCounts = useMemo(() => calculateStockCounts(vehicles), [vehicles]);

  // Validación de seguridad en desarrollo para prevenir regresiones de filtrado
  useEffect(() => {
    if (import.meta.env?.DEV) {
      validateVisibleVehiclesIntegrity(filters.estadoComercial || 'activo', applyStockFilters(vehicles, filters));
    }
  }, [filters, vehicles]);

  const [budgetCount, setBudgetCount] = useState(() => quoteService.getBudgetHistory().filter((b) => new Date(b.fechaVencimiento).getTime() > Date.now()).length);
  useEffect(
    () => quoteService.subscribeBudgets((list) => setBudgetCount(list.filter((b) => new Date(b.fechaVencimiento).getTime() > Date.now()).length)),
    []
  );

  return (
    <>
      {/* 1. DOCUMENTO DE IMPRESIÓN (1 hoja A4). Solo visible al imprimir. */}
      <div id="quote-print-root" className="hidden print:block">
        {activeBudget && (
          <QuoteDocument
            vehicle={activeBudget.vehiculo}
            vehiclePrice={activeBudget.precioVehiculo}
            transferValue={activeBudget.transferenciaEstimada}
            total={activeBudget.totalEstimado}
            financingOptions={activeBudget.financiacion?.opciones}
            quoteDate={activeBudget.fechaEmision}
            validUntil={activeBudget.fechaVencimiento}
            clientName={activeBudget.datosCliente?.nombre}
            clientPhone={activeBudget.datosCliente?.telefono}
            advisor={activeBudget.datosAsesor}
          />
        )}
      </div>

      {/* 2. APLICACIÓN INTERACTIVA (oculta al imprimir) */}
      <div id="app-interactive-root" className="min-h-screen print:hidden selection:bg-action-100 selection:text-action-800">
        <AppShell
          currentTab={currentTab}
          onSelectTab={navigate}
          badges={{ stock: stockCounts.disponible, ventas: stockCounts.misVentas, presupuestos: budgetCount }}
          syncStatus={syncStatus}
          user={currentUser}
          onLoginClick={() => setShowLoginModal(true)}
          onLogoutClick={() => {
            authService.signOut();
            showToast('Sesión cerrada. Modo local activado.', 'info');
          }}
          onOpenSearch={() => setPaletteOpen(true)}
        >
          <div key={currentTab} className="anim-fade">
            {currentTab === 'stock' && (
              <StockView
                vehicles={vehicles}
                filters={filters}
                onFiltersChange={setFilters}
                onResetFilters={resetFilters}
                defaultFilters={DEFAULT_FILTERS}
                stockCounts={stockCounts}
                onSelect={setSelectedVehicle}
                onQuote={handleOpenQuote}
                onStatusChange={handleStatusChange}
                onOpenMarkAsSold={handleOpenMarkAsSold}
              />
            )}

            <Suspense fallback={<SectionLoader />}>
              {currentTab === 'ventas' && (
                <MySalesView vehicles={vehicles} onSelectVehicle={setSelectedVehicle} onOpenMarkAsSold={handleOpenMarkAsSold} onNavigateToStock={() => navigate('stock')} />
              )}

              {currentTab === 'comisiones' && (
                <CommissionsView vehicles={vehicles} currentUser={currentUser} onOpenMarkAsSold={handleOpenMarkAsSold} onNavigateToSales={() => navigate('ventas')} />
              )}

              {currentTab === 'presupuestos' && (
                <BudgetsView
                  vehicles={vehicles}
                  onOpenBudget={setActiveBudget}
                  onQuoteVehicle={handleOpenQuote}
                  onNewQuote={() => setPaletteOpen(true)}
                  onToast={showToast}
                />
              )}

              {currentTab === 'actualizar' && (
                <UpdateStockView
                  currentStock={vehicles}
                  onUpdateCompleted={(fileName) => {
                    showToast(`Actualización completada desde "${fileName}".`, 'success');
                    navigate('stock');
                  }}
                  onCancel={() => navigate('stock')}
                />
              )}

              {currentTab === 'historial' && <UpdateHistoryView />}

              {currentTab === 'configuracion' && (
                <FutureModulesView
                  type="configuracion"
                  vehicles={vehicles}
                  onStockReset={() => setVehicles(stockService.getAllVehicles())}
                  onQuoteVehicle={handleOpenQuote}
                  onGoToUpdateStock={() => navigate('actualizar')}
                  onOpenMigrationModal={() => (currentUser ? setShowMigrationModal(true) : setShowLoginModal(true))}
                  onOpenLoginModal={() => setShowLoginModal(true)}
                />
              )}
            </Suspense>
          </div>
        </AppShell>

        <Toaster toasts={toasts} onDismiss={dismiss} />

        {paletteOpen && (
          <CommandPalette
            vehicles={vehicles}
            onClose={() => setPaletteOpen(false)}
            onOpenVehicle={setSelectedVehicle}
            onQuoteVehicle={handleOpenQuote}
            onNavigate={navigate}
          />
        )}

        {selectedVehicle && (
          <VehicleDetailModal
            vehicle={selectedVehicle}
            onClose={() => setSelectedVehicle(null)}
            onStatusChange={handleStatusChange}
            onOpenQuote={handleOpenQuote}
            onOpenMarkAsSold={handleOpenMarkAsSold}
            onUpdateVehicleTableValue={handleUpdateVehicleTableValue}
          />
        )}

        {quoteVehicle && (
          <VehicleQuoteModal
            vehicle={quoteVehicle}
            onClose={() => setQuoteVehicle(null)}
            onUpdateVehicleTableValue={handleUpdateVehicleTableValue}
            onOpenBudget={(budget) => setActiveBudget(budget)}
          />
        )}

        {activeBudget && (
          <BudgetModal
            key={activeBudget.id}
            budget={activeBudget}
            onClose={() => setActiveBudget(null)}
            onUpdateClientData={(clientName, clientPhone) => {
              const saved = quoteService.updateBudgetClient(activeBudget.id, { nombre: clientName, telefono: clientPhone });
              setActiveBudget((prev) => (prev ? saved || { ...prev, datosCliente: { nombre: clientName, telefono: clientPhone } } : null));
              showToast('Datos del cliente guardados en el presupuesto.', 'success');
            }}
          />
        )}

        {soldModalVehicle && (
          <MarkAsSoldModal vehicle={soldModalVehicle} onClose={() => setSoldModalVehicle(null)} onConfirm={handleConfirmSale} onRevert={handleRevertSale} />
        )}

        {showLoginModal && (
          <LoginModal
            onSuccess={() => {
              setShowLoginModal(false);
              showToast('Sesión iniciada en la nube.', 'success');
            }}
            onCancel={() => setShowLoginModal(false)}
          />
        )}

        {showMigrationModal && currentUser && (
          <Suspense fallback={null}>
            <MigrationModal
              userId={currentUser.uid}
              onMigrationSuccess={(res) => {
                showToast(`Migración exitosa: ${res.cloudCounts.todos} unidades sincronizadas con la nube.`, 'success');
                setShowMigrationModal(false);
              }}
              onClose={() => setShowMigrationModal(false)}
            />
          </Suspense>
        )}
      </div>
    </>
  );
}
