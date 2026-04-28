/**
 * registerHandlers — Registra todos los handlers del CommandBus y QueryBus
 *
 * Llamar desde server.ts una sola vez al arrancar.
 *
 * Para agregar un nuevo Command/Query:
 *   1. Crear la clase en commands/ o queries/
 *   2. Crear el handler en el módulo correspondiente
 *   3. Agregar el registro aquí
 */

import { commandBus } from './commands/CommandBus';
import { queryBus }   from './queries/QueryBus';
import { CACHE_TTL }  from '../config/redis';
import logger         from '../config/logger';
import { registerAllHandlers as registerEventHandlers } from '../events/registerHandlers';

// ── Commands ──────────────────────────────────────────────────────────────────

// Órdenes
import { CreateOrdenCommand } from './commands/orden/CreateOrdenCommand';
import { CancelOrdenCommand } from './commands/orden/CancelOrdenCommand';
import { createOrdenHandler, cancelOrdenHandler } from './commands/orden/ordenCommandHandlers';

// Inventario
import { RegistrarMovimientoCommand } from './commands/inventario/RegistrarMovimientoCommand';
import { registrarMovimientoHandler } from './commands/inventario/RegistrarMovimientoHandler';

// Productos
import { CreateProductoCommand } from './commands/producto/CreateProductoCommand';
import { UpdateProductoCommand } from './commands/producto/UpdateProductoCommand';
import { createProductoHandler, updateProductoHandler } from './commands/producto/productoCommandHandlers';

// ── Queries ───────────────────────────────────────────────────────────────────

// Dashboard
import { GetDashboardStatsQuery }    from './queries/dashboard/GetDashboardStatsQuery';
import { getDashboardStatsHandler }  from './queries/dashboard/dashboardQueryHandlers';

// Órdenes
import { GetOrdenesQuery }    from './queries/orden/GetOrdenesQuery';
import { getOrdenesHandler }  from './queries/orden/ordenQueryHandlers';

// Inventario
import { GetMovimientosQuery }    from './queries/inventario/GetMovimientosQuery';
import { getMovimientosHandler }  from './queries/inventario/inventarioQueryHandlers';

// Productos
import { GetProductosQuery }    from './queries/producto/GetProductosQuery';
import { getProductosHandler }  from './queries/producto/productoQueryHandlers';

// Reportes
import { GetReporteVentasQuery }    from './queries/reportes/GetReporteVentasQuery';
import { GetReporteCompletoQuery }  from './queries/reportes/GetReporteCompletoQuery';
import { GetResumenVentasQuery }    from './queries/reportes/GetResumenVentasQuery';
import {
  getReporteVentasHandler,
  getReporteCompletoHandler,
  getResumenVentasHandler,
} from './queries/reportes/reportesQueryHandlers';

// ── Middleware: logging automático de comandos ─────────────────────────────────
//
// Registra en el log: nombre del comando, duración, éxito o error.
// Esto provee auditoría de escrituras sin tocar cada controller.

commandBus.use(async (command, next) => {
  const start = Date.now();
  try {
    const result = await next();
    logger.info(`[CMD] ${command.commandName} — OK (${Date.now() - start}ms)`);
    return result;
  } catch (err) {
    logger.error(`[CMD] ${command.commandName} — ERROR (${Date.now() - start}ms):`, err);
    throw err;
  }
});

// ── Middleware: logging de queries (solo en desarrollo) ───────────────────────

if (process.env.NODE_ENV !== 'production') {
  queryBus.use(async (query, next) => {
    const start = Date.now();
    const result = await next();
    logger.debug(`[QRY] ${query.queryName} — ${Date.now() - start}ms`);
    return result;
  });
}

export function registerHandlers(): void {

  // ── Commands ────────────────────────────────────────────────────────────────
  commandBus.register(CreateOrdenCommand,         createOrdenHandler);
  commandBus.register(CancelOrdenCommand,         cancelOrdenHandler);
  commandBus.register(RegistrarMovimientoCommand, (c) => registrarMovimientoHandler.execute(c));
  commandBus.register(CreateProductoCommand,      createProductoHandler);
  commandBus.register(UpdateProductoCommand,      updateProductoHandler);

  // ── Queries ─────────────────────────────────────────────────────────────────
  // Dashboard stats — caché 5 min por restaurante
  queryBus.register(GetDashboardStatsQuery, getDashboardStatsHandler, {
    ttl:   CACHE_TTL.MID,
    keyFn: (q) => `dashboard:stats:${q.restauranteId ?? 'all'}`,
  });

  // Resumen de ventas — caché 5 min por (dias, restaurante)
  queryBus.register(GetResumenVentasQuery, getResumenVentasHandler, {
    ttl:   CACHE_TTL.MID,
    keyFn: (q) => `dashboard:resumen:${q.dias}:${q.restauranteId ?? 'all'}`,
  });

  // Reporte completo — caché 10 min (query más pesada del sistema)
  queryBus.register(GetReporteCompletoQuery, getReporteCompletoHandler, {
    ttl:   600,
    keyFn: (q) => {
      const desde = q.filters.fecha_desde?.toISOString().slice(0, 10) ?? '';
      const hasta = q.filters.fecha_hasta?.toISOString().slice(0, 10) ?? '';
      return `reporte:completo:${desde}:${hasta}:${q.filters.restauranteId ?? 'all'}`;
    },
  });

  // Reporte ventas — caché 5 min
  queryBus.register(GetReporteVentasQuery, getReporteVentasHandler, {
    ttl:   CACHE_TTL.MID,
    keyFn: (q) => {
      const desde = q.filters.fecha_desde?.toISOString().slice(0, 10) ?? '';
      const hasta = q.filters.fecha_hasta?.toISOString().slice(0, 10) ?? '';
      return `reporte:ventas:${desde}:${hasta}:${q.filters.tipo_orden ?? 'all'}`;
    },
  });

  // Ordenes y movimientos — sin caché (datos en tiempo real)
  queryBus.register(GetOrdenesQuery,     getOrdenesHandler);
  queryBus.register(GetMovimientosQuery, getMovimientosHandler);
  queryBus.register(GetProductosQuery,   getProductosHandler);

  logger.info(`[CQRS] ${commandBus.registeredCommands().length} commands: ${commandBus.registeredCommands().join(', ')}`);
  logger.info(`[CQRS] ${queryBus.registeredQueries().length} queries:  ${queryBus.registeredQueries().join(', ')}`);

  // ── Domain Event Handlers (EventBus) ────────────────────────────────────────
  // Socket primero (UX crítica), luego side-effects de inventario y cliente
  registerEventHandlers();
}
