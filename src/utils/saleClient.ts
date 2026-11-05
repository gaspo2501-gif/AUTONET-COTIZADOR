import React from 'react';
import { Vehicle } from '../types/stock';
import { boletoHistoryService, BoletoRecord } from '../services/boletoHistoryService';
import { normalizePatent } from './vehicleIdentity';

export interface SaleClient {
  nombre: string;
  dni?: string;
  telefono?: string;
}

/** Último boleto generado por patente (para ventas registradas antes de guardar el cliente en la venta). */
function latestByPlate(list: BoletoRecord[]): Map<string, BoletoRecord> {
  const map = new Map<string, BoletoRecord>();
  for (const b of list) {
    const key = normalizePatent(b.vehiculo?.patente);
    if (!key) continue;
    const prev = map.get(key);
    if (!prev || (b.createdAt || '') > (prev.createdAt || '')) map.set(key, b);
  }
  return map;
}

/** Devuelve una función que da el cliente (dueño del boleto) de cada venta. */
export function useSaleClients(): (v: Vehicle) => SaleClient | null {
  const [boletos, setBoletos] = React.useState<BoletoRecord[]>(() => boletoHistoryService.getAll());
  React.useEffect(() => boletoHistoryService.subscribe(setBoletos), []);
  const byPlate = React.useMemo(() => latestByPlate(boletos), [boletos]);
  return React.useCallback(
    (v: Vehicle) => {
      if (v.clienteNombre?.trim()) return { nombre: v.clienteNombre.trim(), dni: v.clienteDni, telefono: v.clienteTelefono };
      if (v.saleOwner === 'other') return null;
      const b = byPlate.get(normalizePatent(v.patente));
      if (!b || !b.clienteNombre?.trim() || b.clienteNombre === 'SIN NOMBRE') return null;
      return { nombre: b.clienteNombre.trim(), dni: b.clienteDni, telefono: b.data?.cliente?.telefono };
    },
    [byPlate]
  );
}
