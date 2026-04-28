/**
 * FeatureFlagRepository - Queries Prisma para feature flags
 */

import prisma from '../config/database';

export const featureFlagRepository = {
  findAll: () =>
    prisma.featureFlag.findMany({
      include: { asignaciones: true },
      orderBy: { nombre: 'asc' },
    }),

  findByNombre: (nombre: string) =>
    prisma.featureFlag.findUnique({
      where: { nombre },
      include: { asignaciones: true },
    }),

  findById: (id: number) =>
    prisma.featureFlag.findUnique({
      where: { id },
      include: { asignaciones: true },
    }),

  create: (data: {
    nombre: string;
    descripcion?: string;
    habilitado?: boolean;
    scope?: string;
    metadata?: Record<string, unknown>;
  }) =>
    prisma.featureFlag.create({ data: data as any }),

  update: (id: number, data: Partial<{
    nombre: string;
    descripcion: string;
    habilitado: boolean;
    scope: string;
    metadata: Record<string, unknown>;
  }>) =>
    prisma.featureFlag.update({ where: { id }, data: data as any }),

  delete: (id: number) =>
    prisma.featureFlag.delete({ where: { id } }),

  setAsignacion: (id_feature_flag: number, contexto: string, habilitado: boolean) =>
    prisma.featureFlagAsignacion.upsert({
      where: { id_feature_flag_contexto: { id_feature_flag, contexto } },
      create: { id_feature_flag, contexto, habilitado },
      update: { habilitado },
    }),

  deleteAsignacion: (id_feature_flag: number, contexto: string) =>
    prisma.featureFlagAsignacion.deleteMany({
      where: { id_feature_flag, contexto },
    }),
};
