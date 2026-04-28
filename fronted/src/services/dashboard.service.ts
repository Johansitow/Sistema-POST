/**
 * DashboardService - Frontend
 *
 * Responsabilidades:
 * - Llamar a los endpoints del backend
 * - Normalizar tipos numéricos (Prisma Decimal llega como string en JSON)
 * - Propagar errores con mensajes legibles para el componente
 *
 * Normalización de Decimals:
 * Prisma serializa campos Decimal como strings en JSON.
 * toNumber() convierte cualquier string numérico a number para que
 * el frontend pueda operar con ellos sin sorpresas de tipo.
 */

import api from './api';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ProductoStockBajo {
  id:          number;
  sku:         string;
  nombre:      string;
  stock_actual: number;
  stock_minimo: number;
  categoria?: {
    id:     number;
    nombre: string;
  };
}

export interface VentaSemana {
  fecha: string;
  total: number;
}

export interface TopProducto {
  producto_id:      number;
  nombre?:          string;
  cantidad_vendida: number;
  total_vendido:    number;
}

/**
 * DashboardStats — estructura que devuelve GET /dashboard/stats
 * Debe coincidir exactamente con el return de dashboardService.getStats() del backend.
 */
export interface DashboardStats {
  productos:        number; // total de productos en BD
  ordenesHoy:       number; // órdenes creadas hoy
  alertas:          number; // productos con stock crítico
  ventasHoy:        number; // suma de ventas de hoy (COP)
  productosActivos: number; // productos con estado activo
  stockBajo:        ProductoStockBajo[];
  ventasSemana:     VentaSemana[];
  topProductos:     TopProducto[];
}

export interface ResumenVenta {
  fecha:            string;
  tipo_orden:       'local' | 'domicilio';
  total:            number;
  cantidad_ordenes: number;
}

export interface AlertaInventario {
  stockBajo:    ProductoStockBajo[];
  stockAgotado: ProductoStockBajo[];
  totalAlertas: number;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

class DashboardService {
  private readonly basePath = '/dashboard';

  /**
   * getStats — estadísticas generales para las tarjetas del dashboard
   *
   * Normaliza todos los campos numéricos porque Prisma Decimal
   * se serializa como string en JSON y rompería .toLocaleString()
   * y operaciones aritméticas en el componente.
   */
  async getStats(restauranteId?: number): Promise<DashboardStats> {
    try {
      const params = restauranteId ? `?id_restaurante=${restauranteId}` : '';
      const response = await api.get<{ success: boolean; data: DashboardStats }>(`${this.basePath}/stats${params}`);
      const data = response.data.data;

      return {
        // Campos numéricos simples — normalizados por si vienen como string
        productos:        this.toNumber(data.productos),
        ordenesHoy:       this.toNumber(data.ordenesHoy),
        alertas:          this.toNumber(data.alertas),
        ventasHoy:        this.toNumber(data.ventasHoy),
        productosActivos: this.toNumber(data.productosActivos),

        // Arrays — normalizar campos numéricos internos
        stockBajo: (data.stockBajo ?? []).map(p => ({
          ...p,
          stock_actual: this.toNumber(p.stock_actual),
          stock_minimo: this.toNumber(p.stock_minimo),
        })),

        ventasSemana: (data.ventasSemana ?? []).map(v => ({
          ...v,
          total: this.toNumber(v.total),
        })),

        topProductos: (data.topProductos ?? []).map(p => ({
          ...p,
          cantidad_vendida: this.toNumber(p.cantidad_vendida),
          total_vendido:    this.toNumber(p.total_vendido),
        })),
      };
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      throw this.handleError(error);
    }
  }

  /**
   * getResumenVentas — ventas por período para gráficas de reportes
   * 'dias' define cuántos días hacia atrás consultar (default 30)
   */
  async getResumenVentas(dias = 30, restauranteId?: number): Promise<ResumenVenta[]> {
    try {
      const params = restauranteId ? `&id_restaurante=${restauranteId}` : '';
      const response = await api.get<{ success: boolean; data: ResumenVenta[] }>(
        `${this.basePath}/ventas?dias=${dias}${params}`
      );
      return response.data.data.map(v => ({
        ...v,
        total: this.toNumber(v.total),
      }));
    } catch (error) {
      console.error('Error al obtener resumen de ventas:', error);
      throw this.handleError(error);
    }
  }

  /**
   * getAlertas — productos con stock bajo o agotado
   * Separados en dos categorías para mostrar distintos niveles de urgencia
   */
  async getAlertas(): Promise<AlertaInventario> {
    try {
      const response = await api.get<{ success: boolean; data: AlertaInventario }>(`${this.basePath}/alertas`);
      const data = response.data.data;

      return {
        totalAlertas: this.toNumber(data.totalAlertas),
        stockBajo: (data.stockBajo ?? []).map(p => ({
          ...p,
          stock_actual: this.toNumber(p.stock_actual),
          stock_minimo: this.toNumber(p.stock_minimo),
        })),
        stockAgotado: (data.stockAgotado ?? []).map(p => ({
          ...p,
          stock_actual: this.toNumber(p.stock_actual),
          stock_minimo: this.toNumber(p.stock_minimo),
        })),
      };
    } catch (error) {
      console.error('Error al obtener alertas:', error);
      throw this.handleError(error);
    }
  }

  /**
   * toNumber — normaliza cualquier valor a number
   *
   * Necesario porque Prisma serializa Decimal como string en JSON.
   * Retorna 0 si el valor es null, undefined o NaN para evitar
   * que .toLocaleString() explote en el componente.
   */
  private toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    const n = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(n) ? 0 : n;
  }

  /**
   * handleError — convierte errores de axios en Error legibles
   * para que el componente pueda mostrar mensajes útiles al usuario
   */
  private handleError(error: any): Error {
    if (error.response) {
      const message = error.response.data?.error ||
                      error.response.data?.message ||
                      'Error en el servidor';
      return new Error(message);
    } else if (error.request) {
      return new Error('No se pudo conectar con el servidor. Verifique su conexión.');
    }
    return error instanceof Error ? error : new Error('Error desconocido');
  }
}

export const dashboardService = new DashboardService();