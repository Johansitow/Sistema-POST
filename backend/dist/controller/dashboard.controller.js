"use strict";
/**
 * DashboardController - Recibe request, delega al service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAlertasInventario = exports.getResumenVentas = exports.getStats = void 0;
const dashboard_service_1 = require("../services/dashboard.service");
const error_middleware_1 = require("../middlewares/error.middleware");
exports.getStats = (0, error_middleware_1.asyncHandler)(async (_req, res) => {
    const stats = await dashboard_service_1.dashboardService.getStats();
    res.json(stats);
});
exports.getResumenVentas = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const dias = req.query.dias ? Number(req.query.dias) : 30;
    const ventas = await dashboard_service_1.dashboardService.getResumenVentas(dias);
    res.json(ventas);
});
exports.getAlertasInventario = (0, error_middleware_1.asyncHandler)(async (_req, res) => {
    const alertas = await dashboard_service_1.dashboardService.getAlertasInventario();
    res.json(alertas);
});
//# sourceMappingURL=dashboard.controller.js.map