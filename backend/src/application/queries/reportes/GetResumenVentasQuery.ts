/**
 * GetResumenVentasQuery — Query para resumen de ventas por días (gráficas de tendencia)
 */

import type { IQuery } from '../QueryBus';

export class GetResumenVentasQuery implements IQuery {
  readonly queryName = 'GetResumenVentasQuery';

  constructor(
    public readonly dias:           number = 30,
    public readonly restauranteId?: number,
  ) {}
}
