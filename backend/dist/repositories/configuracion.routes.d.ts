/**
 * Rutas de Configuración y Permisos
 *
 * GET    /api/configuracion              → listar todas (auth)
 * GET    /api/configuracion/:clave       → leer una clave (auth)
 * PUT    /api/configuracion/:clave       → editar una clave (superadmin)
 * PATCH  /api/configuracion              → editar varias claves (superadmin)
 *
 * GET    /api/configuracion/permisos           → listar todos los permisos (superadmin)
 * GET    /api/configuracion/permisos/rol/:id   → permisos de un rol (superadmin)
 * POST   /api/configuracion/permisos/rol/:id   → asignar permiso a rol (superadmin)
 * DELETE /api/configuracion/permisos/rol/:id/:permiso → revocar permiso (superadmin)
 * PUT    /api/configuracion/permisos/rol/:id/sync → reemplazar todos los permisos (superadmin)
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=configuracion.routes.d.ts.map