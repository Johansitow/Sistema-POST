/**
 * AlertaService - Frontend
 * Consumo de /api/alertas y /api/tipos-alerta
 */

import api from './api';

export interface TipoAlerta {
  id: number;
  nombre: string;
  codigo: string;
  descripcion?: string;
  icono?: string;
  color?: string;
  prioridad_default: string;
  es_sistema: boolean;
  activo: boolean;
}

export interface Alerta {
  id: number;
  id_tipo_alerta: number;
  tipo_alerta?: TipoAlerta;
  id_producto?: number;
  producto?: { id: number; nombre: string; sku: string; stock_actual: number; stock_minimo: number };
  mensaje: string;
  nivel_prioridad: string;
  es_leida: boolean;
  fecha_creacion: string;
  fecha_leida?: string;
}

export interface AlertasParams {
  page?: number;
  limit?: number;
  es_leida?: boolean;
  nivel_prioridad?: string;
  id_tipo_alerta?: number;
}

class AlertaServiceFrontend {
  async getAll(params: AlertasParams = {}): Promise<{ data: Alerta[]; meta: any }> {
    const res = await api.get('/alertas', { params });
    return res.data;
  }

  async getCountNoLeidas(): Promise<number> {
    const res = await api.get('/alertas/no-leidas/count');
    return res.data.data.total;
  }

  async marcarLeida(id: number): Promise<void> {
    await api.patch(`/alertas/${id}/leer`);
  }

  async marcarTodasLeidas(): Promise<void> {
    await api.patch('/alertas/leer-todas');
  }

  async sincronizar(): Promise<{ creadas: number; resueltas: number }> {
    const res = await api.post('/alertas/sincronizar');
    return res.data.data;
  }

  async getTipos(): Promise<TipoAlerta[]> {
    const res = await api.get('/tipos-alerta');
    return res.data.data;
  }

  async crearTipo(data: Partial<TipoAlerta>): Promise<TipoAlerta> {
    const res = await api.post('/tipos-alerta', data);
    return res.data.data;
  }

  async actualizarTipo(id: number, data: Partial<TipoAlerta>): Promise<TipoAlerta> {
    const res = await api.put(`/tipos-alerta/${id}`, data);
    return res.data.data;
  }
}

export const alertaService = new AlertaServiceFrontend();
