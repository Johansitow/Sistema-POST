"use strict";
/**
 * Facturas Routes
 *
 * GET /api/facturas              → listar con filtros
 * GET /api/facturas/:id          → detalle de factura
 * GET /api/ordenes/:id/factura   → factura de una orden (en ordenes.routes.ts)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const factura_controller_1 = require("../controller/factura.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', factura_controller_1.facturaController.getAll);
router.get('/:id', factura_controller_1.facturaController.getById);
exports.default = router;
//# sourceMappingURL=facturas.routes.js.map