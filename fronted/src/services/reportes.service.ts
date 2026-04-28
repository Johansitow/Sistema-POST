/**
 * Reportes Service - NUEVO
 * Compatible con backend Cocina Oculta (versión final)
 */

import api from './api';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ReporteVentasParams {
  fecha_desde?: string;
  fecha_hasta?: string;
  tipo_orden?: 'local' | 'domicilio';
  agrupar_por?: 'hora' | 'dia' | 'mes';
}

export interface TotalesVentas {
  total_ordenes: number;
  total_ventas: number;
  total_subtotal: number;
  total_impuestos: number;
  ticket_promedio: number;
}

export interface VentaAgrupada {
  periodo: string;
  ordenes: number;
  total: number;
  subtotal: number;
  impuestos: number;
}

export interface ReporteVentas {
  periodo: {
    desde?: string;
    hasta?: string;
  };
  totales: TotalesVentas;
  ventas: VentaAgrupada[];
}

export interface ProductoMasVendido {
  producto_id: number;
  nombre: string;
  sku: string;
  categoria?: string;
  cantidad_vendida: number;
  total_vendido: number;
  numero_ordenes: number;
}

export interface VentaPorCategoria {
  categoria: string;
  cantidad_vendida: number;
  total_vendido: number;
  numero_productos: number;
}

export interface MetodoPagoResumen {
  metodo: string;
  transacciones: number;
  total: number;
}

export interface VentaPorHora {
  hora: string;
  ordenes: number;
  total: number;
}

export interface ReporteCompleto {
  periodo: {
    desde?: string;
    hasta?: string;
  };
  productosMasVendidos: ProductoMasVendido[];
  ventasPorCategoria: VentaPorCategoria[];
  metodosPago: MetodoPagoResumen[];
  ventasPorHora: VentaPorHora[];
}

// ============================================================================
// SERVICIO
// ============================================================================

class ReportesService {
  private readonly basePath = '/reportes';

  /**
   * Obtener reporte de ventas
   */
  async getVentas(params: ReporteVentasParams = {}): Promise<ReporteVentas> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.fecha_desde) queryParams.append('fecha_desde', params.fecha_desde);
      if (params.fecha_hasta) queryParams.append('fecha_hasta', params.fecha_hasta);
      if (params.tipo_orden) queryParams.append('tipo_orden', params.tipo_orden);
      if (params.agrupar_por) queryParams.append('agrupar_por', params.agrupar_por);

      const queryString = queryParams.toString();
      const url = queryString ? `${this.basePath}/ventas?${queryString}` : `${this.basePath}/ventas`;

      const response = await api.get<ReporteVentas>(url);
      
      return {
        ...response.data,
        totales: {
          ...response.data.totales,
          total_ventas: this.toNumber(response.data.totales.total_ventas),
          total_subtotal: this.toNumber(response.data.totales.total_subtotal),
          total_impuestos: this.toNumber(response.data.totales.total_impuestos),
          ticket_promedio: this.toNumber(response.data.totales.ticket_promedio),
        },
        ventas: response.data.ventas.map(v => ({
          ...v,
          total: this.toNumber(v.total),
          subtotal: this.toNumber(v.subtotal),
          impuestos: this.toNumber(v.impuestos),
        })),
      };
    } catch (error) {
      console.error('Error al obtener reporte de ventas:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Obtener productos más vendidos
   */
  async getProductosMasVendidos(params: { fecha_desde?: string; fecha_hasta?: string; limit?: number } = {}): Promise<ProductoMasVendido[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.fecha_desde) queryParams.append('fecha_desde', params.fecha_desde);
      if (params.fecha_hasta) queryParams.append('fecha_hasta', params.fecha_hasta);
      if (params.limit) queryParams.append('limit', params.limit.toString());

      const queryString = queryParams.toString();
      const url = queryString ? `${this.basePath}/productos?${queryString}` : `${this.basePath}/productos`;

      const response = await api.get<ProductoMasVendido[]>(url);
      
      return response.data.map(p => ({
        ...p,
        cantidad_vendida: this.toNumber(p.cantidad_vendida),
        total_vendido: this.toNumber(p.total_vendido),
      }));
    } catch (error) {
      console.error('Error al obtener productos más vendidos:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Obtener ventas por categoría
   */
  async getVentasPorCategoria(params: { fecha_desde?: string; fecha_hasta?: string } = {}): Promise<VentaPorCategoria[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.fecha_desde) queryParams.append('fecha_desde', params.fecha_desde);
      if (params.fecha_hasta) queryParams.append('fecha_hasta', params.fecha_hasta);

      const queryString = queryParams.toString();
      const url = queryString ? `${this.basePath}/categorias?${queryString}` : `${this.basePath}/categorias`;

      const response = await api.get<VentaPorCategoria[]>(url);
      
      return response.data.map(c => ({
        ...c,
        cantidad_vendida: this.toNumber(c.cantidad_vendida),
        total_vendido: this.toNumber(c.total_vendido),
      }));
    } catch (error) {
      console.error('Error al obtener ventas por categoría:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Obtener resumen de métodos de pago
   */
  async getMetodosPago(params: { fecha_desde?: string; fecha_hasta?: string } = {}): Promise<MetodoPagoResumen[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.fecha_desde) queryParams.append('fecha_desde', params.fecha_desde);
      if (params.fecha_hasta) queryParams.append('fecha_hasta', params.fecha_hasta);

      const queryString = queryParams.toString();
      const url = queryString ? `${this.basePath}/metodos-pago?${queryString}` : `${this.basePath}/metodos-pago`;

      const response = await api.get<MetodoPagoResumen[]>(url);
      
      return response.data.map(m => ({
        ...m,
        total: this.toNumber(m.total),
      }));
    } catch (error) {
      console.error('Error al obtener métodos de pago:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Obtener ventas por hora
   */
  async getVentasPorHora(params: { fecha_desde?: string; fecha_hasta?: string } = {}): Promise<VentaPorHora[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.fecha_desde) queryParams.append('fecha_desde', params.fecha_desde);
      if (params.fecha_hasta) queryParams.append('fecha_hasta', params.fecha_hasta);

      const queryString = queryParams.toString();
      const url = queryString ? `${this.basePath}/horas?${queryString}` : `${this.basePath}/horas`;

      const response = await api.get<VentaPorHora[]>(url);
      
      return response.data.map(v => ({
        ...v,
        total: this.toNumber(v.total),
      }));
    } catch (error) {
      console.error('Error al obtener ventas por hora:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Obtener reporte completo
   */
  async getReporteCompleto(params: { fecha_desde?: string; fecha_hasta?: string } = {}): Promise<ReporteCompleto> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.fecha_desde) queryParams.append('fecha_desde', params.fecha_desde);
      if (params.fecha_hasta) queryParams.append('fecha_hasta', params.fecha_hasta);

      const queryString = queryParams.toString();
      const url = queryString ? `${this.basePath}/completo?${queryString}` : `${this.basePath}/completo`;

      const response = await api.get<ReporteCompleto>(url);
      
      return {
        ...response.data,
        productosMasVendidos: response.data.productosMasVendidos.map(p => ({
          ...p,
          cantidad_vendida: this.toNumber(p.cantidad_vendida),
          total_vendido: this.toNumber(p.total_vendido),
        })),
        ventasPorCategoria: response.data.ventasPorCategoria.map(c => ({
          ...c,
          cantidad_vendida: this.toNumber(c.cantidad_vendida),
          total_vendido: this.toNumber(c.total_vendido),
        })),
        metodosPago: response.data.metodosPago.map(m => ({
          ...m,
          total: this.toNumber(m.total),
        })),
        ventasPorHora: response.data.ventasPorHora.map(v => ({
          ...v,
          total: this.toNumber(v.total),
        })),
      };
    } catch (error) {
      console.error('Error al obtener reporte completo:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Valor económico de merma
   */
  async getValorMerma(params: { fecha_desde?: string; fecha_hasta?: string } = {}): Promise<any[]> {
    try {
      const res = await api.get(`${this.basePath}/merma/valor`, { params });
      return (res.data.data ?? res.data ?? []).map((item: any) => ({
        ...item,
        merma_cantidad:       this.toNumber(item.merma_cantidad),
        costo_produccion:     this.toNumber(item.costo_produccion),
        valor_merma_estimado: this.toNumber(item.valor_merma_estimado),
      }));
    } catch (error) {
      console.error('Error al obtener valor de merma:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Tendencias de consumo de ingredientes
   */
  async getTendenciasConsumo(): Promise<any[]> {
    try {
      const res = await api.get(`${this.basePath}/tendencias/consumo`);
      return res.data.data ?? res.data ?? [];
    } catch (error) {
      console.error('Error al obtener tendencias de consumo:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Top clientes por ingresos
   */
  async getTopClientes(limit = 20): Promise<any[]> {
    try {
      const res = await api.get(`${this.basePath}/clientes/top`, { params: { limit } });
      return (res.data.data ?? res.data ?? []).map((c: any) => ({
        ...c,
        total_gastado:  this.toNumber(c.total_gastado),
        ticket_promedio: this.toNumber(c.ticket_promedio),
      }));
    } catch (error) {
      console.error('Error al obtener top clientes:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Lotes próximos a vencer con valor en riesgo
   */
  async getLotesPorVencer(dias = 30): Promise<any[]> {
    try {
      const res = await api.get(`${this.basePath}/lotes/por-vencer`, { params: { dias } });
      return (res.data.data ?? res.data ?? []).map((l: any) => ({
        ...l,
        cantidad_disponible: this.toNumber(l.cantidad_disponible),
        valor_en_riesgo:     this.toNumber(l.valor_en_riesgo),
        dias_restantes:      Number(l.dias_restantes),
      }));
    } catch (error) {
      console.error('Error al obtener lotes por vencer:', error);
      throw this.handleError(error);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Consolidados por grupo — /reportes/consolidado/:id_grupo/*
  // ──────────────────────────────────────────────────────────────────────────

  /** Reporte completo del grupo: ventas + top productos + pagos + top clientes */
  async getConsolidado(idGrupo: number, params: { fecha_desde?: string; fecha_hasta?: string } = {}): Promise<any> {
    const res = await api.get(`${this.basePath}/consolidado/${idGrupo}`, { params });
    return res.data.data ?? res.data;
  }

  /** Ventas desglosadas por restaurante del grupo */
  async getVentasConsolidado(idGrupo: number, params: { fecha_desde?: string; fecha_hasta?: string; agrupar_por?: string } = {}): Promise<any> {
    const res = await api.get(`${this.basePath}/consolidado/${idGrupo}/ventas`, { params });
    return res.data.data ?? res.data;
  }

  /** Top productos del grupo */
  async getProductosConsolidado(idGrupo: number, params: { fecha_desde?: string; fecha_hasta?: string; limit?: number } = {}): Promise<any[]> {
    const res = await api.get(`${this.basePath}/consolidado/${idGrupo}/productos`, { params });
    return res.data.data ?? res.data ?? [];
  }

  /** Métodos de pago consolidados del grupo */
  async getPagosConsolidado(idGrupo: number, params: { fecha_desde?: string; fecha_hasta?: string } = {}): Promise<any[]> {
    const res = await api.get(`${this.basePath}/consolidado/${idGrupo}/pagos`, { params });
    return res.data.data ?? res.data ?? [];
  }

  /** Top clientes por gasto total en el grupo */
  async getClientesConsolidado(idGrupo: number, limit = 10): Promise<any[]> {
    const res = await api.get(`${this.basePath}/consolidado/${idGrupo}/clientes`, { params: { limit } });
    return (res.data.data ?? res.data ?? []).map((c: any) => ({
      ...c,
      total_gastado:   this.toNumber(c.total_gastado),
      ticket_promedio: this.toNumber(c.ticket_promedio),
    }));
  }

  /**
   * Super-consolidado — solo super admin.
   * Agrega TODOS los grupos del sistema en un único reporte.
   */
  async getSuperConsolidado(params: { fecha_desde?: string; fecha_hasta?: string } = {}): Promise<any> {
    const res = await api.get(`${this.basePath}/super-consolidado`, { params });
    return res.data.data ?? res.data;
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

export const reportesService = new ReportesService();
