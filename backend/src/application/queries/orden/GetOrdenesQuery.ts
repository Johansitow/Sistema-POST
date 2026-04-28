/**
 * GetOrdenesQuery — Query para listar órdenes con filtros y paginación
 */

import type { IQuery } from '../QueryBus';

export class GetOrdenesQuery implements IQuery {
  readonly queryName = 'GetOrdenesQuery';

  constructor(
    public readonly filters: {
      page?:           number;
      limit?:          number;
      tipo_orden?:     string;
      id_estado?:      number;
      estado_global?:  string;
      fecha_desde?:    string;
      fecha_hasta?:    string;
      id_restaurante?: number;
      id_grupo?:       number;
    },
  ) {}
}
