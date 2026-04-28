"use strict";
/**
 * InventarioController - Recibe request, valida con DTO, delega al service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValorInventario = exports.getLotesVencimiento = exports.getEstadisticas = exports.registrarMovimiento = exports.getMovimientos = void 0;
const inventario_service_1 = require("../services/inventario.service");
const error_middleware_1 = require("../middlewares/error.middleware");
const inventario_dto_1 = require("../dto/inventario.dto");
const qs = (val) => Array.isArray(val) ? val[0] : val;
exports.getMovimientos = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const result = await inventario_service_1.inventarioService.listarMovimientos({
        page: req.query.page,
        limit: req.query.limit,
        id_producto: req.query.id_producto ? Number(req.query.id_producto) : undefined,
        tipo: qs(req.query.tipo),
        fecha_desde: req.query.fecha_desde ? new Date(qs(req.query.fecha_desde)) : undefined,
        fecha_hasta: req.query.fecha_hasta ? new Date(qs(req.query.fecha_hasta)) : undefined,
    });
    res.json(result);
});
exports.registrarMovimiento = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = inventario_dto_1.registrarMovimientoSchema.parse(req.body);
    const movimiento = await inventario_service_1.inventarioService.registrarMovimiento(data);
    res.status(201).json(movimiento);
});
exports.getEstadisticas = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const dias = req.query.dias ? Number(req.query.dias) : 30;
    const stats = await inventario_service_1.inventarioService.estadisticasMovimientos(dias);
    res.json(stats);
});
exports.getLotesVencimiento = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const dias = req.query.dias ? Number(req.query.dias) : 30;
    const lotes = await inventario_service_1.inventarioService.lotesProximosVencer(dias);
    res.json(lotes);
});
exports.getValorInventario = (0, error_middleware_1.asyncHandler)(async (_req, res) => {
    const valor = await inventario_service_1.inventarioService.valorInventario();
    res.json(valor);
});
//# sourceMappingURL=inventario.controller.js.map