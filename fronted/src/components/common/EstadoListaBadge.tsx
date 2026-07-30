import React from 'react';
import { Hash, Send, Check, Truck, Ban } from 'lucide-react';
import type { EstadoListaCompras } from '../../services/lista-compras.service';
import { clasesEstado, definirEstado } from '../../theme/estados';

/** Ícono por estado — lo único específico de esta insignia. */
const ICONOS: Record<EstadoListaCompras, React.ReactNode> = {
  generada:  <Hash  className="w-3 h-3" />,
  enviada:   <Send  className="w-3 h-3" />,
  recibida:  <Check className="w-3 h-3" />,
  parcial:   <Truck className="w-3 h-3" />,
  cancelada: <Ban   className="w-3 h-3" />,
};

// Color y etiqueta salen de theme/estados.ts (dominio 'lista'). `parcial` era
// violeta, un color sin significado en el resto del sistema; ahora es info,
// como cualquier otro estado en curso.
export const ESTADO_LISTA_CFG = Object.fromEntries(
  (Object.keys(ICONOS) as EstadoListaCompras[]).map(estado => [
    estado,
    {
      label: definirEstado(estado, 'lista').label,
      cls:   clasesEstado(estado, 'lista').insignia,
      icon:  ICONOS[estado],
    },
  ]),
) as Record<EstadoListaCompras, { label: string; cls: string; icon: React.ReactNode }>;

export const EstadoListaBadge: React.FC<{ estado: EstadoListaCompras }> = ({ estado }) => {
  const cfg = ESTADO_LISTA_CFG[estado] ?? ESTADO_LISTA_CFG.generada;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
};
