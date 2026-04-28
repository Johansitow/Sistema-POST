/**
 * registerHandlers — registra todos los handlers de dominio.
 * Llamar UNA SOLA VEZ desde server.ts al arrancar la app.
 *
 * Orden: socket primero (más crítico para UX), luego side effects de dominio.
 */

import { registerSocketHandlers }    from './handlers/socket.handler';
import { registerInventarioHandlers } from './handlers/inventario.handler';
import { registerClienteHandlers }   from './handlers/cliente.handler';
import { registerCacheHandlers }     from './handlers/cache.handler';
import logger from '../config/logger';

export function registerAllHandlers(): void {
  // Orden de registro: UX crítica primero, luego side-effects de dominio,
  // luego invalidación de caché (última — no bloquea nada si Redis falla).
  registerSocketHandlers();
  registerInventarioHandlers();
  registerClienteHandlers();
  registerCacheHandlers();
  logger.info('✅ Domain event handlers registrados (socket, inventario, cliente, cache)');
}
