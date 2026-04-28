/**
 * Rutas de Turnos y Cierres de Caja
 *
 * TURNOS (solo superadmin):
 * GET    /api/caja/turnos            → listar turnos
 * GET    /api/caja/turnos/:id        → detalle de turno
 * POST   /api/caja/turnos            → crear turno
 * PUT    /api/caja/turnos/:id        → editar turno
 * DELETE /api/caja/turnos/:id        → eliminar turno
 *
 * CIERRES:
 * GET    /api/caja/cierres           → listar cierres paginados
 * GET    /api/caja/cierres/:id       → detalle de cierre
 * POST   /api/caja/cierres/iniciar   → iniciar cierre (verifica órdenes abiertas)
 * POST   /api/caja/cierres/:id/confirmar → cajero confirma montos físicos
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=cierre-caja.routes.d.ts.map