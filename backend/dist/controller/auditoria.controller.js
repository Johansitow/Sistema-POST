"use strict";
/**
 * AuditoriaController - Solo lectura, protegido por permiso auditoria.ver
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditoriaController = void 0;
const auditoria_service_1 = require("../services/auditoria.service");
const error_middleware_1 = require("../middlewares/error.middleware");
exports.auditoriaController = {
    getAll: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const result = await auditoria_service_1.auditoriaService.listar({
            page: req.query.page,
            limit: req.query.limit,
            id_usuario: req.query.id_usuario ? Number(req.query.id_usuario) : undefined,
            modulo: req.query.modulo,
            accion: req.query.accion,
            fecha_desde: req.query.fecha_desde ? new Date(req.query.fecha_desde) : undefined,
            fecha_hasta: req.query.fecha_hasta ? new Date(req.query.fecha_hasta) : undefined,
        });
        res.json({ success: true, ...result });
    }),
};
//# sourceMappingURL=auditoria.controller.js.map