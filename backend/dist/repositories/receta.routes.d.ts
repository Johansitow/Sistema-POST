/**
 * Rutas de Recetas
 *
 * GET    /api/recetas                       → listar con rentabilidad
 * GET    /api/recetas/:id                   → detalle con rentabilidad
 * GET    /api/recetas/producto/:id_producto → receta de un producto
 * POST   /api/recetas                       → crear receta
 * PUT    /api/recetas/:id                   → editar receta (datos generales)
 * PUT    /api/recetas/:id/ingredientes      → reemplazar ingredientes
 * GET    /api/recetas/:id/rentabilidad      → solo análisis de rentabilidad
 * POST   /api/recetas/verificar-stock/:id_orden → check antes de entregar
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=receta.routes.d.ts.map