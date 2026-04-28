"use strict";
/**
 * AlertaRepository - Solo queries Prisma para alertas y tipos de alerta
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertaRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const pagination_1 = require("../lib/pagination");
exports.alertaRepository = {
    // ─── TipoAlerta ─────────────────────────────────────────────────────────────
    findTipoAll: () => database_1.default.tipoAlerta.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' },
    }),
    findTipoByCodigo: (codigo) => database_1.default.tipoAlerta.findFirst({ where: { codigo } }),
    findTipoById: (id) => database_1.default.tipoAlerta.findUnique({ where: { id } }),
    createTipo: (data) => database_1.default.tipoAlerta.create({ data }),
    updateTipo: (id, data) => database_1.default.tipoAlerta.update({ where: { id }, data }),
    // ─── Alertas ─────────────────────────────────────────────────────────────────
    findAll: (pagination, filters) => {
        const where = {};
        if (filters.es_leida !== undefined)
            where.es_leida = filters.es_leida;
        if (filters.nivel_prioridad)
            where.nivel_prioridad = filters.nivel_prioridad;
        if (filters.id_tipo_alerta)
            where.id_tipo_alerta = filters.id_tipo_alerta;
        return Promise.all([
            database_1.default.alerta.findMany({
                where,
                include: {
                    tipo_alerta: true,
                    producto: { select: { id: true, nombre: true, sku: true, stock_actual: true, stock_minimo: true } },
                },
                orderBy: [{ es_leida: 'asc' }, { fecha_creacion: 'desc' }],
                skip: (0, pagination_1.getSkip)(pagination),
                take: pagination.limit,
            }),
            database_1.default.alerta.count({ where }),
        ]);
    },
    countNoLeidas: () => database_1.default.alerta.count({ where: { es_leida: false } }),
    /**
     * findActivaByProductoYTipo — busca una alerta no resuelta para
     * un producto y tipo específico. Evita duplicados al sincronizar.
     */
    findActivaByProductoYTipo: (id_producto, id_tipo_alerta) => database_1.default.alerta.findFirst({
        where: { id_producto, id_tipo_alerta, es_leida: false },
    }),
    create: (data) => database_1.default.alerta.create({ data }),
    marcarLeida: (id) => database_1.default.alerta.update({
        where: { id },
        data: { es_leida: true, fecha_leida: new Date() },
    }),
    marcarTodasLeidas: () => database_1.default.alerta.updateMany({
        where: { es_leida: false },
        data: { es_leida: true, fecha_leida: new Date() },
    }),
};
//# sourceMappingURL=alerta.repository.js.map