"use strict";
/**
 * MovimientoRepository - Solo queries Prisma para movimientos de inventario
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.movimientoRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const pagination_1 = require("../lib/pagination");
exports.movimientoRepository = {
    findAll: (pagination, filters) => {
        const where = {};
        if (filters.id_producto)
            where.id_producto = filters.id_producto;
        if (filters.tipo)
            where.tipo_movimiento = filters.tipo;
        if (filters.fecha_desde || filters.fecha_hasta) {
            where.fecha_movimiento = {};
            if (filters.fecha_desde)
                where.fecha_movimiento.gte = filters.fecha_desde;
            if (filters.fecha_hasta)
                where.fecha_movimiento.lte = filters.fecha_hasta;
        }
        return Promise.all([
            database_1.default.movimiento.findMany({
                where,
                include: { producto: { include: { categoria: true } } },
                orderBy: { fecha_movimiento: 'desc' },
                skip: (0, pagination_1.getSkip)(pagination),
                take: pagination.limit,
            }),
            database_1.default.movimiento.count({ where }),
        ]);
    },
    create: (data) => database_1.default.movimiento.create({ data, include: { producto: true } }),
    groupByTipo: (gte) => database_1.default.movimiento.groupBy({
        by: ['tipo_movimiento'],
        where: { fecha_movimiento: { gte } },
        _count: true,
        _sum: { cantidad: true },
    }),
    count: (gte) => database_1.default.movimiento.count({ where: { fecha_movimiento: { gte } } }),
    findDistinctProductos: (gte) => database_1.default.movimiento.findMany({
        where: { fecha_movimiento: { gte } },
        distinct: ['id_producto'],
        select: { id_producto: true },
    }),
};
//# sourceMappingURL=movimiento.repository.js.map