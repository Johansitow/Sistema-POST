/**
 * cache.handler.ts — invalida caches de QueryBus al ocurrir eventos de dominio.
 *
 * El QueryBus almacena resultados en Redis con TTL fijo. Sin invalidación
 * activa, un dashboard puede mostrar datos de hasta 5 minutos atrás después
 * de crear una orden o cerrar la caja. Este handler cierra ese gap.
 *
 * Mapa de invalidación:
 *
 *   ORDEN_CREADA        → dashboard:stats:{restauranteId}, dashboard:stats:all
 *   ORDEN_COMPLETADA    → dashboard:stats:{restauranteId}, dashboard:stats:all
 *                          reporte:ventas:*, reporte:completo:*
 *   CIERRE_COMPLETADO   → dashboard:resumen:*:{restauranteId},
 *                          dashboard:resumen:*:all
 *                          reporte:ventas:*, reporte:completo:*
 *   MOVIMIENTO_REGISTRADO → dashboard:stats:{restauranteId}, dashboard:stats:all
 *
 * Principio de diseño: invalidación conservadora — si hay duda, borrar.
 * El overhead de una consulta extra a DB es menor que mostrar datos incorrectos.
 */

import { eventBus }         from '../eventBus';
import { cacheDel, cacheDelPattern } from '../../config/redis';
import {
  EVENTS,
  OrdenCreadaPayload,
  OrdenCompletadaPayload,
  CierreCompletadoPayload,
  MovimientoRegistradoPayload,
} from '../events';

/** Claves exactas del dashboard para un restaurante y para la vista global */
function dashboardStatKeys(idRestaurante: number): string[] {
  return [
    `dashboard:stats:${idRestaurante}`,
    `dashboard:stats:all`,
  ];
}

export function registerCacheHandlers(): void {

  // ── ORDEN_CREADA: actualiza contadores del dashboard ─────────────────────────
  eventBus.on<OrdenCreadaPayload>(
    EVENTS.ORDEN_CREADA,
    async ({ idRestaurante }) => {
      await cacheDel(...dashboardStatKeys(idRestaurante));
    },
  );

  // ── ORDEN_COMPLETADA: actualiza stats + invalida reportes de ventas ───────────
  eventBus.on<OrdenCompletadaPayload>(
    EVENTS.ORDEN_COMPLETADA,
    async ({ idRestaurante }) => {
      await Promise.all([
        cacheDel(...dashboardStatKeys(idRestaurante)),
        // Los reportes de ventas agrupan por periodo — borrar todas las variantes
        cacheDelPattern('reporte:ventas:*'),
        cacheDelPattern('reporte:completo:*'),
      ]);
    },
  );

  // ── CIERRE_COMPLETADO: invalida resumen de ventas + reportes ──────────────────
  eventBus.on<CierreCompletadoPayload>(
    EVENTS.CIERRE_COMPLETADO,
    async ({ idRestaurante }) => {
      await Promise.all([
        // Resumen tiene {dias}:{restauranteId} en la clave → necesitamos pattern
        cacheDelPattern(`dashboard:resumen:*:${idRestaurante}`),
        cacheDelPattern(`dashboard:resumen:*:all`),
        cacheDelPattern('reporte:ventas:*'),
        cacheDelPattern('reporte:completo:*'),
      ]);
    },
  );

  // ── MOVIMIENTO_REGISTRADO: puede cambiar alertas de stock en el dashboard ─────
  eventBus.on<MovimientoRegistradoPayload>(
    EVENTS.MOVIMIENTO_REGISTRADO,
    async ({ idRestaurante }) => {
      if (!idRestaurante) return;
      await cacheDel(...dashboardStatKeys(idRestaurante));
    },
  );
}
