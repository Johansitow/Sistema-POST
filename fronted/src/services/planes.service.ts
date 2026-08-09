/**
 * planes.service.ts — catálogo de planes y plan/uso del grupo.
 * Espeja el catálogo del backend (lib/planes/catalogo.ts).
 */

import api from './api';

export type CodigoPlan = 'starter' | 'professional' | 'enterprise';

/** Módulos que un plan desbloquea (gating). Espeja ModuloPlan del backend. */
export type ModuloPlan =
  | 'recetas' | 'proveedores' | 'listas_compras' | 'clientes' | 'nomina' | 'documentos';

/** Centinela de "sin tope" que envía el backend (ILIMITADO = -1). */
export const ILIMITADO = -1;
export const esIlimitado = (v: number): boolean => v < 0;

export interface LimitesPlan {
  max_sedes: number;
  max_usuarios: number;
  max_productos: number;
  historial_reportes_dias: number;
  watermark_tickets: boolean;
}

export interface Plan {
  codigo: CodigoPlan;
  nombre: string;
  precio_mensual_cop: number;
  descripcion: string;
  destacado: boolean;
  limites: LimitesPlan;
  modulos: string[];
}

export interface PlanYUso {
  plan: CodigoPlan;
  nombre: string;
  precio_mensual_cop: number;
  limites: LimitesPlan;
  uso: { sedes: number; usuarios: number; productos: number };
  /** Módulos desbloqueados por el plan actual (para el gating de UI). */
  modulos_incluidos: ModuloPlan[];
  /** Si false, el grupo está grandfathered (ve todos los módulos). */
  gating_activo: boolean;
}

/** Ruta de sidebar → módulo gateado (los que aparecen en el menú principal). */
export const MODULO_POR_PATH: Record<string, ModuloPlan> = {
  '/recetas':        'recetas',
  '/proveedores':    'proveedores',
  '/listas-compras': 'listas_compras',
  '/clientes':       'clientes',
};

/** Formatea un valor en pesos colombianos sin decimales. */
export const formatoCOP = (valor: number): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(valor);

export const planesService = {
  /** Catálogo público (no requiere sesión) — para la página de precios. */
  async listar(): Promise<Plan[]> {
    const res = await api.get('/planes');
    return res.data.data;
  },

  /** Plan y uso del grupo del usuario autenticado. */
  async miPlan(): Promise<PlanYUso> {
    const res = await api.get('/planes/mi-plan');
    return res.data.data;
  },
};
