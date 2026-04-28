"use strict";
/**
 * AuditoriaService - Solo lectura del historial de auditoría
 * La escritura se hace directamente con registrarAuditoria() desde cada service.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditoriaService = void 0;
const auditoria_repository_1 = require("../repositories/auditoria.repository");
const pagination_1 = require("../lib/pagination");
exports.auditoriaService = {
    async listar(params) {
        const pagination = (0, pagination_1.getPaginationParams)(params.page, params.limit);
        const [registros, total] = await auditoria_repository_1.auditoriaRepository.findAll(pagination, {
            id_usuario: params.id_usuario,
            modulo: params.modulo,
            accion: params.accion,
            fecha_desde: params.fecha_desde,
            fecha_hasta: params.fecha_hasta,
        });
        return (0, pagination_1.buildPaginatedResult)(registros, total, pagination);
    },
};
//# sourceMappingURL=auditoria.service.js.map