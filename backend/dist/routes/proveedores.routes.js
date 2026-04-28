"use strict";
/**
 * Proveedores Routes
 *
 * GET    /api/proveedores                              → listar paginado
 * GET    /api/proveedores/:id                          → detalle con productos
 * POST   /api/proveedores                              → crear
 * PUT    /api/proveedores/:id                          → editar
 * PATCH  /api/proveedores/:id/estado                   → activar/desactivar
 * GET    /api/proveedores/:id/productos                → productos del proveedor
 * POST   /api/proveedores/:id/productos                → asociar producto
 * PUT    /api/proveedores/:id/productos/:productoId    → actualizar precio/condiciones
 * DELETE /api/proveedores/:id/productos/:productoId    → desasociar
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const proveedor_controller_1 = require("../controller/proveedor.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', proveedor_controller_1.proveedorController.getAll);
router.get('/:id', proveedor_controller_1.proveedorController.getById);
router.post('/', proveedor_controller_1.proveedorController.create);
router.put('/:id', proveedor_controller_1.proveedorController.update);
router.patch('/:id/estado', proveedor_controller_1.proveedorController.cambiarEstado);
// Productos del proveedor
router.get('/:id/productos', proveedor_controller_1.proveedorController.getProductos);
router.post('/:id/productos', proveedor_controller_1.proveedorController.asociarProducto);
router.put('/:id/productos/:productoId', proveedor_controller_1.proveedorController.actualizarRelacion);
router.delete('/:id/productos/:productoId', proveedor_controller_1.proveedorController.desasociarProducto);
exports.default = router;
//# sourceMappingURL=proveedores.routes.js.map