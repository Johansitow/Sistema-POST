/**
 * socket.ts — cliente Socket.IO singleton
 *
 * Importar en hooks o componentes que necesiten WebSocket.
 * El token se adjunta en el momento de la conexión desde localStorage.
 *
 * Uso:
 *   import { socket } from '@/lib/socket';
 *   socket.on('NUEVA_ORDEN', handler);
 *   socket.emit('join', { room: 'cocina' });
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

/** Conectar y unirse a una room */
export const connectSocket = (room: 'cocina' | 'caja' | 'admin'): void => {
  if (!socket.connected) {
    socket.connect();
    socket.once('connect', () => {
      socket.emit('join', { room });
    });
  } else {
    socket.emit('join', { room });
  }
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
