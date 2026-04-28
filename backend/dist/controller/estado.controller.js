"use strict";
/**
 * EstadoController - Recibe requests HTTP para estados y transiciones
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.estadoController = void 0;
const estado_service_1 = require("../services/estado.service");
const error_middleware_1 = require("../middlewares/error.middleware");
exports.estadoController = {
    getAll: (0, error_middleware_1.asyncHandler)(async (_req, res) => {
        const estados = await estado_service_1.estadoService.listar();
        res.json({ success: true, data: estados });
    }),
    getById: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const estado = await estado_service_1.estadoService.obtenerPorId(Number(req.params.id));
        res.json({ success: true, data: estado });
    }),
    update: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const estado = await estado_service_1.estadoService.actualizar(Number(req.params.id), req.body);
        res.json({ success: true, data: estado, message: 'Estado actualizado correctamente' });
    }),
    // ─── Transiciones ─────────────────────────────────────────────────────────
    getTransiciones: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const transiciones = await estado_service_1.estadoService.listarTransiciones(Number(req.params.id));
        res.json({ success: true, data: transiciones });
    }),
    addTransicion: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const transicion = await estado_service_1.estadoService.agregarTransicion({
            id_estado_desde: Number(req.params.id),
            id_estado_hacia: req.body.id_estado_hacia,
            requiere_permiso: req.body.requiere_permiso,
            puede_ser_automatico: req.body.puede_ser_automatico,
            orden: req.body.orden,
        });
        res.status(201).json({ success: true, data: transicion, message: 'Transición agregada correctamente' });
    }),
    deleteTransicion: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        await estado_service_1.estadoService.eliminarTransicion(Number(req.params.transicionId));
        res.json({ success: true, message: 'Transición eliminada correctamente' });
    }),
};
//# sourceMappingURL=estado.controller.js.map