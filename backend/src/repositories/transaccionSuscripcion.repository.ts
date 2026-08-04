/**
 * TransaccionSuscripcionRepository — cada cobro/intento de una suscripción.
 * `referencia` (la que enviamos a Wompi) y `wompi_transaction_id` son @unique:
 * sirven para reconciliar el webhook con la transacción local.
 */

import { EstadoTxWompi, MetodoSuscripcion, Prisma } from '@prisma/client';
import prisma from '../config/database';

export interface DatosTransaccion {
  id_suscripcion: number;
  referencia:     string;
  monto_cop:      Prisma.Decimal | number | string;
  metodo:         MetodoSuscripcion;
  periodo_inicio: Date;
  periodo_fin:    Date;
  estado?:        EstadoTxWompi;
}

export const transaccionSuscripcionRepository = {
  create: (data: DatosTransaccion) =>
    prisma.transaccionSuscripcion.create({ data }),

  findByReferencia: (referencia: string) =>
    prisma.transaccionSuscripcion.findUnique({
      where: { referencia },
      include: { suscripcion: true },
    }),

  findByWompiId: (wompi_transaction_id: string) =>
    prisma.transaccionSuscripcion.findUnique({
      where: { wompi_transaction_id },
      include: { suscripcion: true },
    }),

  update: (id: number, data: Prisma.TransaccionSuscripcionUpdateInput) =>
    prisma.transaccionSuscripcion.update({ where: { id }, data }),
};
