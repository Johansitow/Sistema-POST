/**
 * SocketGateway - WebSocket server para eventos en tiempo real
 *
 * Rooms disponibles:
 *   "cocina"   → recibe NUEVA_ORDEN y ESTADO_ORDEN (pantalla de cocina)
 *   "caja"     → recibe ESTADO_ORDEN, ORDEN_PAGADA (módulo de caja)
 *   "admin"    → todos los eventos
 *
 * El cliente se une a una room tras autenticarse:
 *   socket.emit('join', { room: 'cocina' })
 *
 * Eventos emitidos desde el backend (via socketGateway.emit*):
 *   NUEVA_ORDEN         → { orden }
 *   ESTADO_ORDEN        → { id, id_estado, estado }
 *   ORDEN_CANCELADA     → { id }
 *   STOCK_BAJO          → { producto, stock_actual, stock_minimo }
 */

import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './env';
import logger from './logger';

// Rooms permitidas
const ROOMS = ['cocina', 'caja', 'admin'] as const;
type Room = typeof ROOMS[number];

/** Payload del evento FEATURE_FLAG_CHANGED */
export interface FeatureFlagChangedPayload {
  nombre:    string;
  habilitado: boolean;
  accion:    'crear' | 'actualizar' | 'eliminar' | 'asignacion';
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
        const payload = jwt.verify(token, config.jwt.secret) as { id: number; rol: { nombre: string } };
        (socket as any).user = payload;
        next();
      } catch {
        next(new Error('Token inválido o expirado'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user = (socket as any).user;
      logger.debug(`[WS] Cliente conectado: user=${user?.id} socket=${socket.id}`);

      // El cliente solicita unirse a una room según su rol en la UI
      socket.on('join', ({ room }: { room: Room }) => {
        if (!ROOMS.includes(room)) {
          socket.emit('error', { message: `Room inválida: ${room}` });
          return;
        }
        socket.join(room);
        logger.debug(`[WS] user=${user?.id} joined room=${room}`);
        socket.emit('joined', { room });
      });

      socket.on('leave', ({ room }: { room: Room }) => {
        socket.leave(room);
      });

      socket.on('disconnect', (reason) => {
        logger.debug(`[WS] Cliente desconectado: user=${user?.id} reason=${reason}`);
      });
    });

    logger.info('🔌 WebSocket server iniciado');
  }

  // ── Métodos para emitir eventos desde controladores ──────────────────────

  /** Notifica a cocina y admin que llegó una nueva orden */
  emitNuevaOrden(orden: { id: number; numero_orden: string; tipo_orden: string; total: number | string }): void {
    this.io?.to('cocina').to('admin').emit('NUEVA_ORDEN', { orden });
  }

  /** Notifica a cocina, caja y admin que cambió el estado de una orden */
  emitEstadoOrden(data: { id: number; numero_orden?: string; id_estado: number; estado?: string }): void {
    this.io?.to('cocina').to('caja').to('admin').emit('ESTADO_ORDEN', data);
  }

  /** Notifica que una orden fue cancelada */
  emitOrdenCancelada(id: number): void {
    this.io?.to('cocina').to('caja').to('admin').emit('ORDEN_CANCELADA', { id });
  }

  /** Alerta de stock bajo (para admin y caja) */
  emitStockBajo(data: { id_producto: number; nombre: string; stock_actual: number; stock_minimo: number }): void {
    this.io?.to('admin').to('caja').emit('STOCK_BAJO', data);
  }

  /**
   * Notifica a caja y admin que se completó un cierre de caja.
   * El cliente usa este evento solo como trigger de refetch de sus
   * notificaciones (el refetch viaja con X-Restaurante-Id, por lo que
   * cada sede solo ve sus propias alertas aunque la room sea global).
   */
  emitCierreCompletado(data: { id_cierre: number; id_restaurante: number; numero_cierre: string; estado: string }): void {
    this.io?.to('caja').to('admin').emit('CIERRE_COMPLETADO', data);
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
