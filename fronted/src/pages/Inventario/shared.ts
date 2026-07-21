/**
 * Tipos y helpers compartidos entre las subsecciones de Inventario (Lotes,
 * Producción, Devoluciones).
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, Archive, Layers } from 'lucide-react';

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

export const ESTADO_CONFIG: Record<EstadoLote, {
  label: string; icon: React.ReactNode;
  badge: string; row: string;
}> = {
  activo: {
    label: 'Activo',
    icon:  React.createElement(CheckCircle2, { className: 'w-3.5 h-3.5' }),
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    row:   '',
  },
  vencido: {
    label: 'Vencido',
    icon:  React.createElement(AlertTriangle, { className: 'w-3.5 h-3.5' }),
    badge: 'bg-red-100 text-red-700 border border-red-200',
    row:   'bg-red-50/40',
  },
  agotado: {
    label: 'Agotado',
    icon:  React.createElement(Archive, { className: 'w-3.5 h-3.5' }),
    badge: 'bg-slate-100 text-slate-600 border border-slate-200',
    row:   'opacity-60',
  },
  en_produccion: {
    label: 'En producción',
    icon:  React.createElement(Layers, { className: 'w-3.5 h-3.5' }),
    badge: 'bg-blue-100 text-blue-700 border border-blue-200',
    row:   '',
  },
};

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
