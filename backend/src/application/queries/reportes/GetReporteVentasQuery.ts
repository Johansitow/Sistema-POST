/**
 * GetReporteVentasQuery — Query para reporte de ventas por período
 */

import type { IQuery } from '../QueryBus';

export class GetReporteVentasQuery implements IQuery {
  readonly queryName = 'GetReporteVentasQuery';

  constructor(
    public readonly filters: {
      fecha_desde?:  Date;
      fecha_hasta?:  Date;
      tipo_orden?:   string;
      agrupar_por?:  string;
      restauranteId?: number;
    },
  ) {}
}
