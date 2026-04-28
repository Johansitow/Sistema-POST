/**
 * GetReporteCompletoQuery — Query para reporte consolidado (ventas + productos + categorías + métodos de pago)
 * Es la query más pesada del sistema — candidata ideal a caché.
 */

import type { IQuery } from '../QueryBus';

export class GetReporteCompletoQuery implements IQuery {
  readonly queryName = 'GetReporteCompletoQuery';

  constructor(
    public readonly filters: {
      fecha_desde?:  Date;
      fecha_hasta?:  Date;
      restauranteId?: number;
    },
  ) {}
}
