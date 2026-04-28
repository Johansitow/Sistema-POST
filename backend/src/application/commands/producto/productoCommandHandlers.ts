/**
 * Handlers de comandos para el módulo de productos
 */

import { productoService } from '../../../services/producto.service';
import type { CreateProductoCommand } from './CreateProductoCommand';
import type { UpdateProductoCommand } from './UpdateProductoCommand';

export const createProductoHandler = async (command: CreateProductoCommand) => {
  return productoService.crear(command.data as any);
};

export const updateProductoHandler = async (command: UpdateProductoCommand) => {
  return productoService.actualizar(command.productoId, command.data as any);
};
