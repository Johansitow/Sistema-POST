/**
 * Handlers de queries para el módulo de dashboard
 */

import { dashboardService } from '../../../services/dashboard.service';
import type { GetDashboardStatsQuery } from './GetDashboardStatsQuery';

export const getDashboardStatsHandler = async (query: GetDashboardStatsQuery) => {
  return dashboardService.getStats(query.restauranteId, query.grupoId);
};
