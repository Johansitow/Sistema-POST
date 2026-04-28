/**
 * EventBus — Bus de eventos de dominio
 *
 * Permite la comunicación desacoplada entre módulos.
 * Los plugins y módulos pueden suscribirse a eventos sin depender
 * directamente del módulo emisor.
 *
 * Uso:
 *   eventBus.on('orden.creada', ({ ordenId }) => { ... });
 *   eventBus.emit('orden.creada', { ordenId: 1 });
 *
 * Eventos del dominio disponibles:
 *   'orden.creada'          → { ordenId, usuarioId }
 *   'orden.cancelada'       → { ordenId, motivo }
 *   'inventario.stock_bajo' → { productoId, stockActual, stockMinimo }
 *   'lote.vencido'          → { loteId, productoId }
 */

import { EventEmitter } from 'events';
import logger from '../../config/logger';

type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

class EventBus extends EventEmitter {
  private static instance: EventBus;

  /**
   * Mapa de handler original → wrapper async.
   * Necesario para que off(event, originalHandler) pueda encontrar y remover
   * el wrapper que EventEmitter registró internamente.
   */
  private readonly wrapperMap = new WeakMap<
    EventHandler<any>,
    (...args: any[]) => Promise<void>
  >();

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /** Emite un evento de dominio con payload tipado */
  emit<T = unknown>(event: string, payload?: T): boolean {
    logger.debug(`[EventBus] emit: ${event}`, payload);
    return super.emit(event, payload);
  }

  /** Suscribe un handler a un evento. Devuelve `this` para encadenar. */
  on<T = unknown>(event: string, handler: EventHandler<T>): this {
    const wrapper = async (payload: T) => {
      try { await handler(payload); }
      catch (err) { logger.error(`[EventBus] Error en handler de '${event}':`, err); }
    };
    this.wrapperMap.set(handler, wrapper);
    return super.on(event, wrapper);
  }

  /**
   * Desuscribe el handler original de un evento.
   * Busca el wrapper asociado para hacer removeListener correctamente.
   */
  off<T = unknown>(event: string, handler: EventHandler<T>): this {
    const wrapper = this.wrapperMap.get(handler);
    if (wrapper) {
      super.off(event, wrapper);
      this.wrapperMap.delete(handler);
    }
    return this;
  }

  /** Suscribe un handler que se ejecuta solo una vez */
  once<T = unknown>(event: string, handler: EventHandler<T>): this {
    const wrapper = async (payload: T) => {
      try { await handler(payload); }
      catch (err) { logger.error(`[EventBus] Error en handler (once) de '${event}':`, err); }
    };
    this.wrapperMap.set(handler, wrapper);
    return super.once(event, wrapper);
  }
}

export const eventBus = EventBus.getInstance();
