/**
 * menuService — API client para las subdivisiones editables del menú lateral
 */

import api from './api';

export interface MenuItemDTO {
  id:      number;
  path:    string;
  orden:   number;
  visible: boolean;
}

export interface MenuGrupoDTO {
  id:     number;
  nombre: string;
  orden:  number;
  items:  MenuItemDTO[];
}

export interface GuardarMenuItem  { path: string; orden: number; visible: boolean; }
export interface GuardarMenuGrupo { nombre: string; orden: number; items: GuardarMenuItem[]; }

export const menuService = {

  listar: async (): Promise<MenuGrupoDTO[]> => {
    const { data } = await api.get<{ success: boolean; data: MenuGrupoDTO[] }>('/menu');
    return data.data ?? [];
  },

  guardar: async (grupos: GuardarMenuGrupo[]): Promise<MenuGrupoDTO[]> => {
    const { data } = await api.put<{ success: boolean; data: MenuGrupoDTO[] }>('/menu', { grupos });
    return data.data ?? [];
  },
};
