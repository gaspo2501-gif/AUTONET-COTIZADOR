import { Vehicle } from '../types/stock';

/**
 * Eventos internos de la app para acciones que cruzan pantallas
 * (p. ej. desde un boleto, abrir "Registrar venta" ya completo).
 */
export type RegisterSaleDetail = { patente: string; prefill: Partial<Vehicle> };

const REGISTER_SALE = 'autonet:register-sale';

export const appEvents = {
  requestRegisterSale(detail: RegisterSaleDetail) {
    window.dispatchEvent(new CustomEvent<RegisterSaleDetail>(REGISTER_SALE, { detail }));
  },
  onRegisterSale(handler: (d: RegisterSaleDetail) => void): () => void {
    const fn = (e: Event) => handler((e as CustomEvent<RegisterSaleDetail>).detail);
    window.addEventListener(REGISTER_SALE, fn);
    return () => window.removeEventListener(REGISTER_SALE, fn);
  },
};
