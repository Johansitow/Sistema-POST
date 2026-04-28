/**
 * UiConfiguracionRepository — Gestión de configuraciones de UI en base de datos
 */

import prisma from '../config/database';

export const uiConfiguracionRepository = {

  findAll: () =>
    prisma.uiConfiguracion.findMany({
      orderBy: [{ scope: 'asc' }, { clave: 'asc' }],
    }),

  findByScope: (scope: string) =>
    prisma.uiConfiguracion.findMany({
      where:   { scope },
      orderBy: { clave: 'asc' },
    }),

  findByScopeClave: (scope: string, clave: string, contexto?: string) =>
    prisma.uiConfiguracion.findUnique({
      where: {
        scope_clave_contexto: {
          scope,
          clave,
          contexto: contexto ?? '',
        },
      },
    }),

  upsert: (data: { scope: string; clave: string; valor: unknown; contexto?: string }) =>
    prisma.uiConfiguracion.upsert({
      where: {
        scope_clave_contexto: {
          scope:    data.scope,
          clave:    data.clave,
          contexto: data.contexto ?? '',
        },
      },
      update: {
        valor:   data.valor as any,
        version: { increment: 1 },
      },
      create: {
        scope:    data.scope,
        clave:    data.clave,
        valor:    data.valor as any,
        contexto: data.contexto ?? '',
      },
    }),

  deleteById: (id: number) =>
    prisma.uiConfiguracion.delete({ where: { id } }),
};
