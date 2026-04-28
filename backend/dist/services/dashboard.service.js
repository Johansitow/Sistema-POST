"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardService = void 0;
const client_1 = require("@prisma/client");
const database_1 = __importDefault(require("../config/database"));
const orden_repository_1 = require("../repositories/orden.repository");
const producto_repository_1 = require("../repositories/producto.repository");
/**
 * Busca el id del estado 'ENTREGADA' en BD.
 * Se usa para filtrar solo órdenes completadas en ventas y top productos.
 * Retorna 0 si no existe el estado (evita crash, simplemente no habrá resultados).
 */
const getEstadoFinalId = async () => {
    const estado = await database_1.default.estadoOrden.findFirst({
        where: { codigo: 'ENTREGADA' },
    });
    return estado?.id ?? 0;
};
exports.dashboardService = {
    /**
     * getStats — estadísticas generales para las tarjetas del dashboard
     *
     * Todas las queries corren en paralelo con Promise.all para minimizar
     * el tiempo de respuesta total (no dependen entre sí excepto idEstado).
     */
    async getStats() {
        // Rango de hoy: desde 00:00:00 hasta 00:00:00 del día siguiente
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);
        // Necesitamos el id del estado final para filtrar órdenes completadas
        const idEstado = await getEstadoFinalId();
        const [total, // total de productos en BD
        ordenesHoy, // cantidad de órdenes creadas hoy
        activos, // productos con estado activo
        ventasHoy, // suma de ventas de órdenes entregadas hoy
        ventasSemana, // ventas agrupadas por día últimos 7 días
        todosActivos, // lista completa de productos activos (para calcular stock bajo)
        ] = await Promise.all([
            producto_repository_1.productoRepository.count(),
            orden_repository_1.ordenRepository.countHoy(hoy, manana),
            producto_repository_1.productoRepository.countByEstado(client_1.EstadoGeneral.activo),
            orden_repository_1.ordenRepository.aggregateVentasHoy(idEstado, hoy, manana),
            orden_repository_1.ordenRepository.groupByFechaSemana(idEstado, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // hace 7 días
            ),
            producto_repository_1.productoRepository.findActivos(),
        ]);
        // Calcular stock bajo en memoria — más eficiente que una query extra
        // Stock bajo = stock_actual <= stock_minimo (incluye agotados)
        const stockBajo = todosActivos
            .filter(p => Number(p.stock_actual) <= Number(p.stock_minimo))
            .slice(0, 10); // máx 10 para no sobrecargar el dashboard
        // Top 5 productos más vendidos — requiere dos queries:
        // 1. Agregar por id_producto para obtener cantidades
        // 2. Buscar nombres de los productos resultantes
        const top = await orden_repository_1.ordenRepository.topProductos(idEstado, 5);
        const ids = top.map(p => p.id_producto);
        const prods = await database_1.default.producto.findMany({ where: { id: { in: ids } } });
        const topProductos = top.map(item => ({
            producto_id: item.id_producto,
            nombre: prods.find(p => p.id === item.id_producto)?.nombre,
            cantidad_vendida: Number(item._sum.cantidad ?? 0),
            total_vendido: Number(item._sum.subtotal ?? 0),
        }));
        return {
            // 'productos' en lugar de 'totalProductos' — coincide con DashboardStats del frontend
            productos: total,
            ordenesHoy,
            productosActivos: activos,
            alertas: stockBajo.length,
            ventasHoy: Number(ventasHoy._sum.total ?? 0),
            stockBajo,
            ventasSemana: ventasSemana.map(v => ({
                fecha: v.fecha_apertura,
                total: Number(v._sum.total ?? 0),
            })),
            topProductos,
        };
    },
    /**
     * getResumenVentas — ventas agrupadas por fecha y tipo de orden
     * Usado para gráficas de tendencia en la página de reportes.
     * 'dias' controla el rango hacia atrás desde hoy (default 30).
     */
    async getResumenVentas(dias = 30) {
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - dias);
        const idEstado = await getEstadoFinalId();
        const ventas = await orden_repository_1.ordenRepository.groupByFecha({
            id_estado: idEstado,
            fecha_apertura: { gte: fechaInicio },
        });
        return ventas.map(v => ({
            fecha: v.fecha_apertura,
            tipo_orden: v.tipo_orden,
            total: Number(v._sum.total ?? 0),
            cantidad_ordenes: v._count,
        }));
    },
    /**
     * getAlertasInventario — productos con stock crítico
     *
     * Separa en dos categorías:
     * - stockBajo:    stock > 0 pero <= stock_minimo (alerta amarilla)
     * - stockAgotado: stock = 0 (alerta roja)
     *
     * totalAlertas es la suma de ambos para mostrar el badge de notificaciones.
     */
    async getAlertasInventario() {
        const productos = await producto_repository_1.productoRepository.findActivos();
        const stockBajo = productos.filter(p => Number(p.stock_actual) > 0 && Number(p.stock_actual) <= Number(p.stock_minimo));
        const stockAgotado = productos.filter(p => Number(p.stock_actual) === 0);
        return {
            stockBajo,
            stockAgotado,
            totalAlertas: stockBajo.length + stockAgotado.length,
        };
    },
};
//# sourceMappingURL=dashboard.service.js.map