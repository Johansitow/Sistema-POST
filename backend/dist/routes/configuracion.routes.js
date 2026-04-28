"use strict";
/**
 * Rutas de Configuración y Permisos
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const configuracion_service_1 = require("../services/configuracion.service");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const permission_middleware_1 = require("../middlewares/permission.middleware");
const response_1 = require("../lib/response");
const router = (0, express_1.Router)();
// ── Configuración ─────────────────────────────────────────────────────────────
router.get('/', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const categoria = Array.isArray(req.query.categoria)
            ? String(req.query.categoria[0])
            : req.query.categoria;
        const data = await configuracion_service_1.configuracionService.listar(categoria);
        res.json((0, response_1.successResponse)(data));
    }
    catch (e) {
        next(e);
    }
});
router.get('/permisos', auth_middleware_1.authenticate, (0, permission_middleware_1.requirePermission)('config.sistema'), async (_req, res, next) => {
    try {
        const data = await configuracion_service_1.configuracionService.listarPermisos();
        res.json((0, response_1.successResponse)(data));
    }
    catch (e) {
        next(e);
    }
});
router.get('/permisos/rol/:id', auth_middleware_1.authenticate, (0, permission_middleware_1.requirePermission)('config.sistema'), async (req, res, next) => {
    try {
        const data = await configuracion_service_1.configuracionService.listarPermisosRol(Number(req.params.id));
        res.json((0, response_1.successResponse)(data));
    }
    catch (e) {
        next(e);
    }
});
router.post('/permisos/rol/:id', auth_middleware_1.authenticate, (0, permission_middleware_1.requirePermission)('config.sistema'), async (req, res, next) => {
    try {
        const { id_permiso } = req.body;
        if (!id_permiso) {
            res.status(400).json({ error: 'id_permiso requerido' });
            return;
        }
        const data = await configuracion_service_1.configuracionService.asignarPermiso(Number(req.params.id), Number(id_permiso));
        res.status(201).json((0, response_1.successResponse)(data, 'Permiso asignado'));
    }
    catch (e) {
        next(e);
    }
});
router.put('/permisos/rol/:id/sync', auth_middleware_1.authenticate, (0, permission_middleware_1.requirePermission)('config.sistema'), async (req, res, next) => {
    try {
        const { ids_permisos } = req.body;
        if (!Array.isArray(ids_permisos)) {
            res.status(400).json({ error: 'ids_permisos debe ser un array' });
            return;
        }
        const data = await configuracion_service_1.configuracionService.sincronizarPermisos(Number(req.params.id), ids_permisos);
        res.json((0, response_1.successResponse)(data, 'Permisos sincronizados'));
    }
    catch (e) {
        next(e);
    }
});
router.delete('/permisos/rol/:id/:permiso', auth_middleware_1.authenticate, (0, permission_middleware_1.requirePermission)('config.sistema'), async (req, res, next) => {
    try {
        await configuracion_service_1.configuracionService.revocarPermiso(Number(req.params.id), Number(req.params.permiso));
        res.json((0, response_1.successResponse)(null, 'Permiso revocado'));
    }
    catch (e) {
        next(e);
    }
});
router.get('/:clave', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const clave = String(req.params.clave);
        const data = await configuracion_service_1.configuracionService.obtenerPorClave(clave);
        res.json((0, response_1.successResponse)(data));
    }
    catch (e) {
        next(e);
    }
});
router.put('/:clave', auth_middleware_1.authenticate, (0, permission_middleware_1.requirePermission)('config.sistema'), async (req, res, next) => {
    try {
        const clave = String(req.params.clave);
        const { valor } = req.body;
        if (valor === undefined) {
            res.status(400).json({ error: 'valor requerido' });
            return;
        }
        const data = await configuracion_service_1.configuracionService.actualizar(clave, String(valor));
        res.json((0, response_1.successResponse)(data, 'Configuración actualizada'));
    }
    catch (e) {
        next(e);
    }
});
router.patch('/', auth_middleware_1.authenticate, (0, permission_middleware_1.requirePermission)('config.sistema'), async (req, res, next) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) {
            res.status(400).json({ error: 'items debe ser un array [{ clave, valor }]' });
            return;
        }
        const data = await configuracion_service_1.configuracionService.actualizarVarias(items);
        res.json((0, response_1.successResponse)(data, 'Configuraciones actualizadas'));
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=configuracion.routes.js.map