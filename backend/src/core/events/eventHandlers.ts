/**
 * eventHandlers.ts — Suscripciones a eventos del dominio
 *
 * Registra los listeners del EventBus una sola vez al arrancar el servidor.
 * Cada handler reacciona a eventos de negocio emitidos desde servicios y jobs,
 * desacoplando el emisor (alerta.service, orden.service) del efecto (WebSocket, log).
 *
 * Llamar registerEventHandlers() desde server.ts DESPUÉS de socketGateway.init().
 *
 * Eventos manejados:
 *   'inventario.stock_bajo'  → { productoId, nombre, stockActual, stockMinimo }
 *   'inventario.stock_agotado' → { productoId, nombre }
 *   'lote.vencido'           → { loteId, productoId, nombreProducto, fechaVencimiento }
 *   'orden.creada'           → { ordenId, numeroOrden, usuarioId }
 *   'orden.cancelada'        → { ordenId, numeroOrden }
 */

import { eventBus } from './EventBus';
import { socketGateway } from '../../config/socket.gateway';
import logger from '../../config/logger';

// ── Tipos de payload por evento ───────────────────────────────────────────────

interface StockBajoPayload {
  productoId:  number;
  nombre:      string;
  stockActual: number;
  stockMinimo: number;
}

interface StockAgotadoPayload {
  productoId: number;
  nombre:     string;
}

interface LoteVencidoPayload {
  loteId:           number;
  productoId:       number;
  nombreProducto:   string;
  fechaVencimiento: Date;
}

interface OrdenCreadaPayload {
  ordenId:     number;
  numeroOrden: string;
  usuarioId:   number;
}

interface OrdenCanceladaPayload {
  ordenId:     number;
  numeroOrden: string;
}

// ── Registro de handlers ──────────────────────────────────────────────────────

export function registerEventHandlers(): void {

  // ── inventario.stock_bajo ────────────────────────────────────────────────
  eventBus.on<StockBajoPayload>('inventario.stock_bajo', ({ productoId, nombre, stockActual, stockMinimo }) => {
    logger.warn(`[Event] stock_bajo: "${nombre}" (id=${productoId}) stock=${stockActual}/${stockMinimo}`);
    socketGateway.emitStockBajo({ id_producto: productoId, nombre, stock_actual: stockActual, stock_minimo: stockMinimo });
  });

  // ── inventario.stock_agotado ─────────────────────────────────────────────
  eventBus.on<StockAgotadoPayload>('inventario.stock_agotado', ({ productoId, nombre }) => {
    logger.warn(`[Event] stock_agotado: "${nombre}" (id=${productoId})`);
    socketGateway.emitStockBajo({ id_producto: productoId, nombre, stock_actual: 0, stock_minimo: 0 });
  });

  // ── lote.vencido ─────────────────────────────────────────────────────────
  eventBus.on<LoteVencidoPayload>('lote.vencido', ({ loteId, productoId, nombreProducto, fechaVencimiento }) => {
    logger.warn(
      `[Event] lote.vencido: lote=${loteId} producto="${nombreProducto}" (id=${productoId}) vence=${fechaVencimiento.toISOString().slice(0, 10)}`
    );
    // Emitir a la room admin vía socket (reutiliza el canal de STOCK_BAJO por ahora)
    socketGateway.emitStockBajo({
      id_producto:  productoId,
      nombre:       `${nombreProducto} (lote próximo a vencer)`,
      stock_actual: -1, // señal para distinguir este subtipo en el frontend
      stock_minimo: 0,
    });
  });

  // ── orden.creada ─────────────────────────────────────────────────────────
  // El controller ya emite NUEVA_ORDEN vía socket directamente.
  // El EventBus permite que otros módulos (analytics, notificaciones push futuras)
  // reaccionen sin acoplar nada al controller de órdenes.
  eventBus.on<OrdenCreadaPayload>('orden.creada', ({ ordenId, numeroOrden, usuarioId }) => {
    logger.info(`[Event] orden.creada: id=${ordenId} numero=${numeroOrden} usuario=${usuarioId}`);
  });

  // ── orden.cancelada ──────────────────────────────────────────────────────
  eventBus.on<OrdenCanceladaPayload>('orden.cancelada', ({ ordenId, numeroOrden }) => {
    logger.info(`[Event] orden.cancelada: id=${ordenId} numero=${numeroOrden}`);
  });

  logger.info('[EventBus] Handlers registrados: stock_bajo, stock_agotado, lote.vencido, orden.creada, orden.cancelada');
}
