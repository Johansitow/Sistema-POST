/**
 * socket.ts — cliente Socket.IO singleton
 *
 * Importar en hooks o componentes que necesiten WebSocket.
 * El token se adjunta en el momento de la conexión desde localStorage.
 *
 * Las rooms están scoped por sede: el backend compone `${room}:${idRestaurante}`
 * y valida el acceso contra las sedes del JWT.
 *
 * Uso:
 *   import { socket } from '@/lib/socket';
 *   socket.on('NUEVA_ORDEN', handler);
 *   socket.emit('join', { room: 'cocina', idRestaurante: 3 });
 */

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

/** Lee el accessToken desde el storage de Zustand persist */
const getToken = (): string | null => {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.accessToken ?? null;
  } catch {
    return null;
  }
};

// Creamos el socket con autoConnect: false para controlar cuándo conectar
export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  auth: (cb) => {
    cb({ token: getToken() });
  },
});

/** Lee el id de la sede activa desde el storage de restauranteStore (sin importar el store — evita ciclos) */
export const getRestauranteActivoId = (): number | undefined => {
  try {
    const raw = localStorage.getItem('restaurante-activo');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return parsed?.state?.activo?.id ?? undefined;
  } catch {
    return undefined;
  }
};

/**
 * Conectar y unirse a la room de la sede indicada.
 * Sin idRestaurante explícito usa la sede activa persistida (el backend
 * hace fallback a la sede default del JWT si tampoco viaja).
 */
export const connectSocket = (room: 'cocina' | 'caja' | 'admin', idRestaurante?: number): void => {
  const payload = { room, idRestaurante: idRestaurante ?? getRestauranteActivoId() };
  if (!socket.connected) {
    socket.connect();
    socket.once('connect', () => {
      socket.emit('join', payload);
    });
  } else {
    socket.emit('join', payload);
  }
};

/** Salir de la room de una sede (usar la MISMA sede con la que se hizo join) */
export const leaveRoom = (room: 'cocina' | 'caja' | 'admin', idRestaurante?: number): void => {
  socket.emit('leave', { room, idRestaurante: idRestaurante ?? getRestauranteActivoId() });
};

/** Desconectar limpiamente */
export const disconnectSocket = (): void => {
  if (socket.connected) socket.disconnect();
};

/**
 * Conecta el socket sin unirse a ninguna room específica.
 * Usar desde Layout para escuchar eventos globales (FEATURE_FLAG_CHANGED, etc.)
 * mientras el usuario está autenticado.
 * Retorna una función de limpieza que desconecta.
 */
export const connectGlobal = (): (() => void) => {
  if (!socket.connected) socket.connect();
  return () => disconnectSocket();
};
