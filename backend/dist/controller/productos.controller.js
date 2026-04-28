"use strict";
/**
 * ProductosController - Recibe request, valida con Zod, delega al service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStockBajo = exports.updateStock = exports.remove = exports.patch = exports.update = exports.create = exports.getBySKU = exports.getById = exports.getAll = void 0;
const producto_service_1 = require("../services/producto.service");
const productos_dto_1 = require("../dto/productos.dto");
const error_middleware_1 = require("../middlewares/error.middleware");
const qs = (val) => Array.isArray(val) ? val[0] : val;
exports.getAll = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const result = await producto_service_1.productoService.listar({
        page: req.query.page,
        limit: req.query.limit,
        search: qs(req.query.search),
        categoria: req.query.categoria ? Number(req.query.categoria) : undefined,
        estado: qs(req.query.estado),
    });
    res.json(result);
});
exports.getById = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const producto = await producto_service_1.productoService.obtenerPorId(Number(req.params.id));
    res.json(producto);
});
exports.getBySKU = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const sku = Array.isArray(req.params.sku) ? req.params.sku[0] : req.params.sku;
    const producto = await producto_service_1.productoService.obtenerPorSKU(sku);
    res.json(producto);
});
exports.create = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = productos_dto_1.createProductoSchema.parse(req.body);
    const producto = await producto_service_1.productoService.crear(data);
    res.status(201).json(producto);
});
exports.update = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = productos_dto_1.updateProductoSchema.parse(req.body);
    const producto = await producto_service_1.productoService.actualizar(Number(req.params.id), data);
    res.json(producto);
});
exports.patch = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = productos_dto_1.updateProductoSchema.partial().parse(req.body);
    const producto = await producto_service_1.productoService.actualizar(Number(req.params.id), data);
    res.json(producto);
});
exports.remove = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    await producto_service_1.productoService.eliminar(Number(req.params.id));
    res.status(204).send();
});
exports.updateStock = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const { cantidad, tipo } = productos_dto_1.updateStockSchema.parse(req.body);
    const producto = await producto_service_1.productoService.actualizarStock(Number(req.params.id), cantidad, tipo);
    res.json(producto);
});
exports.getStockBajo = (0, error_middleware_1.asyncHandler)(async (_req, res) => {
    const productos = await producto_service_1.productoService.stockBajo();
    res.json(productos);
});
//# sourceMappingURL=productos.controller.js.map