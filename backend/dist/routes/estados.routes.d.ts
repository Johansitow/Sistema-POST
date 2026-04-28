/**
 * Estados de Orden Routes
 *
 * GET  /api/estados-orden                          → listar todos
 * GET  /api/estados-orden/:id                      → detalle con transiciones
 * PUT  /api/estados-orden/:id                      → editar visual (superadmin)
 * GET  /api/estados-orden/:id/transiciones         → transiciones desde ese estado
 * POST /api/estados-orden/:id/transiciones         → agregar transición
 * DELETE /api/estados-orden/:id/transiciones/:transicionId → eliminar transición
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=estados.routes.d.ts.map