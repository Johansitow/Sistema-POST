/**
 * Tipos y helpers compartidos entre las subsecciones de Inventario (Lotes,
 * Producción, Devoluciones).
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, Archive, Layers } from 'lucide-react';
import { clasesEstado, definirEstado } from '../../theme/estados';

export type EstadoLote = 'activo' | 'vencido' | 'agotado' | 'en_produccion';

export interface Lote {
  id:                     number;
  numero_lote:            string;
  id_producto:            number;
  id_usuario_responsable: number | null;
  cantidad_producida:     number | string;
  merma_cantidad:         number | string;
  merma_porcentaje:       number | string;
  fecha_produccion:       string;
  fecha_vencimiento:      string | null;
  fecha_cierre:           string | null;
  fecha_ultimo_reconteo:  string | null;
  vida_util_dias:         number | null;
  estado_lote:            EstadoLote;
  costo_produccion:       number | string | null;
  observaciones:          string | null;
  producto: {
    id:           number;
    nombre:       string;
    sku:          string;
    unidad_medida: string;
    tipo_materia: string;
  };
  responsable: {
    id:             number;
    nombre_completo: string | null;
    usuario:         string;
  } | null;
}

// Etiqueta y color vienen de theme/estados.ts (dominio 'lote'). Lo específico
// del inventario es el ícono y el resaltado de la fila: un lote vencido se tiñe
// de rojo en la tabla y uno agotado se atenúa.
const ICONO_LOTE: Record<EstadoLote, React.ReactNode> = {
  activo:        React.createElement(CheckCircle2,  { className: 'w-3.5 h-3.5' }),
  vencido:       React.createElement(AlertTriangle, { className: 'w-3.5 h-3.5' }),
  agotado:       React.createElement(Archive,       { className: 'w-3.5 h-3.5' }),
  en_produccion: React.createElement(Layers,        { className: 'w-3.5 h-3.5' }),
};

const FILA_LOTE: Record<EstadoLote, string> = {
  activo:        '',
  vencido:       'bg-peligro-50/40',
  agotado:       'opacity-60',
  en_produccion: '',
};

export const ESTADO_CONFIG = Object.fromEntries(
  (Object.keys(ICONO_LOTE) as EstadoLote[]).map(estado => [
    estado,
    {
      label: definirEstado(estado, 'lote').label,
      icon:  ICONO_LOTE[estado],
      badge: clasesEstado(estado, 'lote').insignia,
      row:   FILA_LOTE[estado],
    },
  ]),
) as Record<EstadoLote, { label: string; icon: React.ReactNode; badge: string; row: string }>;

export function diasHastaVencer(fecha: string | null): number | null {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
}

export function formatFecha(fecha: string | null): string {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: '2-digit',
  });
}
