/**
 * socket.handler.ts
 * Puente entre el EventBus de dominio y el SocketGateway de WebSocket.
 *
 * Los eventos de dominio son internos (no conocen Socket.IO).
 * Este handler es el único punto de contacto entre ambos mundos,
 * siguiendo el principio de inversión de dependencias.
 */

import { socketGateway } from '../../config/socket.gateway';
import { eventBus } from '../eventBus';
import {
  EVENTS,
  OrdenCreadaPayload,
  OrdenEstadoCambiadoPayload,
  OrdenCanceladaPayload,
  OrdenEntregadaPayload,
  SedeEnPreparacionPayload,
  SedeListaPayload,
  StockBajoPayload,
  StockAgotadoPayload,
  LoteVencidoPayload,
  CierreCompletadoPayload,
  FeatureFlagCambiadoPayload,
} from '../events';

export function registerSocketHandlers(): void {

  eventBus.on<OrdenCreadaPayload>(EVENTS.ORDEN_CREADA, (payload) => {
    socketGateway.emitNuevaOrden({
      id:          payload.idOrden,
      numero_orden: payload.numeroOrden,
      tipo_orden:  payload.tipoOrden,
      total:       payload.total,
    });
  });

  eventBus.on<OrdenEstadoCambiadoPayload>(EVENTS.ORDEN_ESTADO_CAMBIADO, (payload) => {
    socketGateway.emitEstadoOrden({
      id:           payload.idOrden,
      numero_orden: payload.numeroOrden,
      id_estado:    payload.idEstado,
      estado:       payload.nombreEstado,
    });
  });

  eventBus.on<OrdenCanceladaPayload>(EVENTS.ORDEN_CANCELADA, (payload) => {
    socketGateway.emitOrdenCancelada(payload.idOrden);
  });

  // La orden global pasó a ENTREGADA (pago registrado). Los estados de la
  // nueva arquitectura no viven en la tabla estados_orden, por eso id_estado: 0
  // (los clientes usan ESTADO_ORDEN solo como trigger de refetch).
  eventBus.on<OrdenEntregadaPayload>(EVENTS.ORDEN_ENTREGADA, (payload) => {
    socketGateway.emitEstadoOrden({
      id:           payload.idOrden,
      numero_orden: payload.numeroOrden,
      id_estado:    0,
      estado:       'ENTREGADA',
    });
  });

  // Transiciones de sede (PENDIENTE → EN_PREPARACION → LISTA): sin este puente,
  // las demás pantallas de cocina/caja no se enteran del avance.
  eventBus.on<SedeEnPreparacionPayload>(EVENTS.SEDE_EN_PREPARACION, (payload) => {
    socketGateway.emitEstadoOrden({ id: payload.idOrden, id_estado: 0, estado: 'SEDE_EN_PREPARACION' });
  });

  eventBus.on<SedeListaPayload>(EVENTS.SEDE_LISTA, (payload) => {
    socketGateway.emitEstadoOrden({ id: payload.idOrden, id_estado: 0, estado: 'SEDE_LISTA' });
  });

  eventBus.on<StockBajoPayload>(EVENTS.STOCK_BAJO, (payload) => {
    socketGateway.emitStockBajo({
      id_producto:  payload.idProducto,
      nombre:       payload.nombreProducto,
      stock_actual: payload.stockActual,
      stock_minimo: payload.stockMinimo,
    });
  });

  eventBus.on<StockAgotadoPayload>(EVENTS.STOCK_AGOTADO, (payload) => {
    socketGateway.emitStockBajo({
      id_producto:  payload.idProducto,
      nombre:       payload.nombre,
      stock_actual: 0,
      stock_minimo: 0,
    });
  });

  eventBus.on<LoteVencidoPayload>(EVENTS.LOTE_VENCIDO, (payload) => {
    socketGateway.emitStockBajo({
      id_producto:  payload.idProducto,
      nombre:       `${payload.nombreProducto} (lote próximo a vencer)`,
      stock_actual: -1,
      stock_minimo: 0,
    });
  });

  eventBus.on<CierreCompletadoPayload>(EVENTS.CIERRE_COMPLETADO, (payload) => {
    socketGateway.emitCierreCompletado({
      id_cierre:      payload.idCierre,
      id_restaurante: payload.idRestaurante,
      numero_cierre:  payload.numeroCierre,
      estado:         payload.estado,
    });
  });

  eventBus.on<FeatureFlagCambiadoPayload>(EVENTS.FEATURE_FLAG_CAMBIADO, (payload) => {
    socketGateway.emitFeatureFlagChanged({
      nombre:     payload.nombre,
      habilitado: payload.habilitado,
      accion:     payload.accion,
    });
  });
}
