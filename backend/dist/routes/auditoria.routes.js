"use strict";
/**
 * Auditoría Routes
 *
 * GET /api/auditoria → historial completo con filtros
 *
 * Protegido por requireRole('auditoria.ver'):
 * Solo el superadmin tiene este permiso por defecto.
 * El superadmin puede delegarlo a otros usuarios desde el frontend.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auditoria_controller_1 = require("../controller/auditoria.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.use((0, auth_middleware_1.requireRole)('auditoria.ver'));
router.get('/', auditoria_controller_1.auditoriaController.getAll);
exports.default = router;
//# sourceMappingURL=auditoria.routes.js.map