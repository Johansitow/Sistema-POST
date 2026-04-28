"use strict";
/**
 * ReportesController - Recibe request, delega al service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReporteCompleto = exports.getVentasPorHora = exports.getMetodosPago = exports.getVentasPorCategoria = exports.getProductosMasVendidos = exports.getVentas = void 0;
const reporte_service_1 = require("../services/reporte.service");
const error_middleware_1 = require("../middlewares/error.middleware");
const qs = (val) => Array.isArray(val) ? val[0] : val;
const parseFechas = (req) => ({
    fecha_desde: req.query.fecha_desde ? new Date(qs(req.query.fecha_desde)) : undefined,
    fecha_hasta: req.query.fecha_hasta ? new Date(qs(req.query.fecha_hasta)) : undefined,
});
exports.getVentas = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const result = await reporte_service_1.reporteService.getVentas({
        ...parseFechas(req),
        tipo_orden: qs(req.query.tipo_orden),
        agrupar_por: qs(req.query.agrupar_por),
    });
    res.json(result);
});
exports.getProductosMasVendidos = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const result = await reporte_service_1.reporteService.getProductosMasVendidos({
        ...parseFechas(req),
        limit: req.query.limit ? Number(req.query.limit) : 20,
    });
    res.json(result);
});
exports.getVentasPorCategoria = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const result = await reporte_service_1.reporteService.getVentasPorCategoria(parseFechas(req));
    res.json(result);
});
exports.getMetodosPago = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const result = await reporte_service_1.reporteService.getMetodosPago(parseFechas(req));
    res.json(result);
});
exports.getVentasPorHora = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const result = await reporte_service_1.reporteService.getVentasPorHora(parseFechas(req));
    res.json(result);
});
exports.getReporteCompleto = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const result = await reporte_service_1.reporteService.getReporteCompleto(parseFechas(req));
    res.json(result);
});
//# sourceMappingURL=reportes.controller.js.map