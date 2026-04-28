/**
 * grupo-negocio.service.ts — Servicio frontend para GrupoNegocio
 * Consume /api/v1/grupos (requiere superadmin)
 */

import api from './api';

export interface GrupoNegocio {
  id:             number;
  uuid:           string;
  nombre:         string;
  nit:            string | null;
  plan:           string;
  activo:         boolean;
  fecha_creacion: string;
  restaurantes:   { id: number; nombre: string; es_default: boolean; tipo_tenant: string | null; ciudad: string | null }[];
  _count:         { restaurantes: number; usuarios: number };
}

export interface CreateGrupoDto {
  nombre: string;
  nit?:   string;
  plan?:  string;
}

export interface UpdateGrupoDto {
  nombre?: string;
  nit?:    string;
  plan?:   string;
  activo?: boolean;
}

export interface GrupoMiembro {
  id:              number;
  rol_en_grupo:    string;
  fecha_asignacion: string;
  usuario: {
    id:             number;
    nombre_completo: string;
    usuario:        string;
    email:          string;
  };
}

const BASE = '/grupos';

export const grupoNegocioService = {
  async listar(params?: { page?: number; limit?: number; activo?: boolean }): Promise<{ data: GrupoNegocio[]; total: number; page: number; totalPages: number }> {
    const { data } = await api.get(BASE, { params });
    return data.data;
  },

  async obtener(id: number): Promise<GrupoNegocio> {
    const { data } = await api.get(`${BASE}/${id}`);
    return data.data;
  },

  async crear(dto: CreateGrupoDto): Promise<GrupoNegocio> {
    const { data } = await api.post(BASE, dto);
    return data.data;
  },

  async actualizar(id: number, dto: UpdateGrupoDto): Promise<GrupoNegocio> {
    const { data } = await api.patch(`${BASE}/${id}`, dto);
    return data.data;
  },

  async listarMiembros(id: number): Promise<GrupoMiembro[]> {
    const { data } = await api.get(`${BASE}/${id}/miembros`);
    return data.data;
  },

  async asignarMiembro(id: number, id_usuario: number, rol_en_grupo: string): Promise<GrupoMiembro> {
    const { data } = await api.post(`${BASE}/${id}/miembros`, { id_usuario, rol_en_grupo });
    return data.data;
  },

  async removerMiembro(id: number, id_usuario: number): Promise<void> {
    await api.delete(`${BASE}/${id}/miembros/${id_usuario}`);
  },

  async dashboard(id: number): Promise<GrupoDashboard> {
    const { data } = await api.get(`${BASE}/${id}/dashboard`);
    return data.data;
  },
};

// ── Tipos del dashboard consolidado ──────────────────────────────────────────

export interface RestauranteMetrica {
  restaurante: { id: number; nombre: string; ciudad: string | null; tipo_tenant: string | null };
  ventas_hoy:      number;
  ordenes_hoy:     number;
  ventas_mes:      number;
  ordenes_mes:     number;
  ordenes_activas: number;
  alertas_stock:   number;
}

export interface GrupoDashboard {
  restaurantes: RestauranteMetrica[];
  totales: {
    ventas_hoy:      number;
    ordenes_hoy:     number;
    ventas_mes:      number;
    ordenes_mes:     number;
    ordenes_activas: number;
    alertas_stock:   number;
  };
}
