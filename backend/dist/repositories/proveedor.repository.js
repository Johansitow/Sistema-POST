"use strict";
/**
 * ProveedorRepository - Solo queries Prisma para proveedores
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.proveedorRepository = void 0;
const client_1 = require("@prisma/client");
const database_1 = __importDefault(require("../config/database"));
const pagination_1 = require("../lib/pagination");
exports.proveedorRepository = {
    findAll: (pagination, filters) => {
        const where = {};
        if (filters.estado)
            where.estado = filters.estado;
        if (filters.search) {
            where.OR = [
                { razon_social: { contains: filters.search, mode: 'insensitive' } },
                { nit: { contains: filters.search, mode: 'insensitive' } },
                { contacto_nombre: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
        return Promise.all([
            database_1.default.proveedor.findMany({
                where,
                include: { _count: { select: { productos: true } } },
                orderBy: { razon_social: 'asc' },
                skip: (0, pagination_1.getSkip)(pagination),
                take: pagination.limit,
            }),
            database_1.default.proveedor.count({ where }),
        ]);
    },
    findById: (id) => database_1.default.proveedor.findUnique({
        where: { id },
        include: {
            productos: {
                include: { producto: { include: { categoria: true } } },
                where: { estado: client_1.EstadoGeneral.activo },
            },
        },
    }),
    findByNit: (nit, excludeId) => database_1.default.proveedor.findFirst({
        where: {
            nit,
            ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
    }),
    create: (data) => database_1.default.proveedor.create({ data }),
    update: (id, data) => database_1.default.proveedor.update({ where: { id }, data }),
    // ─── ProveedorProducto ───────────────────────────────────────────────────────
    findProductosByProveedor: (id_proveedor) => database_1.default.proveedorProducto.findMany({
        where: { id_proveedor, estado: client_1.EstadoGeneral.activo },
        include: { producto: { include: { categoria: true } } },
        orderBy: { producto: { nombre: 'asc' } },
    }),
    findProveedoresByProducto: (id_producto) => database_1.default.proveedorProducto.findMany({
        where: { id_producto, estado: client_1.EstadoGeneral.activo },
        include: { proveedor: true },
        orderBy: { es_proveedor_preferido: 'desc' },
    }),
    findRelacion: (id_proveedor, id_producto) => database_1.default.proveedorProducto.findUnique({
        where: { id_proveedor_id_producto: { id_proveedor, id_producto } },
    }),
    createRelacion: (data) => database_1.default.proveedorProducto.create({ data, include: { producto: true, proveedor: true } }),
    updateRelacion: (id_proveedor, id_producto, data) => database_1.default.proveedorProducto.update({
        where: { id_proveedor_id_producto: { id_proveedor, id_producto } },
        data,
        include: { producto: true, proveedor: true },
    }),
};
//# sourceMappingURL=proveedor.repository.js.map