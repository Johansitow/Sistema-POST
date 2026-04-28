/**
 * Handlers de queries para el módulo de productos
 */

import { productoService } from '../../../services/producto.service';
import type { GetProductosQuery } from './GetProductosQuery';

export const getProductosHandler = async (query: GetProductosQuery) => {
  return productoService.listar({
    ...query.filters,
    estado: query.filters.estado as any,
  });
};
