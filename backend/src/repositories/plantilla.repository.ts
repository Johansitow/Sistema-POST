/**
 * PlantillaRepository - Queries Prisma para plantillas de impresión
 */

import { EstadoGeneral } from '@prisma/client';
import prisma from '../config/database';

export const plantillaRepository = {
  findAll: (tipo?: string, tenant?: { id_restaurante?: number; id_grupo?: number }) => {
    const tenantFilter = tenant?.id_restaurante || tenant?.id_grupo
      ? {
          OR: [
            { id_restaurante: null, id_grupo: null },
            ...(tenant.id_restaurante ? [{ id_restaurante: tenant.id_restaurante }] : []),
            ...(tenant.id_grupo       ? [{ id_grupo:       tenant.id_grupo       }] : []),
          ],
        }
      : {};

    return prisma.plantillaImpresion.findMany({
      where: {
        estado: { not: EstadoGeneral.eliminado },
        ...(tipo ? { tipo } : {}),
        ...tenantFilter,
      },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    });
  },

  findById: (id: number) =>
    prisma.plantillaImpresion.findUnique({ where: { id } }),

  findDefault: (tipo: string) =>
    prisma.plantillaImpresion.findFirst({
      where: { tipo, es_default: true, estado: { not: EstadoGeneral.eliminado } },
    }),

  create: (data: {
    nombre: string;
    tipo: string;
    es_default?: boolean;
    plantilla: Record<string, unknown>;
    estado?: EstadoGeneral;
  }) =>
    prisma.plantillaImpresion.create({ data: data as any }),

  update: (id: number, data: Partial<{
    nombre: string;
    tipo: string;
    es_default: boolean;
    plantilla: Record<string, unknown>;
    estado: EstadoGeneral;
  }>) =>
    prisma.plantillaImpresion.update({ where: { id }, data: data as any }),

  clearDefaults: (tipo: string, exceptId?: number) =>
    prisma.plantillaImpresion.updateMany({
      where: {
        tipo,
        es_default: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { es_default: false },
    }),

  softDelete: (id: number) =>
    prisma.plantillaImpresion.update({
      where: { id },
      data: { estado: EstadoGeneral.eliminado },
    }),
};
