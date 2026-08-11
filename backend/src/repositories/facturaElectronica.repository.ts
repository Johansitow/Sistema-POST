/**
 * FacturaElectronicaRepository — queries Prisma de facturas electrónicas DIAN.
 * Scope de tenant SIEMPRE por grupoId (o vía la orden ya validada por el service).
 */

import { EstadoFacturaElectronica, Prisma } from '@prisma/client';
import prisma from '../config/database';

export const facturaElectronicaRepository = {
  create: (data: Prisma.FacturaElectronicaUncheckedCreateInput) =>
    prisma.facturaElectronica.create({ data }),

  findByOrden: (id_orden: number) =>
    prisma.facturaElectronica.findUnique({ where: { id_orden } }),

  findById: (id: number) =>
    prisma.facturaElectronica.findUnique({ where: { id } }),

  update: (id: number, data: Prisma.FacturaElectronicaUpdateInput) =>
    prisma.facturaElectronica.update({ where: { id }, data }),

  listByGrupo: (id_grupo: number) =>
    prisma.facturaElectronica.findMany({
      where: { id_grupo },
      orderBy: { fecha_creacion: 'desc' },
      take: 200,
    }),

  /** En pendiente/error, candidatas a reintento por el job. */
  findReintentables: (maxReintentos: number) =>
    prisma.facturaElectronica.findMany({
      where: {
        estado:     { in: [EstadoFacturaElectronica.pendiente, EstadoFacturaElectronica.error] },
        reintentos: { lt: maxReintentos },
      },
      take: 100,
    }),
};
