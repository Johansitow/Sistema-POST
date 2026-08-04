/**
 * SuscripcionRepository — queries Prisma de la suscripción SaaS de un grupo.
 * Una suscripción por grupo (id_grupo @unique). Scope de tenant SIEMPRE por grupoId.
 */

import { EstadoSuscripcion, MetodoSuscripcion, PlanSaaS, Prisma } from '@prisma/client';
import prisma from '../config/database';

export interface DatosSuscripcion {
  plan:                    PlanSaaS;
  estado:                  EstadoSuscripcion;
  metodo?:                 MetodoSuscripcion | null;
  monto_cop:               Prisma.Decimal | number | string;
  periodo_inicio?:         Date | null;
  periodo_fin?:            Date | null;
  proximo_cobro?:          Date | null;
  wompi_payment_source_id?: string | null;
  wompi_customer_ref?:     string | null;
  reintentos?:             number;
}

export const suscripcionRepository = {
  findByGrupo: (id_grupo: number) =>
    prisma.suscripcion.findUnique({ where: { id_grupo } }),

  findById: (id: number) =>
    prisma.suscripcion.findUnique({ where: { id } }),

  /** Crea o actualiza la suscripción del grupo (una por grupo). */
  upsert: (id_grupo: number, data: DatosSuscripcion) =>
    prisma.suscripcion.upsert({
      where:  { id_grupo },
      create: { id_grupo, ...data },
      update: data,
    }),

  update: (id: number, data: Prisma.SuscripcionUpdateInput) =>
    prisma.suscripcion.update({ where: { id }, data }),

  /** Activas cuyo próximo cobro ya venció → candidatas a renovación (job). */
  findPorCobrar: (ahora: Date) =>
    prisma.suscripcion.findMany({
      where: { estado: EstadoSuscripcion.activa, proximo_cobro: { lte: ahora } },
    }),

  /** Vencidas más allá del período + gracia y aún no degradadas (job). */
  findParaVencer: (limite: Date) =>
    prisma.suscripcion.findMany({
      where: {
        estado:      { in: [EstadoSuscripcion.activa, EstadoSuscripcion.pendiente_pago, EstadoSuscripcion.cancelada] },
        periodo_fin: { lt: limite },
      },
    }),
};
