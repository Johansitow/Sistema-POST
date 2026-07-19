/**
 * SocketGateway - WebSocket server para eventos en tiempo real
 *
 * Rooms por sede: cada room base se compone con el restaurante activo:
 *   "cocina:{idRestaurante}"  → NUEVA_ORDEN y ESTADO_ORDEN (pantalla de cocina de ESA sede)
 *   "caja:{idRestaurante}"    → ESTADO_ORDEN, ORDEN_PAGADA (módulo de caja de ESA sede)
 *   "admin:{idRestaurante}"   → todos los eventos de ESA sede
 *
 * El cliente se une a una room tras autenticarse, indicando su sede activa:
 *   socket.emit('join', { room: 'cocina', idRestaurante: 3 })
 *
 * El join valida que el usuario tenga acceso a esa sede contra la lista
 * `restaurantes[]` embebida en su JWT (superadmin: sin restricción).
 * Si no envía idRestaurante, se usa su sede default (compatibilidad).
 *
 * Eventos emitidos desde el backend (via socketGateway.emit*):
 *   NUEVA_ORDEN         → { orden }
 *   ESTADO_ORDEN        → { id, id_estado, estado }
 *   ORDEN_CANCELADA     → { id }
 *   STOCK_BAJO          → { producto, stock_actual, stock_minimo }
 *   FEATURE_FLAG_CHANGED → global (sin room): los flags afectan a todos
 */

import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './env';
import logger from './logger';

// Rooms base permitidas (se componen como `${room}:${idRestaurante}`)
const ROOMS = ['cocina', 'caja', 'admin'] as const;
type Room = typeof ROOMS[number];

/** Datos del usuario extraídos del JWT del handshake */
interface SocketUser {
  id:              number;
  rol?:            { nombre: string };
  es_super_admin?: boolean;
  restaurantes?:   Array<{ id: number; nombre?: string; es_default?: boolean; id_grupo?: number }>;
}

/** Payload del evento FEATURE_FLAG_CHANGED */
export interface FeatureFlagChangedPayload {
  nombre:    string;
  habilitado: boolean;
  accion:    'crear' | 'actualizar' | 'eliminar' | 'asignacion';
}

/** Compone los nombres de room por sede: rooms × ids */
function roomsDeSedes(rooms: readonly Room[], idsRestaurante: number[]): string[] {
  return idsRestaurante.flatMap(id => rooms.map(room => `${room}:${id}`));
}

class SocketGateway {
  private io: SocketServer | null = null;

  /**
   * init — adjunta el servidor Socket.IO al servidor HTTP de Express.
   * Llamar una sola vez desde server.ts después de crear el httpServer.
   */
  init(httpServer: HttpServer): void {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      // Permite conexiones desde mismo proceso (útil en tests)
      transports: ['websocket', 'polling'],
    });

    // Middleware de autenticación: el cliente debe enviar el JWT como query param o en auth
    this.io.use((socket: Socket, next) => {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.query?.token as string | undefined);

      if (!token) {
        return next(new Error('Token de autenticación requerido'));
      }

      try {
        const payload = jwt.verify(token, config.jwt.secret) as SocketUser;
        socket.data.user = payload;
        next();
      } catch {
        next(new Error('Token inválido o expirado'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user = socket.data.user as SocketUser;
      logger.debug(`[WS] Cliente conectado: user=${user?.id} socket=${socket.id}`);

      // El cliente se une a la room de su rol de UI para su sede activa
      socket.on('join', ({ room, idRestaurante }: { room: Room; idRestaurante?: number }) => {
        if (!ROOMS.includes(room)) {
          socket.emit('error', { message: `Room inválida: ${room}` });
          return;
        }
        const sede = this.resolverSede(user, idRestaurante);
        if (sede === null) {
          socket.emit('error', { message: 'No tienes acceso al restaurante especificado' });
          logger.warn(`[WS] join rechazado: user=${user?.id} room=${room} sede=${idRestaurante}`);
          return;
        }
        const roomName = `${room}:${sede}`;
        socket.join(roomName);
        logger.debug(`[WS] user=${user?.id} joined room=${roomName}`);
        socket.emit('joined', { room, idRestaurante: sede });
      });

      socket.on('leave', ({ room, idRestaurante }: { room: Room; idRestaurante?: number }) => {
        const sede = this.resolverSede(user, idRestaurante);
        if (sede !== null) socket.leave(`${room}:${sede}`);
      });

      socket.on('disconnect', (reason) => {
        logger.debug(`[WS] Cliente desconectado: user=${user?.id} reason=${reason}`);
      });
    });

    logger.info('🔌 WebSocket server iniciado');
  }

  /**
   * Resuelve y autoriza la sede para join/leave.
   * - Con idRestaurante: superadmin pasa siempre; otros solo si la sede está en su JWT.
   * - Sin idRestaurante: fallback a la sede default o primera del JWT (compatibilidad
   *   con clientes que aún no envían sede — mismo criterio que tenantContext).
   * Retorna null si no hay sede autorizada.
   */
  private resolverSede(user: SocketUser | undefined, idRestaurante?: number): number | null {
    const sedes = user?.restaurantes ?? [];
    if (idRestaurante !== undefined) {
      if (user?.es_super_admin) return idRestaurante;
      return sedes.some(r => r.id === idRestaurante) ? idRestaurante : null;
    }
    const fallback = sedes.find(r => r.es_default) ?? sedes[0];
    return fallback ? fallback.id : null;
  }

  // ── Métodos para emitir eventos desde controladores ──────────────────────

  /** Notifica a cocina y admin de cada sede involucrada que llegó una nueva orden */
  emitNuevaOrden(
    orden: { id: number; numero_orden: string; tipo_orden: string; total: number | string },
    idsRestaurante: number[],
  ): void {
    for (const room of roomsDeSedes(['cocina', 'admin'], idsRestaurante)) {
      this.io?.to(room).emit('NUEVA_ORDEN', { orden });
    }
  }

  /** Notifica a cocina, caja y admin de cada sede que cambió el estado de una orden */
  emitEstadoOrden(
    data: { id: number; numero_orden?: string; id_estado: number; estado?: string },
    idsRestaurante: number[],
  ): void {
    for (const room of roomsDeSedes(['cocina', 'caja', 'admin'], idsRestaurante)) {
      this.io?.to(room).emit('ESTADO_ORDEN', data);
    }
  }

  /** Notifica que una orden fue cancelada (a todas las sedes involucradas) */
  emitOrdenCancelada(id: number, idsRestaurante: number[]): void {
    for (const room of roomsDeSedes(['cocina', 'caja', 'admin'], idsRestaurante)) {
      this.io?.to(room).emit('ORDEN_CANCELADA', { id });
    }
  }

  /** Alerta de stock bajo (para admin y caja de la sede afectada) */
  emitStockBajo(
    data: { id_producto: number; nombre: string; stock_actual: number; stock_minimo: number },
    idRestaurante: number,
  ): void {
    for (const room of roomsDeSedes(['admin', 'caja'], [idRestaurante])) {
      this.io?.to(room).emit('STOCK_BAJO', data);
    }
  }

  /**
   * Notifica a caja y admin de la sede que se completó un cierre de caja.
   * La room se deriva del id_restaurante del propio payload.
   */
  emitCierreCompletado(data: { id_cierre: number; id_restaurante: number; numero_cierre: string; estado: string }): void {
    for (const room of roomsDeSedes(['caja', 'admin'], [data.id_restaurante])) {
      this.io?.to(room).emit('CIERRE_COMPLETADO', data);
    }
  }

  /**
   * Notifica a TODOS los clientes conectados que un feature flag cambió.
   * El cliente debe hacer un reload de sus flags al recibirlo.
   * Se emite sin filtro de room porque los flags afectan a todos los usuarios.
   */
  emitFeatureFlagChanged(data: FeatureFlagChangedPayload): void {
    this.io?.emit('FEATURE_FLAG_CHANGED', data);
    logger.debug(`[WS] FEATURE_FLAG_CHANGED: ${data.nombre} → ${data.habilitado} (${data.accion})`);
  }
}

// Singleton — importar desde cualquier módulo
export const socketGateway = new SocketGateway();
