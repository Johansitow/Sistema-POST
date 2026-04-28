/**
 * Redis client — singleton ioredis con manejo graceful de desconexión
 *
 * Si Redis no está disponible (ej. entorno sin Redis) las operaciones
 * de caché fallan silenciosamente y el sistema sigue funcionando.
 *
 * Variables de entorno:
 *   REDIS_URL  → redis://localhost:6379  (por defecto)
 *
 * TTLs estándar:
 *   CACHE_TTL.SHORT  → 60s   (datos que cambian frecuentemente: stock)
 *   CACHE_TTL.MID    → 5min  (catálogo de productos, categorías)
 *   CACHE_TTL.LONG   → 1h    (config del sistema, roles/permisos)
 */

import Redis from 'ioredis';
import logger from './logger';

export const CACHE_TTL = {
  SHORT:  60,          // 1 minuto
  MID:    300,         // 5 minutos
  LONG:   3600,        // 1 hora
} as const;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Crear cliente con reintentos limitados para no bloquear el arranque
const redis = new Redis(REDIS_URL, {
  lazyConnect:        true,
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => {
    if (times > 3) return null; // deja de reintentar
    return Math.min(times * 200, 1000);
  },
  enableOfflineQueue: false,
});

redis.on('connect',   () => logger.info('🟢 Redis conectado'));
redis.on('error',     (err) => logger.warn(`⚠️  Redis error: ${err.message}`));
redis.on('close',     () => logger.warn('🔴 Redis desconectado'));

// Intentar conectar en background — no bloquea el arranque de Express
redis.connect().catch((err) => {
  logger.warn(`⚠️  Redis no disponible: ${err.message}. El sistema funciona sin caché.`);
});

export default redis;

// ── Helpers tipados ──────────────────────────────────────────────────────────

/** Lee un valor del caché. Devuelve null si no existe o Redis no disponible. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Guarda un valor en caché con TTL en segundos. Falla silenciosamente. */
export async function cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    // silencioso — el flujo principal no debe depender de Redis
  }
}

/** Invalida una o más claves exactas. Falla silenciosamente. */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    // silencioso
  }
}

/**
 * cacheDelPattern — invalida todas las claves que coincidan con un patrón glob.
 *
 * Usa SCAN iterativo (no KEYS) para no bloquear Redis en producción.
 * Ejemplo: cacheDelPattern('dashboard:stats:*') elimina todas las variantes.
 *
 * Falla silenciosamente si Redis no está disponible.
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    // silencioso — la caché se invalidará por TTL si Redis no responde
  }
}

/**
 * cacheGetOrSet — patrón read-through
 *
 * Si la clave existe en Redis, devuelve el valor cacheado.
 * Si no existe, ejecuta `fn`, guarda el resultado y lo devuelve.
 *
 * Uso:
 *   const categorias = await cacheGetOrSet(
 *     'cat:all',
 *     CACHE_TTL.LONG,
 *     () => categoriaRepository.findAll()
 *   );
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const fresh = await fn();
  await cacheSet(key, fresh, ttl);
  return fresh;
}
