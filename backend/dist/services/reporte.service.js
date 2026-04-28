"use strict";
/**
 * ReporteService - Solo lógica de negocio para reportes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reporteService = void 0;
const database_1 = __importDefault(require("../config/database"));
const getEstadoFinalId = async () => {
    const estado = await database_1.default.estadoOrden.findFirst({ where: { codigo: 'ENTREGADA' } });
    return estado?.id ?? 0;
};
const buildFechaWhere = (desde, hasta) => {
    if (!desde && !hasta)
        return undefined;
    const w = {};
    if (desde)
        w.gte = desde;
    if (hasta)
        w.lte = hasta;
    return w;
};
exports.reporteService = {
    async getVentas(params) {
        const idEstado = await getEstadoFinalId();
        const where = { id_estado: idEstado };
        const fechaWhere = buildFechaWhere(params.fecha_desde, params.fecha_hasta);
        if (fechaWhere)
            where.fecha_apertura = fechaWhere;
        if (params.tipo_orden)
            where.tipo_orden = params.tipo_orden;
        const ordenes = await database_1.default.orden.findMany({
            where,
            include: { detalles: { include: { producto: { include: { categoria: true } } } } },
            orderBy: { fecha_apertura: 'asc' },
        });
        const agruparPor = params.agrupar_por ?? 'dia';
        const grupos = new Map();
        ordenes.forEach(o => {
            const f = new Date(o.fecha_apertura);
            let key;
            switch (agruparPor) {
                case 'hora':
                    key = `${f.toISOString().split('T')[0]} ${f.getHours()}:00`;
                    break;
                case 'mes':
                    key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
                    break;
                default: key = f.toISOString().split('T')[0];
            }
            if (!grupos.has(key))
                grupos.set(key, { periodo: key, ordenes: 0, total: 0, subtotal: 0, impuestos: 0 });
            const g = grupos.get(key);
            g.ordenes++;
            g.total += Number(o.total);
            g.subtotal += Number(o.subtotal);
            g.impuestos += Number(o.impuestos);
        });
        const totalVentas = ordenes.reduce((s, o) => s + Number(o.total), 0);
        return {
            periodo: { desde: params.fecha_desde, hasta: params.fecha_hasta },
            totales: {
                total_ordenes: ordenes.length,
                total_ventas: totalVentas,
                total_subtotal: ordenes.reduce((s, o) => s + Number(o.subtotal), 0),
                total_impuestos: ordenes.reduce((s, o) => s + Number(o.impuestos), 0),
                ticket_promedio: ordenes.length > 0 ? totalVentas / ordenes.length : 0,
            },
            ventas: Array.from(grupos.values()).sort((a, b) => a.periodo.localeCompare(b.periodo)),
        };
    },
    async getProductosMasVendidos(params) {
        const idEstado = await getEstadoFinalId();
        const where = { orden: { id_estado: idEstado } };
        const fechaWhere = buildFechaWhere(params.fecha_desde, params.fecha_hasta);
        if (fechaWhere)
            where.orden.fecha_apertura = fechaWhere;
        const items = await database_1.default.ordenDetalle.findMany({
            where, include: { producto: { include: { categoria: true } } },
        });
        const mapa = new Map();
        items.forEach(item => {
            const id = item.id_producto;
            if (!mapa.has(id))
                mapa.set(id, {
                    producto_id: id, nombre: item.producto.nombre, sku: item.producto.sku,
                    categoria: item.producto.categoria?.nombre,
                    cantidad_vendida: 0, total_vendido: 0, numero_ordenes: 0,
                });
            const d = mapa.get(id);
            d.cantidad_vendida += Number(item.cantidad);
            d.total_vendido += Number(item.subtotal);
            d.numero_ordenes++;
        });
        return Array.from(mapa.values())
            .sort((a, b) => b.cantidad_vendida - a.cantidad_vendida)
            .slice(0, params.limit ?? 20);
    },
    async getVentasPorCategoria(params) {
        const idEstado = await getEstadoFinalId();
        const where = { orden: { id_estado: idEstado } };
        const fechaWhere = buildFechaWhere(params.fecha_desde, params.fecha_hasta);
        if (fechaWhere)
            where.orden.fecha_apertura = fechaWhere;
        const items = await database_1.default.ordenDetalle.findMany({
            where, include: { producto: { include: { categoria: true } } },
        });
        const mapa = new Map();
        items.forEach(item => {
            const cat = item.producto.categoria?.nombre ?? 'Sin categoría';
            if (!mapa.has(cat))
                mapa.set(cat, { categoria: cat, cantidad_vendida: 0, total_vendido: 0, productos: new Set() });
            const d = mapa.get(cat);
            d.cantidad_vendida += Number(item.cantidad);
            d.total_vendido += Number(item.subtotal);
            d.productos.add(item.id_producto);
        });
        return Array.from(mapa.values())
            .map(c => ({ categoria: c.categoria, cantidad_vendida: c.cantidad_vendida, total_vendido: c.total_vendido, numero_productos: c.productos.size }))
            .sort((a, b) => b.total_vendido - a.total_vendido);
    },
    async getMetodosPago(params) {
        const idEstado = await getEstadoFinalId();
        const where = { orden: { id_estado: idEstado } };
        const fechaWhere = buildFechaWhere(params.fecha_desde, params.fecha_hasta);
        if (fechaWhere)
            where.orden.fecha_apertura = fechaWhere;
        const pagos = await database_1.default.pago.findMany({ where, include: { metodo_pago: true } });
        const mapa = new Map();
        pagos.forEach(p => {
            const m = p.metodo_pago.nombre;
            if (!mapa.has(m))
                mapa.set(m, { metodo: m, transacciones: 0, total: 0 });
            mapa.get(m).transacciones++;
            mapa.get(m).total += Number(p.monto);
        });
        return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
    },
    async getVentasPorHora(params) {
        const idEstado = await getEstadoFinalId();
        const where = { id_estado: idEstado };
        const fechaWhere = buildFechaWhere(params.fecha_desde, params.fecha_hasta);
        if (fechaWhere)
            where.fecha_apertura = fechaWhere;
        const ordenes = await database_1.default.orden.findMany({ where, select: { fecha_apertura: true, total: true } });
        const mapa = new Map();
        ordenes.forEach(o => {
            const hora = o.fecha_apertura.getHours();
            if (!mapa.has(hora))
                mapa.set(hora, { hora: `${hora}:00`, ordenes: 0, total: 0 });
            mapa.get(hora).ordenes++;
            mapa.get(hora).total += Number(o.total);
        });
        return Array.from(mapa.values()).sort((a, b) => parseInt(a.hora) - parseInt(b.hora));
    },
    async getReporteCompleto(params) {
        const [productosMasVendidos, ventasPorCategoria, metodosPago, ventasPorHora] = await Promise.all([
            exports.reporteService.getProductosMasVendidos({ ...params, limit: 10 }),
            exports.reporteService.getVentasPorCategoria(params),
            exports.reporteService.getMetodosPago(params),
            exports.reporteService.getVentasPorHora(params),
        ]);
        return {
            periodo: { desde: params.fecha_desde, hasta: params.fecha_hasta },
            productosMasVendidos, ventasPorCategoria, metodosPago, ventasPorHora,
        };
    },
};
//# sourceMappingURL=reporte.service.js.map