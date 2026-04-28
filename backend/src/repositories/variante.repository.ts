/**
 * VarianteRepository - Queries Prisma para variantes de productos
 */

import { EstadoGeneral } from '@prisma/client';
import prisma from '../config/database';

export const varianteRepository = {
  findAllByProducto: (id_producto: number) =>
    prisma.productoVariante.findMany({
      where: { id_producto, estado: { not: EstadoGeneral.eliminado } },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    }),

  findById: (id: number) =>
    prisma.productoVariante.findUnique({ where: { id } }),

  findBySKU: (sku: string) =>
    prisma.productoVariante.findUnique({ where: { sku } }),

  create: (data: {
    id_producto: number;
    nombre: string;
    precio: number | string;
    sku?: string;
    atributos?: Record<string, unknown>;
    orden?: number;
    estado?: EstadoGeneral;
  }) =>
    prisma.productoVariante.create({ data: data as any }),

  update: (id: number, data: Partial<{
    nombre: string;
    precio: number | string;
    sku: string;
    atributos: Record<string, unknown>;
    orden: number;
    estado: EstadoGeneral;
  }>) =>
    prisma.productoVariante.update({ where: { id }, data: data as any }),

  softDelete: (id: number) =>
    prisma.productoVariante.update({
      where: { id },
      // Nulleamos el SKU para liberar el constraint @unique y permitir reutilizarlo
      data: { estado: EstadoGeneral.eliminado, sku: null },
    }),

  reorder: (items: { id: number; orden: number }[]) =>
    prisma.$transaction(
      items.map(({ id, orden }) =>
        prisma.productoVariante.update({ where: { id }, data: { orden } })
      )
    ),
};
