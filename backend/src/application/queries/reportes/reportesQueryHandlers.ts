/**
 * Handlers de queries para el módulo de reportes
 *
 * Todas son operaciones de solo lectura — candidatas a caché con Redis.
 */

import { reporteService }    from '../../../services/reporte.service';
import { dashboardService }  from '../../../services/dashboard.service';
import type { GetReporteVentasQuery }   from './GetReporteVentasQuery';
import type { GetReporteCompletoQuery } from './GetReporteCompletoQuery';
import type { GetResumenVentasQuery }   from './GetResumenVentasQuery';

export const getReporteVentasHandler = async (query: GetReporteVentasQuery) => {
  return reporteService.getVentas({
    fecha_desde:    query.filters.fecha_desde,
    fecha_hasta:    query.filters.fecha_hasta,
    tipo_orden:     query.filters.tipo_orden  as any,
    agrupar_por:    query.filters.agrupar_por,
    id_restaurante: query.filters.restauranteId,
  });
};

export const getReporteCompletoHandler = async (query: GetReporteCompletoQuery) => {
  return reporteService.getReporteCompleto({
    fecha_desde:    query.filters.fecha_desde,
    fecha_hasta:    query.filters.fecha_hasta,
    id_restaurante: query.filters.restauranteId,
  });
};

export const getResumenVentasHandler = async (query: GetResumenVentasQuery) => {
  return dashboardService.getResumenVentas(query.dias, query.restauranteId);
};
