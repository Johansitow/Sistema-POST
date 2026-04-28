/**
 * ClienteService - Frontend
 * Consumo de /api/clientes
 */

import api from './api';

export interface ClienteCreateDTO {
  nombre_completo:    string;
  email?:             string;
  telefono?:          string;
  telefono_alterno?:  string;
  tipo_documento?:    string;
  numero_documento?:  string;
  direccion?:         string;
  ciudad?:            string;
  barrio?:            string;
  tipo_cliente?:      string;
  notas?:             string;
  preferencias?:      Record<string, any>;
  canal_adquisicion?: string;
  fecha_nacimiento?:  string;
  puntos_bienvenida?: boolean;
}

class ClienteServiceFrontend {

  async listar(params: {
    page?: number | unknown; limit?: number | unknown;
    search?: string; estado?: string; tipo_cliente?: string;
  } = {}) {
    const res = await api.get('/clientes', { params });
    return {
      data: (res.data.data || []).map(this.parse),
      meta: res.data.meta,
    };
  }

  async obtenerPorId(id: number) {
    const res = await api.get(`/clientes/${id}`);
    return this.parse(res.data.cliente);
  }

  async create(data: ClienteCreateDTO) {
    const res = await api.post('/clientes', data);
    return this.parse(res.data.cliente);
  }

  async update(id: number, data: Partial<ClienteCreateDTO>) {
    const res = await api.put(`/clientes/${id}`, data);
    return this.parse(res.data.cliente);
  }

  async cambiarEstado(id: number, estado: 'activo' | 'inactivo') {
    const res = await api.patch(`/clientes/${id}/estado`, { estado });
    return this.parse(res.data.cliente);
  }

  async estadisticas() {
    const res = await api.get('/clientes/estadisticas');
    return res.data;
  }

  // ── Órdenes ────────────────────────────────────────────────────────────────

  async getOrdenes(id: number, params: { page?: number; limit?: number } = {}) {
    const res = await api.get(`/clientes/${id}/ordenes`, { params });
    return {
      data: (res.data.data || []).map((o: any) => ({
        ...o,
        total:     Number(o.total     ?? 0),
        subtotal:  Number(o.subtotal  ?? 0),
        impuestos: Number(o.impuestos ?? 0),
        propina:   Number(o.propina   ?? 0),
      })),
      meta: res.data.meta,
    };
  }

  // ── Direcciones ────────────────────────────────────────────────────────────

  async getDirecciones(id: number) {
    const res = await api.get(`/clientes/${id}/direcciones`);
    return res.data.direcciones ?? [];
  }

  async addDireccion(id: number, data: {
    alias: string; direccion: string;
    ciudad?: string; barrio?: string; referencia?: string; es_principal?: boolean;
  }) {
    const res = await api.post(`/clientes/${id}/direcciones`, data);
    return res.data.direccion;
  }

  async updateDireccion(id: number, id_dir: number, data: any) {
    const res = await api.put(`/clientes/${id}/direcciones/${id_dir}`, data);
    return res.data.direccion;
  }

  async deleteDireccion(id: number, id_dir: number) {
    await api.delete(`/clientes/${id}/direcciones/${id_dir}`);
  }

  // ── Puntos ─────────────────────────────────────────────────────────────────

  async getPuntos(id: number, params: { page?: number; limit?: number } = {}) {
    const res = await api.get(`/clientes/${id}/puntos`, { params });
    return {
      data: res.data.data || [],
      meta: res.data.meta,
    };
  }

  async canjearPuntos(id: number, puntos: number, descripcion?: string) {
    const res = await api.post(`/clientes/${id}/puntos/canjear`, { puntos, descripcion });
    return res.data;
  }

  // ── Parser ─────────────────────────────────────────────────────────────────

  private parse(c: any) {
    return {
      ...c,
      total_gastado:     Number(c.total_gastado     ?? 0),
      puntos_acumulados: Number(c.puntos_acumulados ?? 0),
      total_ordenes:     Number(c.total_ordenes     ?? 0),
    };
  }
}

export const clienteService = new ClienteServiceFrontend();
