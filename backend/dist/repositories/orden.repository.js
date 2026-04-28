"use strict";
/**
 * OrdenRepository - Solo queries Prisma para órdenes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordenRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const pagination_1 = require("../lib/pagination");
const includeBasico = {
    estado: true,
    usuario: { select: { id: true, nombre_completo: true, email: true } },
    detalles: { include: { producto: true } },
};
const includeCompleto = {
    ...includeBasico,
    pagos: { include: { metodo_pago: true } },
};
exports.ordenRepository = {
    findAll: (pagination, filters) => {
        const where = {};
        if (filters.tipo_orden)
            where.tipo_orden = filters.tipo_orden;
        if (filters.id_estado)
            where.id_estado = filters.id_estado;
        if (filters.fecha_desde || filters.fecha_hasta) {
            where.fecha_apertura = {};
            if (filters.fecha_desde)
                where.fecha_apertura.gte = filters.fecha_desde;
            if (filters.fecha_hasta)
                where.fecha_apertura.lte = filters.fecha_hasta;
        }
        return Promise.all([
            database_1.default.orden.findMany({
                where,
                include: includeBasico,
                orderBy: { fecha_apertura: 'desc' },
                skip: (0, pagination_1.getSkip)(pagination),
                take: pagination.limit,
            }),
            database_1.default.orden.count({ where }),
        ]);
    },
    findById: (id) => database_1.default.orden.findUnique({ where: { id }, include: includeCompleto }),
    findUltima: () => database_1.default.orden.findFirst({ orderBy: { numero_orden: 'desc' } }),
    create: (data) => database_1.default.orden.create({ data, include: includeBasico }),
    update: (id, data) => database_1.default.orden.update({ where: { id }, data, include: includeBasico }),
    updateEstado: (id, id_estado) => database_1.default.orden.update({ where: { id }, data: { id_estado }, include: includeBasico }),
    updateTotales: (id, data) => database_1.default.orden.update({ where: { id }, data }),
    delete: (id) => database_1.default.orden.delete({ where: { id } }),
    // Detalles
    findDetalleById: (id) => database_1.default.ordenDetalle.findUnique({ where: { id }, include: { producto: true } }),
    findDetallesByOrden: (id_orden) => database_1.default.ordenDetalle.findMany({ where: { id_orden } }),
    createDetalle: (data) => database_1.default.ordenDetalle.create({ data, include: { producto: true } }),
    updateDetalle: (id, data) => database_1.default.ordenDetalle.update({ where: { id }, data, include: { producto: true } }),
    deleteDetalle: (id) => database_1.default.ordenDetalle.delete({ where: { id } }),
    deleteDetallesByOrden: (id_orden) => database_1.default.ordenDetalle.deleteMany({ where: { id_orden } }),
    // Estadísticas
    count: (where) => database_1.default.orden.count({ where }),
    aggregate: (where) => database_1.default.orden.aggregate({
        where,
        _sum: { total: true },
        _avg: { total: true },
    }),
    groupByEstado: (where) => database_1.default.orden.groupBy({ by: ['id_estado'], where, _count: true }),
    groupByTipo: (where) => database_1.default.orden.groupBy({ by: ['tipo_orden'], where, _count: true }),
    groupByFecha: (where) => database_1.default.orden.groupBy({
        by: ['fecha_apertura', 'tipo_orden'],
        where,
        _sum: { total: true },
        _count: true,
        orderBy: { fecha_apertura: 'asc' },
    }),
    // Dashboard
    countHoy: (gte, lt) => database_1.default.orden.count({ where: { fecha_apertura: { gte, lt } } }),
    aggregateVentasHoy: (id_estado, gte, lt) => database_1.default.orden.aggregate({
        where: { id_estado, fecha_apertura: { gte, lt } },
        _sum: { total: true },
    }),
    groupByFechaSemana: (id_estado, gte) => database_1.default.orden.groupBy({
        by: ['fecha_apertura'],
        where: { id_estado, fecha_apertura: { gte } },
        _sum: { total: true },
        orderBy: { fecha_apertura: 'asc' },
    }),
    topProductos: (id_estado, take) => database_1.default.ordenDetalle.groupBy({
        by: ['id_producto'],
        where: { orden: { id_estado } },
        _sum: { cantidad: true, subtotal: true },
        orderBy: { _sum: { cantidad: 'desc' } },
        take,
    }),
};
//# sourceMappingURL=orden.repository.js.map