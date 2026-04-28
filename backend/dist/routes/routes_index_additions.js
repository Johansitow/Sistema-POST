"use strict";
/**
 * ADICIONES AL routes/index.ts existente
 *
 * Agrega estas líneas a tu archivo de rutas principal.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ── Imports nuevos ────────────────────────────────────────────────────────────
const configuracion_routes_1 = __importDefault(require("./configuracion.routes"));
const cierre_caja_routes_1 = __importDefault(require("./cierre-caja.routes"));
const receta_routes_1 = __importDefault(require("./receta.routes"));
// ── Registro de rutas nuevas ──────────────────────────────────────────────────
// (agregar junto a las rutas existentes)
router.use('/configuracion', configuracion_routes_1.default);
router.use('/caja', cierre_caja_routes_1.default); // /api/caja/turnos y /api/caja/cierres
router.use('/recetas', receta_routes_1.default);
/**
 * RESUMEN DE ENDPOINTS NUEVOS:
 *
 * CONFIGURACIÓN:
 *   GET    /api/configuracion                          → listar config (auth)
 *   GET    /api/configuracion/:clave                   → leer clave (auth)
 *   PUT    /api/configuracion/:clave                   → editar clave (config.sistema)
 *   PATCH  /api/configuracion                          → editar varias (config.sistema)
 *   GET    /api/configuracion/permisos                 → listar permisos (config.sistema)
 *   GET    /api/configuracion/permisos/rol/:id         → permisos de un rol
 *   POST   /api/configuracion/permisos/rol/:id         → asignar permiso
 *   PUT    /api/configuracion/permisos/rol/:id/sync    → sincronizar permisos de rol
 *   DELETE /api/configuracion/permisos/rol/:id/:perm   → revocar permiso
 *
 * TURNOS Y CIERRES DE CAJA:
 *   GET    /api/caja/turnos                → listar turnos
 *   POST   /api/caja/turnos                → crear turno (config.sistema)
 *   PUT    /api/caja/turnos/:id            → editar turno (config.sistema)
 *   DELETE /api/caja/turnos/:id            → eliminar turno (config.sistema)
 *   GET    /api/caja/cierres               → listar cierres paginados
 *   GET    /api/caja/cierres/:id           → detalle de cierre
 *   POST   /api/caja/cierres/iniciar       → iniciar cierre (verifica órdenes abiertas)
 *   POST   /api/caja/cierres/:id/confirmar → cajero confirma montos físicos
 *
 * RECETAS:
 *   GET    /api/recetas                          → listar con análisis de rentabilidad
 *   GET    /api/recetas/:id                      → detalle con rentabilidad
 *   GET    /api/recetas/producto/:id             → receta de un producto específico
 *   GET    /api/recetas/:id/rentabilidad          → solo el análisis de rentabilidad
 *   POST   /api/recetas                          → crear receta
 *   PUT    /api/recetas/:id                      → editar datos generales
 *   PUT    /api/recetas/:id/ingredientes         → reemplazar ingredientes
 *   POST   /api/recetas/verificar-stock/:id_orden → check antes de marcar ENTREGADA
 */
//# sourceMappingURL=routes_index_additions.js.map