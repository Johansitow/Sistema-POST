/**
 * UpdateProductoCommand — Comando para actualizar un producto existente
 */

import type { ICommand } from '../CommandBus';

export class UpdateProductoCommand implements ICommand {
  readonly commandName = 'UpdateProductoCommand';

  constructor(
    public readonly productoId: number,
    public readonly data:       Partial<{
      nombre:                 string;
      descripcion:            string;
      id_categoria:           number;
      precio_unitario:        number;
      precio_venta:           number;
      stock_minimo:           number;
      stock_maximo:           number;
      requiere_refrigeracion: boolean;
      es_vendible:            boolean;
      estado:                 string;
    }>,
    public readonly usuarioId: number,
  ) {}
}
