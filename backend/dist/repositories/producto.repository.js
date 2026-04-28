"use strict";
/**
 * ProductoRepository - Solo queries Prisma para productos
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productoRepository = void 0;
const client_1 = require("@prisma/client");
const database_1 = __importDefault(require("../config/database"));
const pagination_1 = require("../lib/pagination");
const includeDefault = { categoria: true };
const includeDetalle = {
    categoria: true,
    movimientos: { orderBy: { fecha_movimiento: 'desc' }, take: 10 },
};
exports.productoRepository = {
    findAll: (pagination, filters) => {
        const where = {};
        if (filters.search) {
            where.OR = [
                { nombre: { contains: filters.search, mode: 'insensitive' } },
                { sku: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
        if (filters.id_categoria)
            where.id_categoria = filters.id_categoria;
        if (filters.estado)
            where.estado = filters.estado;
        return Promise.all([
            database_1.default.producto.findMany({
                where,
                include: includeDefault,
                orderBy: { nombre: 'asc' },
                skip: (0, pagination_1.getSkip)(pagination),
                take: pagination.limit,
            }),
            database_1.default.producto.count({ where }),
        ]);
    },
    findById: (id) => database_1.default.producto.findUnique({ where: { id }, include: includeDetalle }),
    findBySKU: (sku) => database_1.default.producto.findUnique({ where: { sku }, include: includeDefault }),
    findActivos: () => database_1.default.producto.findMany({
        where: { estado: client_1.EstadoGeneral.activo },
        select: {
            id: true, nombre: true, sku: true,
            stock_actual: true, stock_minimo: true, precio_unitario: true,
            categoria: { select: { nombre: true } },
        },
        orderBy: { stock_actual: 'asc' },
    }),
    create: (data) => database_1.default.producto.create({ data, include: includeDefault }),
    update: (id, data) => database_1.default.producto.update({ where: { id }, data, include: includeDefault }),
    updateStock: (id, stock_actual) => database_1.default.producto.update({ where: { id }, data: { stock_actual } }),
    softDelete: (id) => database_1.default.producto.update({
        where: { id },
        data: { estado: client_1.EstadoGeneral.eliminado },
    }),
    count: () => database_1.default.producto.count(),
    countByEstado: (estado) => database_1.default.producto.count({ where: { estado } }),
};
//# sourceMappingURL=producto.repository.js.map