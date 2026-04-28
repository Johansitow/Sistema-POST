/**
 * Handlers de queries para el módulo de inventario
 */

import { inventarioService } from '../../../services/inventario.service';
import type { GetMovimientosQuery } from './GetMovimientosQuery';

export const getMovimientosHandler = async (query: GetMovimientosQuery) => {
  return inventarioService.listarMovimientos({
    ...query.filters,
    tipo:           query.filters.tipo as any,
    id_restaurante: query.filters.id_restaurante!,
  });
};
