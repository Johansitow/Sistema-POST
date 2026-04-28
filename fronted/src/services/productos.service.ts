/**
 * ProductosService - Frontend
 *
 * El backend devuelve respuestas paginadas: { data: [...], meta: {...} }
 * getAll() extrae data[] y lo mapea.
 * getPaginado() devuelve la estructura completa para componentes que necesiten meta.
 */

import api from './api';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string;
  categoria_padre?: number;
  imagen_url?: string;
  estado: string;
  orden: number;
}

export interface Producto {
  id: number;
  codigo_barras?: string;
  sku: string;
  nombre: string;
  descripcion?: string;
  id_categoria?: number;
  categoria?: Categoria;
  tipo_materia: 'prima' | 'procesada';
  unidad_medida: 'unidad' | 'gramo' | 'kilogramo' | 'litro' | 'mililitro' | 'porcion';
  precio_unitario: number;
  precio_venta?: number;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo?: number;
  punto_reorden?: number;
  dias_vida_util?: number;
  requiere_refrigeracion: boolean;
  imagen_url?: string;
  es_vendible: boolean;
  estado: 'activo' | 'inactivo' | 'eliminado';
  fecha_creacion?: string;
  fecha_modificacion?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface ProductosParams {
  search?: string;
  categoria?: number;
  estado?: 'activo' | 'inactivo';
  es_vendible?: boolean;
  page?: number;
  limit?: number;
}

export interface ProductoCreateDTO {
  codigo_barras?: string;
  sku: string;
  nombre: string;
  descripcion?: string;
  id_categoria?: number;
  tipo_materia: 'prima' | 'procesada';
  unidad_medida: 'unidad' | 'gramo' | 'kilogramo' | 'litro' | 'mililitro' | 'porcion';
  precio_unitario: number;
  precio_venta?: number;
  stock_actual?: number;
  stock_minimo?: number;
  stock_maximo?: number;
  punto_reorden?: number;
  dias_vida_util?: number;
  requiere_refrigeracion?: boolean;
  imagen_url?: string;
  es_vendible?: boolean;
  estado?: 'activo' | 'inactivo';
}

export interface ProductoUpdateDTO extends Partial<ProductoCreateDTO> {}

export interface UpdateStockDTO {
  cantidad: number;
  tipo: 'entrada' | 'salida';
  motivo?: string;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

class ProductosService {
  private readonly basePath = '/productos';

  /**
   * getAll — devuelve solo el array de productos
   * El backend responde { data: [...], meta: {...} }
   * Extraemos data[] para componentes que no necesitan paginación
   */
  async getAll(params: ProductosParams = {}): Promise<Producto[]> {
    try {
      const response = await api.get<PaginatedResult<Producto>>(this.basePath, { params });
      // ← antes: response.data.map() — fallaba porque data es { data, meta }, no un array
      return response.data.data.map(p => this.parseProducto(p));
    } catch (error) {
      console.error('Error al obtener productos:', error);
      throw this.handleError(error);
    }
  }

  /**
   * getPaginado — devuelve data + meta para componentes con paginación
   */
  async getPaginado(params: ProductosParams = {}): Promise<PaginatedResult<Producto>> {
    try {
      const response = await api.get<PaginatedResult<Producto>>(this.basePath, { params });
      return {
        data: response.data.data.map(p => this.parseProducto(p)),
        meta: response.data.meta,
      };
    } catch (error) {
      console.error('Error al obtener productos paginados:', error);
      throw this.handleError(error);
    }
  }

  /**
   * getById — el backend responde con el objeto directo (no paginado)
   */
  async getById(id: number): Promise<Producto> {
    try {
      const response = await api.get<Producto>(`${this.basePath}/${id}`);
      return this.parseProducto(response.data);
    } catch (error) {
      console.error(`Error al obtener producto ${id}:`, error);
      throw this.handleError(error);
    }
  }

  async searchBySKU(sku: string): Promise<Producto | null> {
    try {
      const response = await api.get<Producto>(`${this.basePath}/sku/${sku}`);
      return this.parseProducto(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw this.handleError(error);
    }
  }

  async create(producto: ProductoCreateDTO): Promise<Producto> {
    try {
      const response = await api.post(this.basePath, producto);
      // El backend devuelve { success: true, data: producto }
      const data = response.data?.data ?? response.data;
      return this.parseProducto(data);
    } catch (error) {
      console.error('Error al crear producto:', error);
      throw this.handleError(error);
    }
  }

  async update(id: number, producto: ProductoUpdateDTO): Promise<Producto> {
    try {
      const response = await api.put<Producto>(`${this.basePath}/${id}`, producto);
      return this.parseProducto(response.data);
    } catch (error) {
      console.error(`Error al actualizar producto ${id}:`, error);
      throw this.handleError(error);
    }
  }

  async delete(id: number): Promise<void> {
    try {
      await api.delete(`${this.basePath}/${id}`);
    } catch (error) {
      console.error(`Error al eliminar producto ${id}:`, error);
      throw this.handleError(error);
    }
  }

  async updateStock(id: number, data: UpdateStockDTO): Promise<Producto> {
    try {
      const response = await api.post<Producto>(`${this.basePath}/${id}/stock`, data);
      return this.parseProducto(response.data);
    } catch (error) {
      console.error(`Error al actualizar stock del producto ${id}:`, error);
      throw this.handleError(error);
    }
  }

  async getStockBajo(): Promise<Producto[]> {
    try {
      const response = await api.get<Producto[]>(`${this.basePath}/stock/bajo`);
      return response.data.map(p => this.parseProducto(p));
    } catch (error) {
      console.error('Error al obtener productos con stock bajo:', error);
      throw this.handleError(error);
    }
  }

  /**
   * parseProducto — normaliza Decimal strings a number
   * Prisma serializa Decimal como string en JSON
   */
  private parseProducto(p: any): Producto {
    return {
      ...p,
      precio_unitario: this.toNumber(p.precio_unitario),
      precio_venta:    p.precio_venta    != null ? this.toNumber(p.precio_venta)    : undefined,
      stock_actual:    this.toNumber(p.stock_actual),
      stock_minimo:    this.toNumber(p.stock_minimo),
      stock_maximo:    p.stock_maximo    != null ? this.toNumber(p.stock_maximo)    : undefined,
      punto_reorden:   p.punto_reorden   != null ? this.toNumber(p.punto_reorden)   : undefined,
    };
  }

  private toNumber(value: any): number {
    const n = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(n) ? 0 : n;
  }

  private handleError(error: any): Error {
    if (error.response) {
      return new Error(error.response.data?.error || error.response.data?.message || 'Error en el servidor');
    } else if (error.request) {
      return new Error('No se pudo conectar con el servidor.');
    }
    return error instanceof Error ? error : new Error('Error desconocido');
  }
}

export const productosService = new ProductosService();