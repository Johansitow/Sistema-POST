"use strict";
/**
 * Rutas de Turnos y Cierres de Caja
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cierre_caja_service_1 = require("../services/cierre-caja.service");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const permission_middleware_1 = require("../middlewares/permission.middleware");
const response_1 = require("../lib/response");
const router = (0, express_1.Router)();
// ── Turnos ────────────────────────────────────────────────────────────────────
router.get('/turnos', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const soloActivos = req.query.activo === 'true';
        res.json((0, response_1.successResponse)(await cierre_caja_service_1.cierreCajaService.listarTurnos(soloActivos)));
    }
    catch (e) {
        next(e);
    }
});
router.get('/turnos/:id', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        res.json((0, response_1.successResponse)(await cierre_caja_service_1.cierreCajaService.obtenerTurno(Number(req.params.id))));
    }
    catch (e) {
        next(e);
    }
});
router.post('/turnos', auth_middleware_1.authenticate, (0, permission_middleware_1.requirePermission)('config.sistema'), async (req, res, next) => {
    try {
        const { nombre, hora_apertura, hora_cierre, dias_semana } = req.body;
        if (!nombre || !hora_apertura || !hora_cierre) {
            res.status(400).json({ error: 'nombre, hora_apertura y hora_cierre son requeridos' });
            return;
        }
        const data = await cierre_caja_service_1.cierreCajaService.crearTurno({ nombre, hora_apertura, hora_cierre, dias_semana });
        res.status(201).json((0, response_1.successResponse)(data, 'Turno creado'));
    }
    catch (e) {
        next(e);
    }
});
router.put('/turnos/:id', auth_middleware_1.authenticate, (0, permission_middleware_1.requirePermission)('config.sistema'), async (req, res, next) => {
    try {
        const data = await cierre_caja_service_1.cierreCajaService.actualizarTurno(Number(req.params.id), req.body);
        res.json((0, response_1.successResponse)(data, 'Turno actualizado'));
    }
    catch (e) {
        next(e);
    }
});
router.delete('/turnos/:id', auth_middleware_1.authenticate, (0, permission_middleware_1.requirePermission)('config.sistema'), async (req, res, next) => {
    try {
        await cierre_caja_service_1.cierreCajaService.eliminarTurno(Number(req.params.id));
        res.json((0, response_1.successResponse)(null, 'Turno eliminado'));
    }
    catch (e) {
        next(e);
    }
});
// ── Cierres ───────────────────────────────────────────────────────────────────
router.get('/cierres', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { page, limit, id_usuario, estado, fecha_desde, fecha_hasta } = req.query;
        const data = await cierre_caja_service_1.cierreCajaService.listar({
            page, limit,
            id_usuario: id_usuario ? Number(id_usuario) : undefined,
            estado: estado ? estado : undefined,
            fecha_desde: fecha_desde ? new Date(fecha_desde) : undefined,
            fecha_hasta: fecha_hasta ? new Date(fecha_hasta) : undefined,
        });
        res.json((0, response_1.successResponse)(data));
    }
    catch (e) {
        next(e);
    }
});
router.get('/cierres/:id', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        res.json((0, response_1.successResponse)(await cierre_caja_service_1.cierreCajaService.obtenerPorId(Number(req.params.id))));
    }
    catch (e) {
        next(e);
    }
});
router.post('/cierres/iniciar', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { id_turno, fecha_apertura, monto_inicial } = req.body;
        if (!fecha_apertura || monto_inicial === undefined) {
            res.status(400).json({ error: 'fecha_apertura y monto_inicial son requeridos' });
            return;
        }
        const data = await cierre_caja_service_1.cierreCajaService.iniciarCierre({
            id_usuario: req.user.id,
            id_turno: id_turno ? Number(id_turno) : undefined,
            fecha_apertura: new Date(fecha_apertura),
            monto_inicial: Number(monto_inicial),
        });
        res.status(201).json((0, response_1.successResponse)(data, 'Cierre iniciado'));
    }
    catch (e) {
        if (e.message?.includes('orden(es) abiertas')) {
            res.status(409).json({
                error: e.message,
                detalle: e.ordenes_abiertas ?? [],
            });
            return;
        }
        next(e);
    }
});
router.post('/cierres/:id/confirmar', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { monto_final, justificacion, observaciones } = req.body;
        if (monto_final === undefined) {
            res.status(400).json({ error: 'monto_final es requerido' });
            return;
        }
        const data = await cierre_caja_service_1.cierreCajaService.confirmarCierre(Number(req.params.id), {
            monto_final: Number(monto_final),
            justificacion, observaciones,
        });
        res.json((0, response_1.successResponse)(data, 'Cierre confirmado'));
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=cierre-caja.routes.js.map