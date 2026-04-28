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
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=proveedores.routes.d.ts.map