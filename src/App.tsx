import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutGrid, 
  List, 
  Car, 
  ArrowUpDown, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  FileUp,
  History
} from 'lucide-react';
import { StockFilters, Vehicle, VehicleStatus, ProvinceTransfer } from './types/stock';
import { stockService } from './services/stockService';
import { Navbar, NavTab } from './components/Navbar';
import { StockFiltersBar } from './components/StockFiltersBar';
import { VehicleCard } from './components/VehicleCard';
import { VehicleTable } from './components/VehicleTable';
import { VehicleDetailModal } from './components/VehicleDetailModal';
import { VehicleQuoteModal } from './components/VehicleQuoteModal';
import { UpdateStockView } from './components/UpdateStockView';
import { UpdateHistoryView } from './components/UpdateHistoryView';
import { FutureModulesView } from './components/FutureModulesView';

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
  estado: 'Disponible', // Por defecto muestra disponibles
};

export default function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => stockService.getAllVehicles());
  const [currentTab, setCurrentTab] = useState<NavTab>('stock');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sortBy, setSortBy] = useState<'disponibles_primero' | 'precio_asc' | 'precio_desc' | 'km_asc' | 'anio_desc'>('disponibles_primero');
  const [filters, setFilters] = useState<StockFilters>(DEFAULT_FILTERS);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [quoteVehicle, setQuoteVehicle] = useState<Vehicle | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'warn' } | null>(null);

  // Suscripción reactiva al stockService
  useEffect(() => {
    const unsubscribe = stockService.subscribe((updatedList) => {
      setVehicles([...updatedList]);
      // Si el vehículo seleccionado está abierto, actualizar sus datos
      if (selectedVehicle) {
        const found = updatedList.find((v) => v.id === selectedVehicle.id);
        if (found) setSelectedVehicle(found);
      }
      // Si el vehículo a cotizar está abierto, actualizar sus datos
      if (quoteVehicle) {
        const foundQuote = updatedList.find((v) => v.id === quoteVehicle.id);
        if (foundQuote) setQuoteVehicle(foundQuote);
      }
    });
    return unsubscribe;
  }, [selectedVehicle, quoteVehicle]);

  const showToast = (text: string, type: 'success' | 'info' | 'warn' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleOpenQuote = (vehicle: Vehicle) => {
    setQuoteVehicle(vehicle);
  };

  const handleUpdateVehicleTableValue = (
    vehicleId: string,
    tableValue: number,
    province: ProvinceTransfer
  ) => {
    const updated = stockService.updateVehicle(vehicleId, {
      valorTablaDnrpaEstimado: tableValue,
      provinciaRadicacion: province,
    });
    if (updated) {
      showToast(
        `Valor de tabla DNRPA ($ ${new Intl.NumberFormat('es-AR').format(tableValue)}) guardado para la unidad ${updated.patente}.`,
        'success'
      );
    }
  };

  // Manejo de cambio de estado manual (Vendido / Disponible / Reservado)
  const handleStatusChange = (id: string, newStatus: VehicleStatus) => {
    const updated = stockService.updateVehicleStatus(id, newStatus, true);
    if (updated) {
      if (newStatus === 'Vendido') {
        showToast(
          `Unidad ${updated.patente} (${updated.marca} ${updated.modelo}) marcada como VENDIDA. Se conservará este estado en futuras cargas de PDF.`,
          'info'
        );
      } else if (newStatus === 'Disponible') {
        showToast(`Unidad ${updated.patente} marcada nuevamente como DISPONIBLE.`, 'success');
      } else {
        showToast(`Unidad ${updated.patente} marcada como RESERVADA.`, 'info');
      }
    }
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  // Filtrado de vehículos
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // Búsqueda general por patente, marca, modelo, versión
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase().trim();
        const searchTarget = `${v.patente} ${v.marca} ${v.modelo} ${v.version} ${v.anio} ${v.color}`.toLowerCase();
        // También comparar patente limpia sin espacios
        const cleanPatente = v.patente.replace(/\s+/g, '').toLowerCase();
        const cleanQuery = q.replace(/\s+/g, '');
        if (!searchTarget.includes(q) && !cleanPatente.includes(cleanQuery)) {
          return false;
        }
      }

      // Marca
      if (filters.marca && v.marca !== filters.marca) return false;

      // Modelo
      if (filters.modelo && v.modelo !== filters.modelo) return false;

      // Rango de año
      if (filters.anioMin !== '' && v.anio < filters.anioMin) return false;
      if (filters.anioMax !== '' && v.anio > filters.anioMax) return false;

      // Rango de kilometraje
      if (filters.kmMin !== '' && v.kilometraje < filters.kmMin) return false;
      if (filters.kmMax !== '' && v.kilometraje > filters.kmMax) return false;

      // Rango de precio
      if (filters.precioMin !== '' && v.precio < filters.precioMin) return false;
      if (filters.precioMax !== '' && v.precio > filters.precioMax) return false;

      // Combustible
      if (filters.combustible && v.combustible !== filters.combustible) return false;

      // Caja
      if (filters.caja && v.caja !== filters.caja) return false;

      // Tracción
      if (filters.traccion && v.traccion !== filters.traccion) return false;

      // Estado
      if (filters.estado !== 'Todos') {
        if (v.estado !== filters.estado) return false;
      }

      return true;
    });
  }, [vehicles, filters]);

  // Ordenamiento
  const sortedVehicles = useMemo(() => {
    const list = [...filteredVehicles];

    return list.sort((a, b) => {
      // Prioridad de estado si sortBy es 'disponibles_primero'
      if (sortBy === 'disponibles_primero') {
        const orderMap: Record<VehicleStatus, number> = {
          Disponible: 1,
          Reservado: 2,
          Vendido: 3,
        };
        if (orderMap[a.estado] !== orderMap[b.estado]) {
          return orderMap[a.estado] - orderMap[b.estado];
        }
        // Si tienen el mismo estado, ordenar por año descendente
        return b.anio - a.anio;
      }

      if (sortBy === 'precio_asc') return a.precio - b.precio;
      if (sortBy === 'precio_desc') return b.precio - a.precio;
      if (sortBy === 'km_asc') return a.kilometraje - b.kilometraje;
      if (sortBy === 'anio_desc') return b.anio - a.anio;

      return 0;
    });
  }, [filteredVehicles, sortBy]);

  // Contadores para métricas
  const availableCount = useMemo(() => {
    return vehicles.filter((v) => v.estado === 'Disponible').length;
  }, [vehicles]);

  const reservedCount = useMemo(() => {
    return vehicles.filter((v) => v.estado === 'Reservado').length;
  }, [vehicles]);

  const soldCount = useMemo(() => {
    return vehicles.filter((v) => v.estado === 'Vendido').length;
  }, [vehicles]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col selection:bg-blue-100 selection:text-blue-900">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white shadow-xl border border-slate-700 text-xs sm:text-sm font-medium max-w-md">
            {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {toastMessage.type === 'info' && <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />}
            {toastMessage.type === 'warn' && <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Barra de Navegación Principal */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        availableCount={availableCount}
        totalCount={vehicles.length}
      />

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* VISTA 1: STOCK PRINCIPAL */}
        {currentTab === 'stock' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            
            {/* Banner Superior con métricas para el Asesor Comercial */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Stock de Usados
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                    {vehicles.length} totales
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Autonet Usados Seleccionados • Neuquén
                </p>
              </div>

              {/* Indicadores rápidos de stock */}
              <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setFilters({ ...filters, estado: 'Disponible' })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    filters.estado === 'Disponible'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-100'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>{availableCount} Disponibles</span>
                </button>

                <button
                  onClick={() => setFilters({ ...filters, estado: 'Reservado' })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    filters.estado === 'Reservado'
                      ? 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-100'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>{reservedCount} Reservados</span>
                </button>

                <button
                  onClick={() => setFilters({ ...filters, estado: 'Vendido' })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    filters.estado === 'Vendido'
                      ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-100'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>{soldCount} Vendidos</span>
                </button>
              </div>
            </div>

            {/* Barra de Filtros y Buscador */}
            <StockFiltersBar
              filters={filters}
              onFilterChange={setFilters}
              onResetFilters={resetFilters}
              availableVehicles={vehicles}
              totalResults={sortedVehicles.length}
            />

            {/* Barra de Herramientas: Conteo de resultados, Selector de vista (Tarjetas/Tabla) y Orden */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200/90 shadow-xs">
              <div className="text-xs sm:text-sm font-semibold text-slate-700">
                Mostrando <strong className="text-blue-700">{sortedVehicles.length}</strong> de {vehicles.length} unidades
                {filters.estado !== 'Todos' && (
                  <span className="text-slate-400 font-normal ml-1">
                    (Filtro estado: <em>{filters.estado}</em>)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 justify-between sm:justify-end">
                {/* Selector de Orden */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden md:inline font-medium">Ordenar:</span>
                  <select
                    id="stock-sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-blue-500"
                  >
                    <option value="disponibles_primero">Disponibles primero (Default)</option>
                    <option value="precio_asc">Menor precio</option>
                    <option value="precio_desc">Mayor precio</option>
                    <option value="km_asc">Menor kilometraje</option>
                    <option value="anio_desc">Año más nuevo</option>
                  </select>
                </div>

                {/* Alternar Vista Tarjetas / Tabla */}
                <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    id="view-mode-cards-btn"
                    onClick={() => setViewMode('cards')}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === 'cards'
                        ? 'bg-white text-blue-600 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Vista de Tarjetas"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    id="view-mode-table-btn"
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === 'table'
                        ? 'bg-white text-blue-600 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Vista de Tabla"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Listado de Vehículos o Estado Vacío */}
            {sortedVehicles.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">
                  No se encontraron unidades con los filtros seleccionados
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  Pruebe modificando los valores de año, kilometraje o precio, o limpie los filtros para ver todas las unidades disponibles.
                </p>
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Restablecer filtros</span>
                </button>
              </div>
            ) : viewMode === 'cards' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {sortedVehicles.map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    onSelect={setSelectedVehicle}
                    onStatusChange={handleStatusChange}
                    onQuote={handleOpenQuote}
                  />
                ))}
              </div>
            ) : (
              <VehicleTable
                vehicles={sortedVehicles}
                onSelect={setSelectedVehicle}
                onStatusChange={handleStatusChange}
                onQuote={handleOpenQuote}
              />
            )}
          </div>
        )}

        {/* VISTA 2: ACTUALIZAR STOCK (IMPORTAR PDF) */}
        {currentTab === 'actualizar' && (
          <UpdateStockView
            currentStock={vehicles}
            onUpdateCompleted={(fileName) => {
              showToast(`Actualización completada desde "${fileName}".`, 'success');
              setCurrentTab('stock');
            }}
            onCancel={() => setCurrentTab('stock')}
          />
        )}

        {/* VISTA 3: HISTORIAL DE ACTUALIZACIONES */}
        {currentTab === 'historial' && (
          <UpdateHistoryView />
        )}

        {/* VISTAS 4, 5, 6: MÓDULOS FUTUROS Y CONFIGURACIÓN */}
        {(currentTab === 'cotizaciones' || currentTab === 'presupuestos' || currentTab === 'configuracion') && (
          <FutureModulesView
            type={currentTab}
            vehicles={vehicles}
            onStockReset={() => setVehicles(stockService.getAllVehicles())}
            onQuoteVehicle={handleOpenQuote}
            onGoToUpdateStock={() => setCurrentTab('actualizar')}
          />
        )}
      </main>

      {/* Modal Ficha Completa del Vehículo */}
      {selectedVehicle && (
        <VehicleDetailModal
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
          onStatusChange={handleStatusChange}
          onOpenQuote={handleOpenQuote}
          onUpdateVehicleTableValue={handleUpdateVehicleTableValue}
        />
      )}

      {/* Modal de Cotización de Vehículo y Transferencia Estimada DNRPA */}
      {quoteVehicle && (
        <VehicleQuoteModal
          vehicle={quoteVehicle}
          onClose={() => setQuoteVehicle(null)}
          onUpdateVehicleTableValue={handleUpdateVehicleTableValue}
        />
      )}
    </div>
  );
}
