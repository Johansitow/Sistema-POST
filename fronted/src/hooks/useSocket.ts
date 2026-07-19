/**
 * useSocket — hook que conecta al WebSocket y escucha eventos de órdenes
 *
 * Uso en pantalla de cocina:
 *   const { isConnected } = useSocket('cocina', {
 *     onNuevaOrden: (data) => toast(`Nueva orden #${data.orden.numero_orden}`),
 *     onEstadoOrden: (data) => actualizarOrden(data),
 *   });
 *
 * Uso en caja:
 *   const { isConnected } = useSocket('caja', {
 *     onEstadoOrden: (data) => setOrdenes(...),
 *     onStockBajo: (data) => showAlert(data),
 *   });
 */

import { useEffect, useState } from 'react';
import { socket, connectSocket, leaveRoom } from '../lib/socket';
import { useRestauranteActivo } from '../store/restauranteStore';

export interface OrdenEvent {
  id:           number;
  numero_orden?: string;
  tipo_orden?:  string;
  total?:       number | string;
}

export interface EstadoOrdenEvent {
  id:        number;
  id_estado: number;
  estado?:   string;
}

export interface StockBajoEvent {
  id_producto:  number;
  nombre:       string;
  stock_actual: number;
  stock_minimo: number;
}

interface SocketHandlers {
  onNuevaOrden?:    (data: { orden: OrdenEvent }) => void;
  onEstadoOrden?:   (data: EstadoOrdenEvent) => void;
  onOrdenCancelada?: (data: { id: number }) => void;
  onStockBajo?:     (data: StockBajoEvent) => void;
}

export const useSocket = (
  room: 'cocina' | 'caja' | 'admin',
  handlers: SocketHandlers = {}
) => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const idRestaurante = useRestauranteActivo();

  useEffect(() => {
    // Conectar al montar / al cambiar de sede (re-join a la room de la nueva sede)
    connectSocket(room, idRestaurante);

    const onConnect    = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect',    onConnect);
    socket.on('disconnect', onDisconnect);

    if (handlers.onNuevaOrden)     socket.on('NUEVA_ORDEN',    handlers.onNuevaOrden);
    if (handlers.onEstadoOrden)    socket.on('ESTADO_ORDEN',   handlers.onEstadoOrden);
    if (handlers.onOrdenCancelada) socket.on('ORDEN_CANCELADA', handlers.onOrdenCancelada);
    if (handlers.onStockBajo)      socket.on('STOCK_BAJO',     handlers.onStockBajo);

    return () => {
      socket.off('connect',    onConnect);
      socket.off('disconnect', onDisconnect);

      if (handlers.onNuevaOrden)     socket.off('NUEVA_ORDEN',    handlers.onNuevaOrden);
      if (handlers.onEstadoOrden)    socket.off('ESTADO_ORDEN',   handlers.onEstadoOrden);
      if (handlers.onOrdenCancelada) socket.off('ORDEN_CANCELADA', handlers.onOrdenCancelada);
      if (handlers.onStockBajo)      socket.off('STOCK_BAJO',     handlers.onStockBajo);

      // No desconectamos el socket aquí: el lifecycle de la conexión lo gestiona Layout.
      // Solo dejamos la room de ESTA sede (la capturada por el closure) para no
      // recibir más eventos de ese scope.
      leaveRoom(room, idRestaurante);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, idRestaurante]);

  return { isConnected };
};
