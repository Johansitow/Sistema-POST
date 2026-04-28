"use strict";
/**
 * TurnoCajaRepository + CierreCajaRepository
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cierreCajaRepository = exports.turnoCajaRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const client_1 = require("@prisma/client");
// ── Turnos ────────────────────────────────────────────────────────────────────
exports.turnoCajaRepository = {
    findAll: (soloActivos = false) => database_1.default.turnoCaja.findMany({
        where: soloActivos ? { activo: true } : undefined,
        include: { _count: { select: { cierres: true } } },
        orderBy: { hora_apertura: 'asc' },
    }),
    findById: (id) => database_1.default.turnoCaja.findUnique({
        where: { id },
        include: { cierres: { take: 5, orderBy: { fecha_cierre: 'desc' } } },
    }),
    create: (data) => database_1.default.turnoCaja.create({
        data: {
            ...data,
            // Prisma JSON no acepta null nativo; usar Prisma.JsonNull o un array vacío
            dias_semana: data.dias_semana ?? client_1.Prisma.JsonNull,
        },
    }),
    update: (id, data) => database_1.default.turnoCaja.update({ where: { id }, data }),
    delete: (id) => database_1.default.turnoCaja.delete({ where: { id } }),
};
// ── Cierres ───────────────────────────────────────────────────────────────────
exports.cierreCajaRepository = {
    findAll: (params) => database_1.default.$transaction([
        database_1.default.cierreCaja.findMany({
            skip: params.skip, take: params.take,
            where: {
                ...(params.id_usuario && { id_usuario: params.id_usuario }),
                ...(params.estado && { estado: params.estado }),
                ...(params.fecha_desde || params.fecha_hasta
                    ? { fecha_cierre: {
                            ...(params.fecha_desde && { gte: params.fecha_desde }),
                            ...(params.fecha_hasta && { lte: params.fecha_hasta }),
                        } }
                    : {}),
            },
            include: { usuario: { select: { id: true, nombre_completo: true, usuario: true } }, turno: true },
            orderBy: { fecha_cierre: 'desc' },
        }),
        database_1.default.cierreCaja.count(),
    ]),
    findById: (id) => database_1.default.cierreCaja.findUnique({
        where: { id },
        include: {
            usuario: { select: { id: true, nombre_completo: true, usuario: true } },
            turno: true,
        },
    }),
    findByNumeroCierre: (numero) => database_1.default.cierreCaja.findUnique({ where: { numero_cierre: numero } }),
    findUltimo: () => database_1.default.cierreCaja.findFirst({ orderBy: { id: 'desc' } }),
    create: (data) => database_1.default.cierreCaja.create({
        data: {
            ...data,
            monto_inicial: data.monto_inicial,
            monto_final: data.monto_final,
            total_ventas: data.total_ventas,
            total_efectivo: data.total_efectivo,
            diferencia: data.diferencia,
            totales_por_metodo: data.totales_por_metodo ?? undefined,
        },
        include: { usuario: true, turno: true },
    }),
    update: (id, data) => database_1.default.cierreCaja.update({ where: { id }, data }),
};
//# sourceMappingURL=turno-cierre.repository.js.map