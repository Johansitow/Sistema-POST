/**
 * VariantesService — API client para variantes de productos
 */

import api from './api';

export interface ProductoVariante {
  id:          number;
  id_producto: number;
  nombre:      string;
  precio:      string | number;
  sku:         string | null;
  atributos:   Record<string, unknown> | null;
  orden:       number;
  estado:      string;
  fecha_creacion:    string;
  fecha_modificacion: string;
}

export interface CreateVarianteDto {
  nombre:    string;
  precio:    number;
  sku?:      string;
  atributos?: Record<string, unknown>;
  orden?:    number;
}

export interface ReorderItem {
  id:    number;
  orden: number;
}

const BASE = (productoId: number) => `/productos/${productoId}/variantes`;

export const variantesService = {
  listar: async (productoId: number): Promise<ProductoVariante[]> => {
    const { data } = await api.get<{ success: boolean; data: ProductoVariante[] }>(BASE(productoId));
    return data.data;
  },

  obtener: async (productoId: number, id: number): Promise<ProductoVariante> => {
    const { data } = await api.get<{ success: boolean; data: ProductoVariante }>(`${BASE(productoId)}/${id}`);
    return data.data;
  },

  crear: async (productoId: number, dto: CreateVarianteDto): Promise<ProductoVariante> => {
    const { data } = await api.post<{ success: boolean; data: ProductoVariante }>(BASE(productoId), dto);
    return data.data;
  },

  actualizar: async (productoId: number, id: number, dto: Partial<CreateVarianteDto>): Promise<ProductoVariante> => {
    const { data } = await api.put<{ success: boolean; data: ProductoVariante }>(`${BASE(productoId)}/${id}`, dto);
    return data.data;
  },

  eliminar: async (productoId: number, id: number): Promise<void> => {
    await api.delete(`${BASE(productoId)}/${id}`);
  },

  reordenar: async (productoId: number, items: ReorderItem[]): Promise<void> => {
    await api.patch(`${BASE(productoId)}/reorder`, { items });
  },
};
