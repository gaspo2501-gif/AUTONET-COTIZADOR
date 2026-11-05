import React from 'react';
import { UserRound } from 'lucide-react';
import { SaleClient } from '../../utils/saleClient';

/** Nombre del cliente del boleto, debajo del vehículo vendido. */
export const SaleClientLine: React.FC<{ client: SaleClient | null; showContact?: boolean }> = ({ client, showContact }) => {
  if (!client) return null;
  const contact = [client.dni && `DNI ${client.dni}`, client.telefono].filter(Boolean).join(' · ');
  return (
    <div className="mt-1" title="Cliente del boleto">
      <div className="flex items-center gap-1 text-[11.5px] text-teal-800 font-bold uppercase leading-tight">
        <UserRound className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{client.nombre}</span>
      </div>
      {showContact && contact && <div className="pl-[18px] text-[10.5px] text-slate-500 font-mono whitespace-nowrap">{contact}</div>}
    </div>
  );
};
