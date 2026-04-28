"use strict";
/**
 * Reportes Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reportes_controller_1 = require("../controller/reportes.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/ventas', reportes_controller_1.getVentas);
router.get('/productos', reportes_controller_1.getProductosMasVendidos);
router.get('/categorias', reportes_controller_1.getVentasPorCategoria);
router.get('/metodos-pago', reportes_controller_1.getMetodosPago);
router.get('/horas', reportes_controller_1.getVentasPorHora);
router.get('/completo', reportes_controller_1.getReporteCompleto);
exports.default = router;
//# sourceMappingURL=reportes.routes.js.map