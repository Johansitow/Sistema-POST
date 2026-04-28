/**
 * EventBus — bus de eventos de dominio (in-process, síncrono/asíncrono).
 *
 * Desacopla módulos sin introducir dependencias circulares ni un broker externo.
 * Los handlers son fire-and-forget: un error en uno no bloquea a los demás.
 *
 * Para eventos que deban ser durables o sobrevivir reinicios del proceso,
 * reemplazar con Redis Streams o BullMQ en el futuro (SaaS-ready).
 *
 * Uso:
 *   // Emitir
 *   await eventBus.emit(EVENTS.ORDEN_COMPLETADA, { idOrden, idRestaurante, ... });
 *
 *   // Suscribir (en un handler module)
 *   eventBus.on(EVENTS.ORDEN_COMPLETADA, async (payload) => { ... });
 */

type EventHandler<T = unknown> = (payload: T) => Promise<void> | void;

class EventBus {
  private readonly handlers = new Map<string, EventHandler[]>();

  /** Registra un handler para un evento. Puede llamarse múltiples veces. */
  on<T>(event: string, handler: EventHandler<T>): void {
    const existing = this.handlers.get(event) ?? [];
    this.handlers.set(event, [...existing, handler as EventHandler]);
  }

  /** Desregistra todos los handlers de un evento (útil en tests). */
  off(event: string): void {
    this.handlers.delete(event);
  }

  /**
   * emit — dispara el evento a todos los handlers registrados.
   * Los handlers corren en paralelo y sus errores se capturan individualmente
   * para no bloquear el flujo de negocio.
   */
  async emit<T>(event: string, payload: T): Promise<void> {
    const list = this.handlers.get(event);
    if (!list || list.length === 0) return;

    const results = await Promise.allSettled(list.map(h => h(payload)));

    // Log de errores sin propagar
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(
          `[EventBus] Error en handler #${i} del evento "${event}":`,
          result.reason
        );
      }
    });
  }
}

// Singleton global — mismo proceso, todos los módulos comparten la instancia
export const eventBus = new EventBus();
