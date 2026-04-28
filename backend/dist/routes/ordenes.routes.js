"use strict";
/**
 * Ordenes Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ordenes_controller_1 = require("../controller/ordenes.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', ordenes_controller_1.getAll);
router.get('/estadisticas', ordenes_controller_1.getEstadisticas);
router.get('/:id', ordenes_controller_1.getById);
router.post('/', ordenes_controller_1.create);
router.put('/:id', ordenes_controller_1.update);
router.patch('/:id/estado', ordenes_controller_1.updateEstado);
router.delete('/:id', ordenes_controller_1.remove);
router.post('/:id/detalles', ordenes_controller_1.addDetalle);
router.put('/:id/detalles/:detalleId', ordenes_controller_1.updateDetalle);
router.delete('/detalles/:detalleId', ordenes_controller_1.removeDetalle);
exports.default = router;
//# sourceMappingURL=ordenes.routes.js.map