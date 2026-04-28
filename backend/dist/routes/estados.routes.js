"use strict";
/**
 * Estados de Orden Routes
 *
 * GET  /api/estados-orden                          → listar todos
 * GET  /api/estados-orden/:id                      → detalle con transiciones
 * PUT  /api/estados-orden/:id                      → editar visual (superadmin)
 * GET  /api/estados-orden/:id/transiciones         → transiciones desde ese estado
 * POST /api/estados-orden/:id/transiciones         → agregar transición
 * DELETE /api/estados-orden/:id/transiciones/:transicionId → eliminar transición
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const estado_controller_1 = require("../controller/estado.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', estado_controller_1.estadoController.getAll);
router.get('/:id', estado_controller_1.estadoController.getById);
// Solo superadmin puede modificar estados y transiciones
router.put('/:id', auth_middleware_1.requireSuperAdmin, estado_controller_1.estadoController.update);
router.get('/:id/transiciones', estado_controller_1.estadoController.getTransiciones);
router.post('/:id/transiciones', auth_middleware_1.requireSuperAdmin, estado_controller_1.estadoController.addTransicion);
router.delete('/:id/transiciones/:transicionId', auth_middleware_1.requireSuperAdmin, estado_controller_1.estadoController.deleteTransicion);
exports.default = router;
//# sourceMappingURL=estados.routes.js.map