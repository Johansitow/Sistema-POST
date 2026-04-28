/**
 * GetMovimientosQuery — Query para listar movimientos de inventario
 */

import type { IQuery } from '../QueryBus';

export class GetMovimientosQuery implements IQuery {
  readonly queryName = 'GetMovimientosQuery';

  constructor(
    public readonly filters: {
      page?:           number;
      limit?:          number;
      id_producto?:    number;
      tipo?:           string;
      fecha_desde?:    Date;
      fecha_hasta?:    Date;
      id_restaurante?: number;
    },
  ) {}
}
