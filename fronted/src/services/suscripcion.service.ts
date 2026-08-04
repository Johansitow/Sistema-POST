/**
 * suscripcion.service.ts — checkout, cancelación y estado de la suscripción SaaS.
 * Espeja los endpoints /suscripciones del backend (owner/admin del grupo).
 */

import api from './api';
import type { CodigoPlan, PlanYUso } from './planes.service';

export type MetodoPago = 'nequi' | 'pse';

export interface DatosSuscripcion {
  estado: 'activa' | 'pendiente_pago' | 'vencida' | 'cancelada';
  metodo: MetodoPago | null;
  periodo_fin: string | null;
  proximo_cobro: string | null;
  monto_cop: number;
}

export interface EstadoSuscripcion extends PlanYUso {
  suscripcion: DatosSuscripcion | null;
  /** true si hay pasarela real con llaves; false = modo simulado (dev). */
  cobro_real: boolean;
}

export interface ResultadoCheckout {
  referencia: string;
  estado: 'aprobada' | 'pendiente' | 'rechazada' | 'error' | 'anulada';
  url_redireccion: string | null;
  cobro_real: boolean;
}

export const suscripcionService = {
  async estado(): Promise<EstadoSuscripcion> {
    const res = await api.get('/suscripciones/estado');
    return res.data.data;
  },

  async checkout(
    plan: CodigoPlan,
    metodo: MetodoPago,
    datosMetodo?: Record<string, unknown>,
  ): Promise<ResultadoCheckout> {
    const res = await api.post('/suscripciones/checkout', { plan, metodo, datosMetodo });
    return res.data.data;
  },

  async cancelar(): Promise<EstadoSuscripcion> {
    const res = await api.post('/suscripciones/cancelar');
    return res.data.data;
  },
};
