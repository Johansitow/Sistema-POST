/**
 * RestaurantesService — API client para gestión multi-restaurante
 */

import api from './api';

export type TipoTenant = 'compartido' | 'aislado';

export interface Restaurante {
  id:                 number;
  uuid:               string;
  nombre:             string;
  nit?:               string;
  descripcion?:       string;
  logo_url?:          string;
  direccion?:         string;
  ciudad?:            string;
  telefono?:          string;
  email?:             string;
  activo:             boolean;
  es_default:         boolean;
  tipo_tenant:        TipoTenant;
  config?:            Record<string, unknown>;
  fecha_creacion:     string;
  fecha_modificacion: string;
}

export interface CreateRestauranteDto {
  nombre:       string;
  /** Requerido por el backend — grupo al que pertenece el restaurante */
  id_grupo:     number;
  nit?:         string;
  descripcion?: string;
  logo_url?:    string;
  direccion?:   string;
  ciudad?:      string;
  telefono?:    string;
  email?:       string;
  es_default?:  boolean;
  tipo_tenant?: TipoTenant;
}

export interface UsuarioAsignado {
  id:               number;
  id_usuario:       number;
  id_restaurante:   number;
  es_activo:        boolean;
  fecha_asignacion: string;
  usuario: {
    id:              number;
    nombre_completo: string;
    usuario:         string;
    email:           string;
  };
}

export interface UsuarioItem {
  id:              number;
  nombre_completo: string;
  usuario:         string;
  email:           string;
}

const BASE = '/restaurantes';

export const restaurantesService = {

  /** Solo restaurantes activos — para el selector del AppBar */
  listar: async (): Promise<Restaurante[]> => {
    const { data } = await api.get<{ success: boolean; data: Restaurante[] }>(BASE);
    return data.data;
  },

  /** Todos los restaurantes (activos e inactivos) — para la página de gestión admin */
  listarTodos: async (): Promise<Restaurante[]> => {
    const { data } = await api.get<{ success: boolean; data: Restaurante[] }>(`${BASE}?todos=true`);
    return data.data;
  },

  obtener: async (id: number): Promise<Restaurante> => {
    const { data } = await api.get<{ success: boolean; data: Restaurante }>(`${BASE}/${id}`);
    return data.data;
  },

  crear: async (dto: CreateRestauranteDto): Promise<Restaurante> => {
    const { data } = await api.post<{ success: boolean; data: Restaurante }>(BASE, dto);
    return data.data;
  },

  actualizar: async (id: number, dto: Partial<CreateRestauranteDto>): Promise<Restaurante> => {
    const { data } = await api.put<{ success: boolean; data: Restaurante }>(`${BASE}/${id}`, dto);
    return data.data;
  },

  toggleActivo: async (id: number): Promise<Restaurante> => {
    const { data } = await api.patch<{ success: boolean; data: Restaurante }>(`${BASE}/${id}/toggle`);
    return data.data;
  },

  listarUsuarios: async (id: number): Promise<UsuarioAsignado[]> => {
    const { data } = await api.get<{ success: boolean; data: UsuarioAsignado[] }>(`${BASE}/${id}/usuarios`);
    return data.data;
  },

  asignarUsuario: async (id: number, id_usuario: number): Promise<UsuarioAsignado> => {
    const { data } = await api.post<{ success: boolean; data: UsuarioAsignado }>(`${BASE}/${id}/usuarios`, { id_usuario });
    return data.data;
  },

  removerUsuario: async (id: number, userId: number): Promise<void> => {
    await api.delete(`${BASE}/${id}/usuarios/${userId}`);
  },

  buscarUsuarios: async (q?: string): Promise<UsuarioItem[]> => {
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    const { data } = await api.get<{ success: boolean; data: UsuarioItem[] }>(`/usuarios${params}`);
    return data.data;
  },
};
