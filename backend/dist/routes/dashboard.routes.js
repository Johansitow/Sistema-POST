"use strict";
/**
 * Dashboard Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("../controller/dashboard.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/stats', dashboard_controller_1.getStats);
router.get('/ventas', dashboard_controller_1.getResumenVentas);
router.get('/alertas', dashboard_controller_1.getAlertasInventario);
exports.default = router;
//# sourceMappingURL=dashboard.routes.js.map