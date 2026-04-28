"use strict";
/**
 * ProveedorController - Recibe requests HTTP para proveedores
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.proveedorController = void 0;
const proveedor_service_1 = require("../services/proveedor.service");
const error_middleware_1 = require("../middlewares/error.middleware");
exports.proveedorController = {
    getAll: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const result = await proveedor_service_1.proveedorService.listar({
            page: req.query.page,
            limit: req.query.limit,
            search: req.query.search,
            estado: req.query.estado,
        });
        res.json({ success: true, ...result });
    }),
    getById: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const proveedor = await proveedor_service_1.proveedorService.obtenerPorId(Number(req.params.id));
        res.json({ success: true, data: proveedor });
    }),
    create: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const proveedor = await proveedor_service_1.proveedorService.crear(req.body);
        res.status(201).json({ success: true, data: proveedor, message: 'Proveedor creado correctamente' });
    }),
    update: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const proveedor = await proveedor_service_1.proveedorService.actualizar(Number(req.params.id), req.body);
        res.json({ success: true, data: proveedor, message: 'Proveedor actualizado correctamente' });
    }),
    cambiarEstado: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { estado } = req.body;
        const proveedor = await proveedor_service_1.proveedorService.cambiarEstado(Number(req.params.id), estado);
        res.json({ success: true, data: proveedor, message: `Proveedor ${estado} correctamente` });
    }),
    // ─── Productos del proveedor ─────────────────────────────────────────────────
    getProductos: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const productos = await proveedor_service_1.proveedorService.listarProductos(Number(req.params.id));
        res.json({ success: true, data: productos });
    }),
    asociarProducto: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const relacion = await proveedor_service_1.proveedorService.asociarProducto(Number(req.params.id), req.body);
        res.status(201).json({ success: true, data: relacion, message: 'Producto asociado correctamente' });
    }),
    actualizarRelacion: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const relacion = await proveedor_service_1.proveedorService.actualizarRelacion(Number(req.params.id), Number(req.params.productoId), req.body);
        res.json({ success: true, data: relacion, message: 'Relación actualizada correctamente' });
    }),
    desasociarProducto: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        await proveedor_service_1.proveedorService.desasociarProducto(Number(req.params.id), Number(req.params.productoId));
        res.json({ success: true, message: 'Producto desasociado correctamente' });
    }),
};
//# sourceMappingURL=proveedor.controller.js.map