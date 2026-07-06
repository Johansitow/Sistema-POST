import React from 'react';
import { Hash, Send, Check, Truck, Ban } from 'lucide-react';
import type { EstadoListaCompras } from '../../services/lista-compras.service';

export const ESTADO_LISTA_CFG: Record<EstadoListaCompras, { label: string; cls: string; icon: React.ReactNode }> = {
  generada:  { label: 'Generada',  cls: 'bg-blue-100 text-blue-700 border-blue-200',   icon: <Hash    className="w-3 h-3" /> },
  enviada:   { label: 'Enviada',   cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Send    className="w-3 h-3" /> },
  recibida:  { label: 'Recibida',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <Check   className="w-3 h-3" /> },
  parcial:   { label: 'Parcial',   cls: 'bg-violet-100 text-violet-700 border-violet-200', icon: <Truck   className="w-3 h-3" /> },
  cancelada: { label: 'Cancelada', cls: 'bg-red-100 text-red-700 border-red-200',      icon: <Ban     className="w-3 h-3" /> },
};

export const EstadoListaBadge: React.FC<{ estado: EstadoListaCompras }> = ({ estado }) => {
  const cfg = ESTADO_LISTA_CFG[estado] ?? ESTADO_LISTA_CFG.generada;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
};
