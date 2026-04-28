"use strict";
/**
 * FacturaController - Recibe requests HTTP para facturas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.facturaController = void 0;
const factura_service_1 = require("../services/factura.service");
const error_middleware_1 = require("../middlewares/error.middleware");
exports.facturaController = {
    getAll: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const facturas = await factura_service_1.facturaService.listar({
            page: req.query.page,
            limit: req.query.limit,
            estado_factura: req.query.estado_factura,
            fecha_desde: req.query.fecha_desde ? new Date(req.query.fecha_desde) : undefined,
            fecha_hasta: req.query.fecha_hasta ? new Date(req.query.fecha_hasta) : undefined,
        });
        res.json({ success: true, ...facturas });
    }),
    getById: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const factura = await factura_service_1.facturaService.obtenerPorId(Number(req.params.id));
        res.json({ success: true, data: factura });
    }),
    getByOrden: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const factura = await factura_service_1.facturaService.obtenerPorOrden(Number(req.params.id));
        res.json({ success: true, data: factura });
    }),
};
//# sourceMappingURL=factura.controller.js.map