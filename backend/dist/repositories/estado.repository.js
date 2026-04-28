"use strict";
/**
 * EstadoRepository - Queries Prisma para estados de orden y transiciones
 *
 * Separado del orden.repository porque estados y transiciones
 * son configuración del sistema, no datos de negocio.
 * El admin los gestiona desde el frontend; las órdenes solo los consultan.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.estadoRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
exports.estadoRepository = {
    // ─── Estados ────────────────────────────────────────────────────────────────
    /**
     * findAll — lista todos los estados con sus transiciones de salida
     * Incluye transiciones para que el frontend pueda construir el flujo visual.
     */
    findAll: () => database_1.default.estadoOrden.findMany({
        where: { activo: true },
        include: {
            transiciones_desde: {
                include: { estado_hacia: true },
                orderBy: { orden: 'asc' },
            },
        },
        orderBy: { orden: 'asc' },
    }),
    findById: (id) => database_1.default.estadoOrden.findUnique({
        where: { id },
        include: {
            transiciones_desde: { include: { estado_hacia: true } },
            transiciones_hacia: { include: { estado_desde: true } },
        },
    }),
    findByCodigo: (codigo) => database_1.default.estadoOrden.findFirst({ where: { codigo } }),
    /**
     * update — solo permite cambiar campos visuales (nombre, color, icono)
     * Los campos de sistema (es_inicial, es_final, codigo) no se tocan desde aquí.
     */
    update: (id, data) => database_1.default.estadoOrden.update({ where: { id }, data }),
    // ─── Transiciones ────────────────────────────────────────────────────────────
    /**
     * findTransicion — verifica si una transición específica existe
     * Usado por orden.service para validar antes de cambiar estado.
     * Retorna null si la transición no está permitida.
     */
    findTransicion: (id_estado_desde, id_estado_hacia) => database_1.default.estadoTransicion.findFirst({
        where: { id_estado_desde, id_estado_hacia },
    }),
    findTransicionesByEstado: (id_estado_desde) => database_1.default.estadoTransicion.findMany({
        where: { id_estado_desde },
        include: { estado_hacia: true },
        orderBy: { orden: 'asc' },
    }),
    createTransicion: (data) => database_1.default.estadoTransicion.create({ data }),
    deleteTransicion: (id) => database_1.default.estadoTransicion.delete({ where: { id } }),
    findTransicionById: (id) => database_1.default.estadoTransicion.findUnique({
        where: { id },
        include: { estado_desde: true, estado_hacia: true },
    }),
};
//# sourceMappingURL=estado.repository.js.map