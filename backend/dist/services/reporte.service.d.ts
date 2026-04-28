/**
 * ReporteService - Solo lógica de negocio para reportes
 */
import { TipoOrden } from '@prisma/client';
export declare const reporteService: {
    getVentas(params: {
        fecha_desde?: Date;
        fecha_hasta?: Date;
        tipo_orden?: TipoOrden;
        agrupar_por?: string;
    }): Promise<{
        periodo: {
            desde: Date | undefined;
            hasta: Date | undefined;
        };
        totales: {
            total_ordenes: number;
            total_ventas: number;
            total_subtotal: number;
            total_impuestos: number;
            ticket_promedio: number;
        };
        ventas: any[];
    }>;
    getProductosMasVendidos(params: {
        fecha_desde?: Date;
        fecha_hasta?: Date;
        limit?: number;
    }): Promise<any[]>;
    getVentasPorCategoria(params: {
        fecha_desde?: Date;
        fecha_hasta?: Date;
    }): Promise<{
        categoria: any;
        cantidad_vendida: any;
        total_vendido: any;
        numero_productos: any;
    }[]>;
    getMetodosPago(params: {
        fecha_desde?: Date;
        fecha_hasta?: Date;
    }): Promise<any[]>;
    getVentasPorHora(params: {
        fecha_desde?: Date;
        fecha_hasta?: Date;
    }): Promise<any[]>;
    getReporteCompleto(params: {
        fecha_desde?: Date;
        fecha_hasta?: Date;
    }): Promise<{
        periodo: {
            desde: Date | undefined;
            hasta: Date | undefined;
        };
        productosMasVendidos: any[];
        ventasPorCategoria: {
            categoria: any;
            cantidad_vendida: any;
            total_vendido: any;
            numero_productos: any;
        }[];
        metodosPago: any[];
        ventasPorHora: any[];
    }>;
};
//# sourceMappingURL=reporte.service.d.ts.map