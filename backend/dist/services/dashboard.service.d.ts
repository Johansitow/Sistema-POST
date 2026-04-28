/**
 * DashboardService - Lógica de negocio para el dashboard
 *
 * Nomenclatura de campos en la respuesta:
 * - productos:        total de productos en BD (antes 'totalProductos' — renombrado para coincidir con frontend)
 * - ordenesHoy:       cantidad de órdenes creadas hoy
 * - productosActivos: productos con estado 'activo'
 * - alertas:          cantidad de productos con stock <= stock_minimo
 * - ventasHoy:        suma de totales de órdenes entregadas hoy
 * - stockBajo:        lista de productos con stock crítico (máx 10)
 * - ventasSemana:     ventas agrupadas por día de los últimos 7 días
 * - topProductos:     5 productos más vendidos (por cantidad)
 */
export declare const dashboardService: {
    /**
     * getStats — estadísticas generales para las tarjetas del dashboard
     *
     * Todas las queries corren en paralelo con Promise.all para minimizar
     * el tiempo de respuesta total (no dependen entre sí excepto idEstado).
     */
    getStats(): Promise<{
        productos: number;
        ordenesHoy: number;
        productosActivos: number;
        alertas: number;
        ventasHoy: number;
        stockBajo: any[];
        ventasSemana: {
            fecha: Date;
            total: number;
        }[];
        topProductos: {
            producto_id: number;
            nombre: string | undefined;
            cantidad_vendida: number;
            total_vendido: number;
        }[];
    }>;
    /**
     * getResumenVentas — ventas agrupadas por fecha y tipo de orden
     * Usado para gráficas de tendencia en la página de reportes.
     * 'dias' controla el rango hacia atrás desde hoy (default 30).
     */
    getResumenVentas(dias?: number): Promise<{
        fecha: Date;
        tipo_orden: import(".prisma/client").$Enums.TipoOrden;
        total: number;
        cantidad_ordenes: number;
    }[]>;
    /**
     * getAlertasInventario — productos con stock crítico
     *
     * Separa en dos categorías:
     * - stockBajo:    stock > 0 pero <= stock_minimo (alerta amarilla)
     * - stockAgotado: stock = 0 (alerta roja)
     *
     * totalAlertas es la suma de ambos para mostrar el badge de notificaciones.
     */
    getAlertasInventario(): Promise<{
        stockBajo: any[];
        stockAgotado: any[];
        totalAlertas: number;
    }>;
};
//# sourceMappingURL=dashboard.service.d.ts.map