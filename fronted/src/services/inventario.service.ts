/**
 * Inventario Service - NUEVO
 * Compatible con backend Cocina Oculta (versión final)
 */

import api from './api';

// ============================================================================
// INTERFACES
// ============================================================================

export interface Movimiento {
  id: number;
  id_producto: number;
  producto?: {
    id: number;
    nombre: string;
    sku: string;
    categoria?: {
      nombre: string;
    };
  };
  tipo_movimiento: 'entrada' | 'salida' | 'ajuste' | 'merma' | 'produccion' | 'venta' | 'devolucion';
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  motivo: string;
  id_proveedor?: number;
  id_lote?: number;
  referencia?: string;
  fecha_movimiento: string;
}

export interface MovimientoCreateDTO {
  id_producto: number;
  tipo_movimiento: 'entrada' | 'salida' | 'ajuste' | 'merma' | 'produccion' | 'venta' | 'devolucion';
  cantidad: number;
  motivo: string;
  id_proveedor?: number;
  id_lote?: number;
  referencia?: string;
}

export interface MovimientosParams {
  id_producto?: number;
  tipo?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  page?: number;
  limit?: number;
}

export interface EstadisticasMovimientos {
  porTipo: Array<{
    tipo: string;
    cantidad_movimientos: number;
    cantidad_total: number;
  }>;
  totalMovimientos: number;
  productosAfectados: number;
  periodo: string;
}

export interface Lote {
  id: number;
  numero_lote: string;
  id_producto: number;
  producto?: {
    nombre: string;
    sku: string;
    categoria?: {
      nombre: string;
    };
  };
  cantidad_producida: number;
  merma_cantidad: number;
  merma_porcentaje: number;
  fecha_produccion: string;
  fecha_vencimiento?: string;
  estado_lote: string;
  costo_produccion?: number;
  observaciones?: string;
}

export interface ValorInventario {
  valorTotal: number;
  totalProductos: number;
  productos: Array<{
    id: number;
    nombre: string;
    sku: string;
    stock_actual: number;
    precio_unitario: number;
    valor_total: number;
    categoria?: {
      nombre: string;
    };
  }>;
  porCategoria: Array<{
    nombre: string;
    productos: number;
    valor: number;
  }>;
}

// ============================================================================
// SERVICIO
// ============================================================================

class InventarioService {
  private readonly basePath = '/inventario';

  /**
   * Obtener movimientos
   */
  async getMovimientos(params: MovimientosParams = {}): Promise<{ data: Movimiento[]; pagination: any }> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.id_producto) queryParams.append('id_producto', params.id_producto.toString());
      if (params.tipo) queryParams.append('tipo', params.tipo);
      if (params.fecha_desde) queryParams.append('fecha_desde', params.fecha_desde);
      if (params.fecha_hasta) queryParams.append('fecha_hasta', params.fecha_hasta);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());

      const queryString = queryParams.toString();
      const url = queryString 
        ? `${this.basePath}/movimientos?${queryString}` 
        : `${this.basePath}/movimientos`;

      const response = await api.get(url);
      
      return {
        data: response.data.data.map((m: any) => this.parseMovimiento(m)),
        pagination: response.data.pagination,
      };
    } catch (error) {
      console.error('Error al obtener movimientos:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Registrar movimiento
   */
  async registrarMovimiento(movimiento: MovimientoCreateDTO): Promise<any> {
    try {
      const response = await api.post(`${this.basePath}/movimientos`, movimiento);
      return response.data;
    } catch (error) {
      console.error('Error al registrar movimiento:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Obtener estadísticas de movimientos
   */
  async getEstadisticas(dias: number = 30): Promise<EstadisticasMovimientos> {
    try {
      const response = await api.get<{ success: boolean; data: EstadisticasMovimientos }>(
        `${this.basePath}/movimientos/stats?dias=${dias}`
      );
      return response.data.data;
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Obtener lotes próximos a vencer
   */
  async getLotesProximosVencer(dias: number = 30): Promise<Lote[]> {
    try {
      const response = await api.get<{ success: boolean; data: Lote[] }>(
        `${this.basePath}/lotes/vencimiento?dias=${dias}`
      );

      return response.data.data.map(l => ({
        ...l,
        cantidad_producida: this.toNumber(l.cantidad_producida),
        merma_cantidad: this.toNumber(l.merma_cantidad),
        merma_porcentaje: this.toNumber(l.merma_porcentaje),
        costo_produccion: l.costo_produccion ? this.toNumber(l.costo_produccion) : undefined,
      }));
    } catch (error) {
      console.error('Error al obtener lotes:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Obtener valor del inventario
   */
  async getValorInventario(): Promise<ValorInventario> {
    try {
      const response = await api.get<{ success: boolean; data: ValorInventario }>(`${this.basePath}/valor`);
      return response.data.data;
    } catch (error) {
      console.error('Error al obtener valor del inventario:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Parsear movimiento
   */
  private parseMovimiento(movimiento: any): Movimiento {
    return {
      ...movimiento,
      cantidad: this.toNumber(movimiento.cantidad),
      stock_anterior: this.toNumber(movimiento.stock_anterior),
      stock_nuevo: this.toNumber(movimiento.stock_nuevo),
    };
  }

  /**
   * Convertir a número
   */
  private toNumber(value: any): number {
    if (typeof value === 'string') {
      return parseFloat(value);
    }
    return value || 0;
  }

  /**
   * Manejo de errores
   */
  private handleError(error: any): Error {
    if (error.response) {
      const message = error.response.data?.error || 
                     error.response.data?.message || 
                     'Error en el servidor';
      return new Error(message);
    } else if (error.request) {
      return new Error('No se pudo conectar con el servidor. Verifique su conexión.');
    } else {
      return error instanceof Error ? error : new Error('Error desconocido');
    }
  }
}

export const inventarioService = new InventarioService();
