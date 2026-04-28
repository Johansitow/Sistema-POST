"use strict";
/**
 * LoteRepository - Solo queries Prisma para lotes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loteRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const pagination_1 = require("../lib/pagination");
exports.loteRepository = {
    findAll: (pagination, filters) => {
        const where = {};
        if (filters.id_producto)
            where.id_producto = filters.id_producto;
        if (filters.estado_lote)
            where.estado_lote = filters.estado_lote;
        if (filters.vence_antes_de) {
            where.fecha_vencimiento = { lte: filters.vence_antes_de };
        }
        return Promise.all([
            database_1.default.lote.findMany({
                where,
                include: { producto: { include: { categoria: true } } },
                orderBy: { fecha_produccion: 'desc' },
                skip: (0, pagination_1.getSkip)(pagination),
                take: pagination.limit,
            }),
            database_1.default.lote.count({ where }),
        ]);
    },
    findById: (id) => database_1.default.lote.findUnique({
        where: { id },
        include: { producto: { include: { categoria: true } } },
    }),
    /**
     * findUltimo — busca el último lote creado para generar el número siguiente
     * Ordena por numero_lote descendente para obtener el mayor.
     */
    findUltimo: () => database_1.default.lote.findFirst({ orderBy: { numero_lote: 'desc' } }),
    create: (data) => database_1.default.lote.create({ data, include: { producto: true } }),
    update: (id, data) => database_1.default.lote.update({ where: { id }, data }),
};
//# sourceMappingURL=lote.repository.js.map