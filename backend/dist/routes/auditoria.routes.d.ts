/**
 * Auditoría Routes
 *
 * GET /api/auditoria → historial completo con filtros
 *
 * Protegido por requireRole('auditoria.ver'):
 * Solo el superadmin tiene este permiso por defecto.
 * El superadmin puede delegarlo a otros usuarios desde el frontend.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=auditoria.routes.d.ts.map