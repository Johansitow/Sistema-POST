"use strict";
/**
 * routes/index.ts — Registro central de todos los routers
 *
 * Agrega los nuevos módulos implementados:
 * - /api/estados-orden
 * - /api/facturas
 * - /api/proveedores
 * - /api/alertas
 * - /api/tipos-alerta
 * - /api/auditoria
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = void 0;
const auth_routes_1 = __importDefault(require("./auth.routes"));
const usuarios_routes_1 = __importDefault(require("./usuarios.routes"));
const productos_routes_1 = __importDefault(require("./productos.routes"));
const categorias_routes_1 = __importDefault(require("./categorias.routes"));
const ordenes_routes_1 = __importDefault(require("./ordenes.routes"));
const inventario_routes_1 = __importDefault(require("./inventario.routes"));
const dashboard_routes_1 = __importDefault(require("./dashboard.routes"));
const reportes_routes_1 = __importDefault(require("./reportes.routes"));
// Nuevos módulos
const estados_routes_1 = __importDefault(require("./estados.routes"));
const facturas_routes_1 = __importDefault(require("./facturas.routes"));
const proveedores_routes_1 = __importDefault(require("./proveedores.routes"));
const alertas_routes_1 = __importDefault(require("./alertas.routes"));
const tipos_alerta_routes_1 = __importDefault(require("./tipos-alerta.routes"));
const auditoria_routes_1 = __importDefault(require("./auditoria.routes"));
const configuracion_routes_1 = __importDefault(require("./configuracion.routes"));
const cierre_caja_routes_1 = __importDefault(require("./cierre-caja.routes"));
const receta_routes_1 = __importDefault(require("./receta.routes"));
const registerRoutes = (app) => {
    // Módulos existentes
    app.use('/api/auth', auth_routes_1.default);
    app.use('/api/usuarios', usuarios_routes_1.default);
    app.use('/api/productos', productos_routes_1.default);
    app.use('/api/categorias', categorias_routes_1.default);
    app.use('/api/ordenes', ordenes_routes_1.default);
    app.use('/api/inventario', inventario_routes_1.default);
    app.use('/api/dashboard', dashboard_routes_1.default);
    app.use('/api/reportes', reportes_routes_1.default);
    // Nuevos módulos
    app.use('/api/estados-orden', estados_routes_1.default);
    app.use('/api/facturas', facturas_routes_1.default);
    app.use('/api/proveedores', proveedores_routes_1.default);
    app.use('/api/alertas', alertas_routes_1.default);
    app.use('/api/tipos-alerta', tipos_alerta_routes_1.default);
    app.use('/api/auditoria', auditoria_routes_1.default);
    app.use('/configuracion', configuracion_routes_1.default);
    app.use('/caja', cierre_caja_routes_1.default); // /api/caja/turnos y /api/caja/cierres
    app.use('/recetas', receta_routes_1.default);
};
exports.registerRoutes = registerRoutes;
//# sourceMappingURL=index.routes.js.map