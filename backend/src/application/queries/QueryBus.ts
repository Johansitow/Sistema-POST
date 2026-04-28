/**
 * QueryBus — Bus de consultas (CQRS read side)
 *
 * Separación de responsabilidades: las queries son de solo lectura.
 * Los handlers de query pueden usar caché, proyecciones optimizadas,
 * o read-replicas sin afectar el lado de escritura.
 *
 * Caché por query (Redis):
 *   queryBus.register(GetProductosQuery, getProductosHandler, {
 *     ttl: CACHE_TTL.MID,
 *     keyFn: (q) => `productos:list:${JSON.stringify(q.filters)}`,
 *   });
 *
 * Middleware global:
 *   queryBus.use(async (query, next) => {
 *     const t = Date.now();
 *     const result = await next();
 *     logger.debug(`[QRY] ${query.queryName} en ${Date.now() - t}ms`);
 *     return result;
 *   });
 */

import { cacheGetOrSet } from '../../config/redis';

// ── Base ──────────────────────────────────────────────────────────────────────

/** Interfaz base para todas las queries del sistema */
export interface IQuery {
  readonly queryName: string;
}

/** Handler que ejecuta una query y retorna datos (solo lectura) */
export type QueryHandler<Q extends IQuery, R> = (query: Q) => Promise<R>;

/** Constructor de una query — usado como clave de registro */
export type QueryConstructor<Q extends IQuery = IQuery> = new (...args: any[]) => Q;

/**
 * Opciones de caché para una query.
 * Si se configuran, el QueryBus wrappea automáticamente el handler
 * con Redis read-through usando cacheGetOrSet.
 */
export interface QueryCacheOptions<Q extends IQuery = IQuery> {
  /** TTL en segundos (usa CACHE_TTL.SHORT / MID / LONG) */
  ttl: number;
  /** Genera la clave de caché a partir de la query */
  keyFn: (query: Q) => string;
}

/**
 * Middleware del bus. Recibe la query y una función `next` que ejecuta
 * el siguiente middleware (o el handler final, posiblemente con caché).
 */
export type QueryMiddleware = (
  query: IQuery,
  next: () => Promise<unknown>,
) => Promise<unknown>;

// ── Bus ───────────────────────────────────────────────────────────────────────

class QueryBus {
  private readonly handlers    = new Map<string, QueryHandler<any, any>>();
  private readonly middlewares: QueryMiddleware[] = [];

  /**
   * Agrega un middleware global al pipeline (antes de cada query).
   */
  use(middleware: QueryMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Registra un handler para un tipo de query.
   * Si se pasa `cacheOptions`, el handler es envuelto con caché Redis.
   */
  register<Q extends IQuery, R>(
    QueryClass:   QueryConstructor<Q>,
    handler:      QueryHandler<Q, R>,
    cacheOptions?: QueryCacheOptions<Q>,
  ): void {
    const key = QueryClass.name;
    if (this.handlers.has(key)) {
      console.warn(`[QueryBus] Sobreescribiendo handler para: ${key}`);
    }

    if (cacheOptions) {
      const { ttl, keyFn } = cacheOptions;
      const cachedHandler: QueryHandler<Q, R> = (query) =>
        cacheGetOrSet(keyFn(query), ttl, () => handler(query)) as Promise<R>;
      this.handlers.set(key, cachedHandler);
    } else {
      this.handlers.set(key, handler);
    }
  }

  /**
   * Ejecuta una query con el handler registrado, pasando por el pipeline
   * de middlewares en orden.
   * Lanza si no hay handler registrado.
   */
  async execute<Q extends IQuery, R>(query: Q): Promise<R> {
    const key     = query.queryName;
    const handler = this.handlers.get(key);

    if (!handler) {
      throw new Error(`[QueryBus] No hay handler registrado para: "${key}"`);
    }

    // Componer pipeline: middlewares[] → handler (con caché si aplica)
    const pipeline = this.middlewares.reduceRight<() => Promise<unknown>>(
      (next, mw) => () => mw(query, next),
      () => handler(query),
    );

    return pipeline() as Promise<R>;
  }

  /** Lista las queries registradas */
  registeredQueries(): string[] {
    return [...this.handlers.keys()];
  }
}

export const queryBus = new QueryBus();
