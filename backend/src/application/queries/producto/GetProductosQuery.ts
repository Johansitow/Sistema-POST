/**
 * GetProductosQuery — Query para listar productos con filtros y paginación
 */

import type { IQuery } from '../QueryBus';

export class GetProductosQuery implements IQuery {
  readonly queryName = 'GetProductosQuery';

  constructor(
    public readonly filters: {
      page?:        number;
      limit?:       number;
      search?:      string;
      categoria?:   number;
      estado?:      string;
      es_vendible?: boolean;
      id_grupo?:    number;
      /** Sede activa: enriquece cada producto con su ProductoStock local */
      id_restaurante?: number;
    },
  ) {}
}
