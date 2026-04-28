"use strict";
/**
 * AlertaController - Recibe requests HTTP para alertas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertaController = void 0;
const alerta_service_1 = require("../services/alerta.service");
const error_middleware_1 = require("../middlewares/error.middleware");
exports.alertaController = {
    // ─── Tipos de alerta ─────────────────────────────────────────────────────────
    getTipos: (0, error_middleware_1.asyncHandler)(async (_req, res) => {
        const tipos = await alerta_service_1.alertaService.listarTipos();
        res.json({ success: true, data: tipos });
    }),
    createTipo: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const tipo = await alerta_service_1.alertaService.crearTipo(req.body);
        res.status(201).json({ success: true, data: tipo, message: 'Tipo de alerta creado correctamente' });
    }),
    updateTipo: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const tipo = await alerta_service_1.alertaService.actualizarTipo(Number(req.params.id), req.body);
        res.json({ success: true, data: tipo, message: 'Tipo de alerta actualizado correctamente' });
    }),
    // ─── Alertas ─────────────────────────────────────────────────────────────────
    getAll: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const result = await alerta_service_1.alertaService.listar({
            page: req.query.page,
            limit: req.query.limit,
            es_leida: req.query.es_leida !== undefined ? req.query.es_leida === 'true' : undefined,
            nivel_prioridad: req.query.nivel_prioridad,
            id_tipo_alerta: req.query.id_tipo_alerta ? Number(req.query.id_tipo_alerta) : undefined,
        });
        res.json({ success: true, ...result });
    }),
    /**
     * getCountNoLeidas — endpoint liviano para el badge del Layout
     * El frontend lo llama al cargar y cada N segundos para el badge de notificaciones.
     */
    getCountNoLeidas: (0, error_middleware_1.asyncHandler)(async (_req, res) => {
        const count = await alerta_service_1.alertaService.countNoLeidas();
        res.json({ success: true, data: count });
    }),
    marcarLeida: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const alerta = await alerta_service_1.alertaService.marcarLeida(Number(req.params.id));
        res.json({ success: true, data: alerta, message: 'Alerta marcada como leída' });
    }),
    marcarTodasLeidas: (0, error_middleware_1.asyncHandler)(async (_req, res) => {
        const result = await alerta_service_1.alertaService.marcarTodasLeidas();
        res.json({ success: true, ...result });
    }),
    sincronizar: (0, error_middleware_1.asyncHandler)(async (_req, res) => {
        const resultado = await alerta_service_1.alertaService.sincronizar();
        res.json({ success: true, data: resultado, message: `Sincronización completada: ${resultado.creadas} creadas, ${resultado.resueltas} resueltas` });
    }),
};
//# sourceMappingURL=alerta.controller.js.map