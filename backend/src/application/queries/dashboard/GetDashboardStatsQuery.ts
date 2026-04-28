/**
 * GetDashboardStatsQuery — Query para obtener estadísticas del dashboard
 *
 * Read-only: puede ser cacheada, optimizada o servida desde una réplica
 * sin afectar las operaciones de escritura.
 */

import type { IQuery } from '../QueryBus';

export class GetDashboardStatsQuery implements IQuery {
  readonly queryName = 'GetDashboardStatsQuery';

  constructor(
    public readonly restauranteId?: number,
  ) {}
}
