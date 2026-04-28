"use strict";
/**
 * Rutas de Recetas
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const receta_service_1 = require("../services/receta.service");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const permission_middleware_1 = require("../middlewares/permission.middleware");
const response_1 = require("../lib/response");
const router = (0, express_1.Router)();
// Va primero para no colisionar con /:id
router.post('/verificar-stock/:id_orden', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const result = await receta_service_1.recetaService.verificarStockParaOrden(Number(req.params.id_orden));
        res.json((0, response_1.successResponse)(result));
    }
    catch (e) {
        if (e.message?.includes('Stock insuficiente')) {
            res.status(422).json({
                error: e.message,
                detalle: e.ingredientes_faltantes ?? [],
            });
            return;
        }
        next(e);
    }
});
router.get('/producto/:id_producto', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const data = await receta_service_1.recetaService.obtenerPorProducto(Number(req.params.id_producto));
        res.json((0, response_1.successResponse)(data));
    }
    catch (e) {
        next(e);
    }
});
router.get('/', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { page, limit, id_producto, estado } = req.query;
        const data = await receta_service_1.recetaService.listar({
            page, limit,
            id_producto: id_producto ? Number(id_producto) : undefined,
            estado,
        });
        res.json((0, response_1.successResponse)(data));
    }
    catch (e) {
        next(e);
    }
});
router.get('/:id', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        res.json((0, response_1.successResponse)(await receta_service_1.recetaService.obtenerPorId(Number(req.params.id))));
    }
    catch (e) {
        next(e);
    }
});
router.get('/:id/rentabilidad', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const receta = await receta_service_1.recetaService.obtenerPorId(Number(req.params.id));
        res.json((0, response_1.successResponse)(receta.rentabilidad));
    }
    catch (e) {
        next(e);
    }
});
router.post('/', auth_middleware_1.authenticate, (0, permission_middleware_1.requirePermission)('productos.crear'), async (req, res, next) => {
    try {
        const { id_producto_final, nombre_receta, ingredientes, ...rest } = req.body;
        if (!id_producto_final || !nombre_receta || !Array.isArray(ingredientes) || ingredientes.length === 0) {
            res.status(400).json({ error: 'id_producto_final, nombre_receta e ingredientes son requeridos' });
            return;
        }
        const data = await receta_service_1.recetaService.crear({ id_producto_final, nombre_receta, ingredientes, ...rest });
        res.status(201).json((0, response_1.successResponse)(data, 'Receta creada'));
    }
    catch (e) {
        next(e);
    }
});
router.put('/:id', auth_middleware_1.authenticate, (0, permission_middleware_1.requirePermission)('productos.editar'), async (req, res, next) => {
    try {
        const { ingredientes: _ing, ...resto } = req.body;
        const data = await receta_service_1.recetaService.actualizar(Number(req.params.id), resto);
        res.json((0, response_1.successResponse)(data, 'Receta actualizada'));
    }
    catch (e) {
        next(e);
    }
});
router.put('/:id/ingredientes', auth_middleware_1.authenticate, (0, permission_middleware_1.requirePermission)('productos.editar'), async (req, res, next) => {
    try {
        const { ingredientes } = req.body;
        if (!Array.isArray(ingredientes) || ingredientes.length === 0) {
            res.status(400).json({ error: 'ingredientes debe ser un array no vacío' });
            return;
        }
        const data = await receta_service_1.recetaService.actualizarIngredientes(Number(req.params.id), ingredientes);
        res.json((0, response_1.successResponse)(data, 'Ingredientes actualizados'));
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=receta.routes.js.map