/**
 * grupos-negocio.service.ts — API client para GrupoNegocio
 * Usado principalmente por el super admin para cambiar de contexto de grupo.
 */

import api from './api';

export interface GrupoNegocio {
  id:     number;
  uuid:   string;
  nombre: string;
  nit?:   string;
  logo_url?: string | null;
  plan?:  string;
  activo: boolean;
}

const BASE = '/grupos';

export const gruposNegocioService = {
  // El backend devuelve un resultado paginado: { success, data: { data: [...], total, ... } }
  listar: async (): Promise<GrupoNegocio[]> => {
    const { data } = await api.get<{ success: boolean; data: { data: GrupoNegocio[] } }>(BASE);
    return data.data.data;
  },

  obtener: async (id: number): Promise<GrupoNegocio> => {
    const { data } = await api.get<{ success: boolean; data: GrupoNegocio }>(`${BASE}/${id}`);
    return data.data;
  },
};
