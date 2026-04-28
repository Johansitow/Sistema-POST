/**
 * CategoriasService — API client para gestión de categorías
 */

import api from './api';

export interface Categoria {
  id:              number;
  nombre:          string;
  descripcion?:    string;
  categoria_padre?: number;
  imagen_url?:     string;
  estado:          'activo' | 'inactivo' | 'eliminado';
  orden:           number;
  icono?:          string;
  color?:          string;
  fecha_creacion:  string;
  _count?: { productos: number };
}

/** @deprecated usar CreateCategoriaDto */
export type CategoriaCreateDTO = CreateCategoriaDto;

export interface CreateCategoriaDto {
  nombre:          string;
  descripcion?:    string;
  imagen_url?:     string;
  orden?:          number;
  icono?:          string;
  color?:          string;
  estado?:         'activo' | 'inactivo';
}

const BASE = '/categorias';

export const categoriasService = {

  listar: async (estado?: string): Promise<Categoria[]> => {
    const params = estado ? `?estado=${estado}` : '';
    const { data } = await api.get<{ success: boolean; data: Categoria[] }>(`${BASE}${params}`);
    return data.data;
  },

  obtener: async (id: number): Promise<Categoria> => {
    const { data } = await api.get<{ success: boolean; data: Categoria }>(`${BASE}/${id}`);
    return data.data;
  },

  crear: async (dto: CreateCategoriaDto): Promise<Categoria> => {
    const { data } = await api.post<{ success: boolean; data: Categoria }>(BASE, dto);
    return data.data;
  },

  actualizar: async (id: number, dto: Partial<CreateCategoriaDto>): Promise<Categoria> => {
    const { data } = await api.put<{ success: boolean; data: Categoria }>(`${BASE}/${id}`, dto);
    return data.data;
  },

  eliminar: async (id: number): Promise<void> => {
    await api.delete(`${BASE}/${id}`);
  },

    /** Actualiza el campo `orden` de múltiples categorías en una sola transacción */
  reordenar: async (items: { id: number; orden: number }[]): Promise<void> => {
    await api.patch(`${BASE}/reorder`, { items });
  },

  toggleEstado: async (id: number, activo: boolean): Promise<Categoria> => {
    const { data } = await api.put<{ success: boolean; data: Categoria }>(`${BASE}/${id}`, {
      estado: activo ? 'activo' : 'inactivo',
    });
    return data.data;
  },

  // ── Aliases para compatibilidad con código existente ─────────────────────
  getAll:  async (estado?: string): Promise<Categoria[]> => {
    const params = estado ? `?estado=${estado}` : '';
    const { data } = await api.get<{ success: boolean; data: Categoria[] }>(`${BASE}${params}`);
    return data.data;
  },
  create:  async (dto: CreateCategoriaDto): Promise<Categoria> => {
    const { data } = await api.post<{ success: boolean; data: Categoria }>(BASE, dto);
    return data.data;
  },
  update:  async (id: number, dto: Partial<CreateCategoriaDto>): Promise<Categoria> => {
    const { data } = await api.put<{ success: boolean; data: Categoria }>(`${BASE}/${id}`, dto);
    return data.data;
  },
  delete:  async (id: number): Promise<void> => {
    await api.delete(`${BASE}/${id}`);
  },
  reorder: async (items: { id: number; orden: number }[]): Promise<void> => {
    await api.patch(`${BASE}/reorder`, { items });
  },
};
