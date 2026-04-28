/**
 * CreateOrdenCommand — Comando para crear una nueva orden
 *
 * Encapsula todos los datos necesarios para la operación de escritura.
 * El handler vive en el servicio existente, evitando duplicar lógica.
 */

import type { ICommand } from '../CommandBus';

export interface CreateOrdenData {
  tipo_orden:    string;
  id_estado:     number;
  id_usuario:    number;
  id_restaurante?: number;
  mesa?:         string;
  notas?:        string;
  detalles?:     Array<{
    id_producto: number;
    cantidad:    number;
    precio_unitario: number;
    id_variante?: number;
    notas?:      string;
  }>;
}

export class CreateOrdenCommand implements ICommand {
  readonly commandName = 'CreateOrdenCommand';

  constructor(
    public readonly data:      CreateOrdenData,
    public readonly usuarioId: number,
  ) {}
}
