"use strict";
/**
 * FacturaRepository - Solo queries Prisma para facturas
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.facturaRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const pagination_1 = require("../lib/pagination");
exports.facturaRepository = {
    findAll: (pagination, filters) => {
        const where = {};
        if (filters.estado_factura)
            where.estado_factura = filters.estado_factura;
        if (filters.fecha_desde || filters.fecha_hasta) {
            where.fecha_emision = {};
            if (filters.fecha_desde)
                where.fecha_emision.gte = filters.fecha_desde;
            if (filters.fecha_hasta)
                where.fecha_emision.lte = filters.fecha_hasta;
        }
        return Promise.all([
            database_1.default.factura.findMany({
                where,
                include: {
                    orden: {
                        include: {
                            estado: true,
                            usuario: { select: { id: true, nombre_completo: true } },
                            pagos: { include: { metodo_pago: true } },
                        },
                    },
                },
                orderBy: { fecha_emision: 'desc' },
                skip: (0, pagination_1.getSkip)(pagination),
                take: pagination.limit,
            }),
            database_1.default.factura.count({ where }),
        ]);
    },
    findById: (id) => database_1.default.factura.findUnique({
        where: { id },
        include: {
            orden: {
                include: {
                    estado: true,
                    usuario: { select: { id: true, nombre_completo: true } },
                    detalles: { include: { producto: true } },
                    pagos: { include: { metodo_pago: true } },
                },
            },
        },
    }),
    findByOrden: (id_orden) => database_1.default.factura.findUnique({
        where: { id_orden },
        include: {
            orden: {
                include: {
                    detalles: { include: { producto: true } },
                    pagos: { include: { metodo_pago: true } },
                },
            },
        },
    }),
    /**
     * findUltima — busca la última factura para generar el número secuencial
     */
    findUltima: () => database_1.default.factura.findFirst({ orderBy: { numero_factura: 'desc' } }),
    create: (data) => database_1.default.factura.create({ data }),
    update: (id, data) => database_1.default.factura.update({ where: { id }, data }),
};
//# sourceMappingURL=factura.repository.js.map