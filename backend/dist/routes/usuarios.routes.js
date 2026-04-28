"use strict";
/**
 * Usuarios Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const usuarios_controller_1 = require("../controller/usuarios.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Todas requieren autenticación y ser super admin
router.use(auth_middleware_1.authenticate, auth_middleware_1.requireSuperAdmin);
router.get('/', usuarios_controller_1.listar);
router.get('/roles', usuarios_controller_1.listarRoles);
router.get('/estadisticas', usuarios_controller_1.estadisticas);
router.get('/:id', usuarios_controller_1.obtener);
router.post('/', usuarios_controller_1.crear);
router.put('/:id', usuarios_controller_1.actualizar);
router.patch('/:id/estado', usuarios_controller_1.cambiarEstado);
router.patch('/:id/reset-password', usuarios_controller_1.resetPassword);
router.patch('/:id/rol', usuarios_controller_1.asignarRol);
exports.default = router;
//# sourceMappingURL=usuarios.routes.js.map