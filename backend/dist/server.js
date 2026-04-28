"use strict";
/**
 * Servidor Principal
 * Configuración y arranque del servidor Express
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const error_middleware_1 = require("./middlewares/error.middleware");
const logger_middleware_1 = require("./middlewares/logger.middleware");
const routes_1 = require("./routes");
const logger_1 = __importDefault(require("./config/logger"));
// Cargar variables de entorno
dotenv_1.default.config();
// Crear aplicación Express
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Configuración de rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // límite de 100 peticiones por ventana
    message: 'Demasiadas peticiones desde esta IP, por favor intenta más tarde.',
});
// Middleware de seguridad y utilidades
app.use((0, helmet_1.default)()); // Seguridad HTTP headers
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));
app.use((0, compression_1.default)()); // Compresión gzip
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter); // Rate limiting
app.use(logger_middleware_1.requestLogger); // Logger de peticiones
// Health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
// Configurar rutas
(0, routes_1.setupRoutes)(app);
// Middleware de manejo de errores (debe ir al final)
app.use(error_middleware_1.errorHandler);
// Manejo de rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        path: req.originalUrl,
    });
});
// Iniciar servidor
const server = app.listen(PORT, () => {
    logger_1.default.info(`🚀 Servidor iniciado en puerto ${PORT}`);
    logger_1.default.info(`📡 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    logger_1.default.info(`🔗 URL: http://localhost:${PORT}`);
});
// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error('Unhandled Rejection at:', promise, 'reason:', reason);
    server.close(() => process.exit(1));
});
process.on('uncaughtException', (error) => {
    logger_1.default.error('Uncaught Exception:', error);
    server.close(() => process.exit(1));
});
// Graceful shutdown
process.on('SIGTERM', () => {
    logger_1.default.info('SIGTERM recibido, cerrando servidor...');
    server.close(() => {
        logger_1.default.info('Servidor cerrado');
        process.exit(0);
    });
});
exports.default = app;
//# sourceMappingURL=server.js.map