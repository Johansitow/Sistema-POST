"use strict";
/**
 * AuditoriaRepository - Solo queries Prisma para auditoría
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrarAuditoria = exports.auditoriaRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const pagination_1 = require("../lib/pagination");
exports.auditoriaRepository = {
    findAll: (pagination, filters) => {
        const where = {};
        if (filters.id_usuario)
            where.id_usuario = filters.id_usuario;
        if (filters.modulo)
            where.modulo = { contains: filters.modulo, mode: 'insensitive' };
        if (filters.accion)
            where.accion = { contains: filters.accion, mode: 'insensitive' };
        if (filters.fecha_desde || filters.fecha_hasta) {
            where.fecha_hora = {};
            if (filters.fecha_desde)
                where.fecha_hora.gte = filters.fecha_desde;
            if (filters.fecha_hasta)
                where.fecha_hora.lte = filters.fecha_hasta;
        }
        return Promise.all([
            database_1.default.auditoria.findMany({
                where,
                include: {
                    usuario: { select: { id: true, nombre_completo: true, usuario: true } },
                },
                orderBy: { fecha_hora: 'desc' },
                skip: (0, pagination_1.getSkip)(pagination),
                take: pagination.limit,
            }),
            database_1.default.auditoria.count({ where }),
        ]);
    },
    create: (data) => database_1.default.auditoria.create({ data }),
};
/**
 * registrarAuditoria — helper que llaman los services para registrar acciones
 *
 * Es fire-and-forget: no lanza errores al caller si falla.
 * La auditoría nunca debe interrumpir el flujo de negocio.
 *
 * Uso en un service:
 *   await registrarAuditoria({
 *     id_usuario: req.user.id,
 *     accion: 'CREAR_PRODUCTO',
 *     modulo: 'inventario',
 *     tabla_afectada: 'productos',
 *     id_registro_afectado: producto.id,
 *     datos_nuevos: producto,
 *     ip_address: req.ip,
 *   });
 */
const registrarAuditoria = async (data) => {
    try {
        await exports.auditoriaRepository.create(data);
    }
    catch (error) {
        // Log silencioso: la auditoría nunca bloquea el flujo principal
        console.error('[Auditoría] Error al registrar:', error);
    }
};
exports.registrarAuditoria = registrarAuditoria;
//# sourceMappingURL=auditoria.repository.js.map