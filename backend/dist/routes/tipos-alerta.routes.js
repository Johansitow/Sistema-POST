"use strict";
/**
 * Tipos de Alerta Routes — rutas de configuración de tipos
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const alerta_controller_1 = require("../controller/alerta.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', alerta_controller_1.alertaController.getTipos);
router.post('/', auth_middleware_1.requireSuperAdmin, alerta_controller_1.alertaController.createTipo);
router.put('/:id', auth_middleware_1.requireSuperAdmin, alerta_controller_1.alertaController.updateTipo);
exports.default = router;
//# sourceMappingURL=tipos-alerta.routes.js.map