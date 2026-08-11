/**
 * Servidor Principal
 * Configuración y arranque del servidor Express
 */

// BigInt no es serializable por JSON.stringify por defecto.
// Prisma usa BigInt para PKs de tablas de audit/log.
// Este patch hace que BigInt se serialice como string.
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middlewares/error.middleware';
import { requestLogger } from './middlewares/logger.middleware';
import { attachAuditContext } from './middlewares/audit.middleware';
import { setupRoutes } from './routes';
import { swaggerSpec } from './config/swagger';
import { socketGateway } from './config/socket.gateway';
import { registerHandlers } from './application/registerHandlers';
import { registerAllSagas } from './application/sagas';
import { pluginLoader }          from './plugins/PluginLoader';
import { usuariosPlugin }        from './plugins/core/usuarios.plugin';
import { restaurantesPlugin }    from './plugins/core/restaurantes.plugin';
import { categoriasPlugin }      from './plugins/core/categorias.plugin';
import { startInventarioJob } from './jobs/inventario.job';
import { startSuscripcionesJob } from './jobs/suscripciones.job';
import { startFacturacionJob } from './jobs/facturacion.job';
import logger from './config/logger';
import { config } from './config/env';
import prisma from './config/database';
import redis from './config/redis';

// Cargar variables de entorno
dotenv.config();

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// Detrás de un reverse proxy (Caddy/Nginx). Necesario para que req.ip, el
// rate-limit por IP y la auditoría usen la IP real (X-Forwarded-For) y para que
// req.secure refleje el HTTPS terminado en el proxy.
app.set('trust proxy', 1);

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Limiter general: 500 req / 15 min — cubre polling de dashboard, alertas, etc.
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Demasiadas peticiones. Por favor espera un momento.' },
});

// Limiter estricto solo para autenticación: 20 intentos / 15 min (anti brute-force)
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Demasiados intentos de autenticación. Intenta más tarde.' },
});

// ─── CORS: soporta múltiples orígenes separados por coma ─────────────────────
// Ejemplo en .env: CORS_ORIGIN=http://localhost:5173,http://localhost:5174
const rawOrigins = process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174';
const allowedOrigins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

// Middleware de seguridad y utilidades
app.use(helmet()); // Seguridad HTTP headers
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    // En desarrollo, aceptar cualquier localhost (cubre puertos 5173, 5174, etc.)
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Rechazar sin lanzar error (el browser mostrará CORS bloqueado)
    callback(null, false);
  },
  credentials: true,
}));
app.use(compression()); // Compresión gzip
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check — antes del rate limiter para que los chequeos del balanceador
// no queden limitados. Verifica DB (crítica) y Redis (opcional, fail-open).
app.get('/health', async (_req, res) => {
  let db: 'up' | 'down' = 'down';
  let cache: 'up' | 'down' = 'down';
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = 'up';
  } catch {
    db = 'down';
  }
  try {
    if (redis.status === 'ready') {
      await redis.ping();
      cache = 'up';
    }
  } catch {
    cache = 'down';
  }
  const ok = db === 'up'; // la DB es crítica; Redis no bloquea el health
  res.status(ok ? 200 : 503).json({
    status: ok ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    db,
    redis: cache,
  });
});

app.use(limiter); // Rate limiting
app.use(requestLogger); // Logger de peticiones
app.use(attachAuditContext); // Adjuntar IP y User-Agent al request

// Documentación Swagger (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'POS Cocina Oculta — API Docs',
  }));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));
  logger.info('📖 Docs disponibles en: http://localhost:3000/api/docs');
}

// Auth routes: limiter estricto (anti brute-force sobre login)
app.use('/api/v1/auth', authLimiter);
app.use('/api/auth',    authLimiter);

// Configurar rutas
setupRoutes(app);

// Middleware de manejo de errores (debe ir al final)
app.use(errorHandler);

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl,
  });
});

// Crear servidor HTTP explícito para que Socket.IO pueda adjuntarse
const server = http.createServer(app);

// Iniciar WebSocket gateway
socketGateway.init(server);

// Registrar handlers del CommandBus, QueryBus y EventBus de dominio (CQRS + eventos)
registerHandlers();

// Registrar sagas de dominio (orquestación multi-aggregate)
registerAllSagas();

// Registrar core plugins (siempre activos o gateados por feature flags)
pluginLoader
  .add(usuariosPlugin)
  .add(restaurantesPlugin)
  .add(categoriasPlugin);

// Cargar plugins (después de registerHandlers para que los buses estén listos)
pluginLoader.loadAll(app).catch((err) =>
  logger.error('[PluginLoader] Error en loadAll:', err)
);

// Iniciar jobs periódicos
startInventarioJob();
startSuscripcionesJob();
startFacturacionJob();

// Iniciar servidor
server.listen(PORT, () => {
  logger.info(`🚀 Servidor iniciado en puerto ${PORT}`);
  logger.info(`📡 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 URL: http://localhost:${PORT}`);
  logger.info(`🔌 WebSocket: ws://localhost:${PORT}`);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  server.close(() => process.exit(1));
});

// Graceful shutdown: cierra el servidor HTTP y las conexiones a DB/Redis.
// Docker envía SIGTERM al detener el contenedor; SIGINT cubre Ctrl+C en local.
const shutdown = (signal: string) => {
  logger.info(`${signal} recibido, cerrando servidor...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      redis.disconnect();
    } catch (err) {
      logger.error('Error cerrando conexiones:', err);
    }
    logger.info('Servidor cerrado');
    process.exit(0);
  });
  // Si no cierra en 10s, forzar salida para no colgar el orquestador.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
