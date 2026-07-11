/**
 * MovimientoRepository - Solo queries Prisma para movimientos de inventario
 */

import { TipoMovimiento } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import { PaginationParams, getSkip } from '../lib/pagination';

export interface MovimientoData {
  id_producto:     number;
  id_restaurante:  number;
  tipo_movimiento: TipoMovimiento;
  cantidad:        Decimal;
  stock_anterior:  Decimal;
  stock_nuevo:     Decimal;
  motivo:          string;
  id_orden?:       number;
  id_proveedor?:   number;
  id_lote?:        number;
  referencia?:     string;
}

export const movimientoRepository = {
  findAll: (
    pagination: PaginationParams,
    filters: {
      id_restaurante: number;   // obligatorio — aislamiento de tenant
      id_producto?:   number;
      tipo?:          TipoMovimiento;
      fecha_desde?:   Date;
      fecha_hasta?:   Date;
    }
  ) => {
    const where: any = { id_restaurante: filters.id_restaurante };
    if (filters.id_producto) where.id_producto = filters.id_producto;
    if (filters.tipo)        where.tipo_movimiento = filters.tipo;
    if (filters.fecha_desde || filters.fecha_hasta) {
      where.fecha_movimiento = {};
      if (filters.fecha_desde) where.fecha_movimiento.gte = filters.fecha_desde;
      if (filters.fecha_hasta) where.fecha_movimiento.lte = filters.fecha_hasta;
    }

    return Promise.all([
      prisma.movimiento.findMany({
        where,
        include: { producto: { include: { categoria: true } }, lote: { select: { numero_lote: true } } },
        orderBy: { fecha_movimiento: 'desc' },
        skip: getSkip(pagination),
        take: pagination.limit,
      }),
      prisma.movimiento.count({ where }),
    ]);
  },

  create: (data: MovimientoData) =>
    prisma.movimiento.create({ data, include: { producto: true } }),

  groupByTipo: (gte: Date, id_restaurante: number) =>
    prisma.movimiento.groupBy({
      by: ['tipo_movimiento'],
      where: { fecha_movimiento: { gte }, id_restaurante },
      _count: true,
      _sum: { cantidad: true },
    }),

  count: (gte: Date, id_restaurante: number) =>
    prisma.movimiento.count({ where: { fecha_movimiento: { gte }, id_restaurante } }),

  findDistinctProductos: (gte: Date, id_restaurante: number) =>
    prisma.movimiento.findMany({
      where:    { fecha_movimiento: { gte }, id_restaurante },
      distinct: ['id_producto'],
      select:   { id_producto: true },
    }),

  sumMermaByLote: (id_lote: number, id_restaurante: number) =>
    prisma.movimiento.aggregate({
      where: {
        id_lote,
        id_restaurante,
        tipo_movimiento: TipoMovimiento.merma,
      },
      _sum: { cantidad: true },
    }),
};
