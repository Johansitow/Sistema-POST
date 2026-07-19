/**
 * mi-grupo.service — API del panel "Mi Grupo" (dueño/admin del grupo)
 *
 * Endpoints backend: /api/v1/mi-grupo (requireGrupoAdmin — owner/admin del
 * grupo o superadmin). El grupo administrado lo resuelve el backend a partir
 * del usuario; no se envía por parámetro.
 */

import api from './api';

export interface GrupoResumen {
  id:                    number;
  nombre:                string;
  nit:                   string | null;
  logo_url:              string | null;
  plan:                  string;
  plan_max_restaurantes: number;
  activo:                boolean;
}

export interface SedeMiGrupo {
  id:          number;
  nombre:      string;
  descripcion: string | null;
  logo_url:    string | null;
  direccion:   string | null;
  ciudad:      string | null;
  telefono:    string | null;
  email:       string | null;
  zona_horaria: string;
  moneda:      string;
  activo:      boolean;
  es_default:  boolean;
  _count?:     { usuarios: number };
}

export interface MiembroGrupo {
  id:           number;
  id_usuario:   number;
  rol_en_grupo: 'owner' | 'admin' | 'operador';
  usuario: { id: number; nombre_completo: string; email: string; usuario: string };
}

export interface UsuarioDeSede {
  id:         number;
  id_usuario: number;
  usuario: {
    id: number; nombre_completo: string; usuario: string; email: string; estado: string;
    rol: { id: number; nombre: string; color: string | null };
  };
}

export interface MiGrupoResumen {
  grupo:        GrupoResumen;
  restaurantes: SedeMiGrupo[];
  rol_en_grupo: string;
}

export type SedeUpdatePayload = Partial<Pick<SedeMiGrupo,
  'nombre' | 'descripcion' | 'logo_url' | 'direccion' | 'ciudad' |
  'telefono' | 'email' | 'zona_horaria' | 'moneda' | 'activo'
>>;

export const miGrupoService = {
  async getResumen(): Promise<MiGrupoResumen> {
    const { data } = await api.get<{ success: boolean; data: MiGrupoResumen }>('/mi-grupo');
    return data.data;
  },

  async getMiembros(): Promise<MiembroGrupo[]> {
    const { data } = await api.get<{ success: boolean; data: MiembroGrupo[] }>('/mi-grupo/miembros');
    return data.data;
  },

  async getUsuariosDeSede(idRestaurante: number): Promise<UsuarioDeSede[]> {
    const { data } = await api.get<{ success: boolean; data: UsuarioDeSede[] }>(
      `/mi-grupo/restaurantes/${idRestaurante}/usuarios`
    );
    return data.data;
  },

  async asignarUsuario(idRestaurante: number, idUsuario: number): Promise<void> {
    await api.post(`/mi-grupo/restaurantes/${idRestaurante}/usuarios`, { id_usuario: idUsuario });
  },

  async removerUsuario(idRestaurante: number, idUsuario: number): Promise<void> {
    await api.delete(`/mi-grupo/restaurantes/${idRestaurante}/usuarios/${idUsuario}`);
  },

  async actualizarSede(idRestaurante: number, payload: SedeUpdatePayload): Promise<SedeMiGrupo> {
    const { data } = await api.put<{ success: boolean; data: SedeMiGrupo }>(
      `/mi-grupo/restaurantes/${idRestaurante}`, payload
    );
    return data.data;
  },
};
