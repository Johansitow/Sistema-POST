/**
 * Handlers de queries para el módulo de órdenes
 */

import { ordenService } from '../../../services/orden.service';
import type { GetOrdenesQuery } from './GetOrdenesQuery';

export const getOrdenesHandler = async (query: GetOrdenesQuery) => {
  const { page, limit, tipo_orden, id_estado, estado_global, fecha_desde, fecha_hasta, id_restaurante, id_grupo } = query.filters;
  return ordenService.listar({
    page,
    limit,
    tipo_orden:     tipo_orden     as any,
    id_estado:      id_estado      ? Number(id_estado)     : undefined,
    estado_global:  estado_global  as any,
    fecha_desde:    fecha_desde    ? new Date(fecha_desde) : undefined,
    fecha_hasta:    fecha_hasta    ? new Date(fecha_hasta) : undefined,
    id_restaurante,
    id_grupo,
  });
};
