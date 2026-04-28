/**
 * PagoOrdenRepository — queries Prisma para PagoOrden
 *
 * Los pagos siempre son contra la Orden global, no contra una sede individual.
 */

import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';

export const pagoOrdenRepository = {

  findByOrden: (id_orden: number) =>
    prisma.pagoOrden.findMany({
      where: { id_orden },
      include: { metodo_pago: { select: { id: true, nombre: true, codigo: true, icono: true } } },
      orderBy: { fecha_pago: 'asc' },
    }),

  create: (data: {
    id_orden:       number;
    id_metodo_pago: number;
    monto:          Decimal;
    referencia?:    string;
    notas?:         string;
  }) =>
    prisma.pagoOrden.create({
      data,
      include: { metodo_pago: { select: { id: true, nombre: true, codigo: true } } },
    }),

  sumByOrden: (id_orden: number) =>
    prisma.pagoOrden.aggregate({
      where: { id_orden, estado: { not: 'rechazado' } },
      _sum: { monto: true },
    }),
};
