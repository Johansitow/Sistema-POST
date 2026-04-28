"use strict";
/**
 * index.ts - Registro central de todas las rutas
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = setupRoutes;
const auth_routes_1 = __importDefault(require("./auth.routes"));
const usuarios_routes_1 = __importDefault(require("./usuarios.routes"));
const productos_routes_1 = __importDefault(require("./productos.routes"));
const categorias_routes_1 = __importDefault(require("./categorias.routes"));
const ordenes_routes_1 = __importDefault(require("./ordenes.routes"));
const dashboard_routes_1 = __importDefault(require("./dashboard.routes"));
const inventario_routes_1 = __importDefault(require("./inventario.routes"));
const reportes_routes_1 = __importDefault(require("./reportes.routes"));
const API = '/api';
function setupRoutes(app) {
    app.use(`${API}/auth`, auth_routes_1.default);
    app.use(`${API}/usuarios`, usuarios_routes_1.default);
    app.use(`${API}/productos`, productos_routes_1.default);
    app.use(`${API}/categorias`, categorias_routes_1.default);
    app.use(`${API}/ordenes`, ordenes_routes_1.default);
    app.use(`${API}/dashboard`, dashboard_routes_1.default);
    app.use(`${API}/inventario`, inventario_routes_1.default);
    app.use(`${API}/reportes`, reportes_routes_1.default);
}
//# sourceMappingURL=index.js.map