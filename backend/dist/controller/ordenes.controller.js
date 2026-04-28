"use strict";
/**
 * OrdenesController - Recibe request, valida con Zod, delega al service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEstadisticas = exports.removeDetalle = exports.updateDetalle = exports.addDetalle = exports.remove = exports.updateEstado = exports.update = exports.create = exports.getById = exports.getAll = void 0;
const orden_service_1 = require("../services/orden.service");
const ordenes_dto_1 = require("../dto/ordenes.dto");
const error_middleware_1 = require("../middlewares/error.middleware");
const qs = (val) => Array.isArray(val) ? val[0] : val;
exports.getAll = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const result = await orden_service_1.ordenService.listar({
        page: req.query.page,
        limit: req.query.limit,
        tipo_orden: qs(req.query.tipo_orden),
        id_estado: req.query.id_estado ? Number(req.query.id_estado) : undefined,
        fecha_desde: req.query.fecha_desde ? new Date(qs(req.query.fecha_desde)) : undefined,
        fecha_hasta: req.query.fecha_hasta ? new Date(qs(req.query.fecha_hasta)) : undefined,
    });
    res.json(result);
});
exports.getById = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const orden = await orden_service_1.ordenService.obtenerPorId(Number(req.params.id));
    res.json(orden);
});
exports.create = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = ordenes_dto_1.createOrdenSchema.parse(req.body);
    const orden = await orden_service_1.ordenService.crear(data);
    res.status(201).json(orden);
});
exports.update = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = ordenes_dto_1.updateOrdenSchema.parse(req.body);
    const orden = await orden_service_1.ordenService.actualizar(Number(req.params.id), data);
    res.json(orden);
});
exports.updateEstado = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const { id_estado } = ordenes_dto_1.updateEstadoSchema.parse(req.body);
    const orden = await orden_service_1.ordenService.actualizarEstado(Number(req.params.id), id_estado);
    res.json(orden);
});
exports.remove = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    await orden_service_1.ordenService.eliminar(Number(req.params.id));
    res.status(204).send();
});
exports.addDetalle = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = ordenes_dto_1.addDetalleSchema.parse(req.body);
    const detalle = await orden_service_1.ordenService.agregarDetalle(Number(req.params.id), data);
    res.status(201).json(detalle);
});
exports.updateDetalle = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = ordenes_dto_1.updateDetalleSchema.parse(req.body);
    const detalle = await orden_service_1.ordenService.actualizarDetalle(Number(req.params.detalleId), data);
    res.json(detalle);
});
exports.removeDetalle = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    await orden_service_1.ordenService.eliminarDetalle(Number(req.params.detalleId));
    res.status(204).send();
});
exports.getEstadisticas = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const stats = await orden_service_1.ordenService.estadisticas({
        fecha_desde: req.query.fecha_desde ? new Date(qs(req.query.fecha_desde)) : undefined,
        fecha_hasta: req.query.fecha_hasta ? new Date(qs(req.query.fecha_hasta)) : undefined,
    });
    res.json(stats);
});
//# sourceMappingURL=ordenes.controller.js.map