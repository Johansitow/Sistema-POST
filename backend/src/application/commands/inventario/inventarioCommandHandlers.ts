/**
 * Handlers de comandos para el módulo de inventario
 */

import { inventarioService } from '../../../services/inventario.service';
import type { RegistrarMovimientoCommand } from './RegistrarMovimientoCommand';

export const registrarMovimientoHandler = async (command: RegistrarMovimientoCommand) => {
  return inventarioService.registrarMovimiento(command.data as any);
};
