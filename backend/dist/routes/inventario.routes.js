"use strict";
/**
 * Inventario Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventario_controller_1 = require("../controller/inventario.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/movimientos', inventario_controller_1.getMovimientos);
router.post('/movimientos', inventario_controller_1.registrarMovimiento);
router.get('/movimientos/stats', inventario_controller_1.getEstadisticas);
router.get('/lotes/vencimiento', inventario_controller_1.getLotesVencimiento);
router.get('/valor', inventario_controller_1.getValorInventario);
exports.default = router;
//# sourceMappingURL=inventario.routes.js.map