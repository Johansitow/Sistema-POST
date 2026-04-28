/**
 * Handlers de comandos para el módulo de órdenes
 *
 * Cada handler delega al service existente — no duplica lógica de negocio.
 * Esta capa solo enruta el comando al servicio correcto.
 */

import { ordenService } from '../../../services/orden.service';
import type { CreateOrdenCommand } from './CreateOrdenCommand';
import type { CancelOrdenCommand } from './CancelOrdenCommand';

export const createOrdenHandler = async (command: CreateOrdenCommand) => {
  return ordenService.crearLegado(command.data as any, command.usuarioId);
};

export const cancelOrdenHandler = async (command: CancelOrdenCommand) => {
  return ordenService.eliminarLegado(command.ordenId);
};
