/**
 * ConfiguracionGrupoRepository
 *
 * Gestiona la tabla `configuracion_grupo` — clave/valor a nivel de GrupoNegocio.
 * Espejo de ConfiguracionRestauranteRepository pero con id_grupo.
 *
 * Precedencia de lectura (implementada en configuracionService.resolverParaRestaurante):
 *   ConfiguracionRestaurante (sede) > ConfiguracionGrupo (aquí) > Configuracion (global)
 */

import prisma from '../config/database';
import { TipoDato } from '@prisma/client';

export const configuracionGrupoRepository = {

  findAll: (id_grupo: number) =>
    prisma.configuracionGrupo.findMany({
      where: { id_grupo },
      orderBy: { clave: 'asc' },
    }),

  findByClave: (id_grupo: number, clave: string) =>
    prisma.configuracionGrupo.findUnique({
      where: { id_grupo_clave: { id_grupo, clave } },
    }),

  upsert: (id_grupo: number, clave: string, valor: string) =>
    prisma.configuracionGrupo.upsert({
      where:  { id_grupo_clave: { id_grupo, clave } },
      update: { valor },
      create: { id_grupo, clave, valor },
    }),

  delete: (id_grupo: number, clave: string) =>
    prisma.configuracionGrupo.delete({
      where: { id_grupo_clave: { id_grupo, clave } },
    }),

  upsertMany: (id_grupo: number, items: { clave: string; valor: string; tipo_dato?: TipoDato; descripcion?: string }[]) =>
    prisma.$transaction(
      items.map(({ clave, valor, tipo_dato, descripcion }) =>
        prisma.configuracionGrupo.upsert({
          where:  { id_grupo_clave: { id_grupo, clave } },
          update: { valor },
          create: { id_grupo, clave, valor, ...(tipo_dato && { tipo_dato }), ...(descripcion && { descripcion }) },
        })
      )
    ),

  parseValor: (config: { valor: string; tipo_dato: TipoDato }): unknown => {
    switch (config.tipo_dato) {
      case 'number':  return Number(config.valor);
      case 'boolean': return config.valor === 'true';
      case 'json':    try { return JSON.parse(config.valor); } catch { return config.valor; }
      default:        return config.valor;
    }
  },
};
