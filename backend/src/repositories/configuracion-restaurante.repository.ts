/**
 * ConfiguracionRestauranteRepository
 *
 * Gestiona la tabla `configuracion_restaurante` — clave/valor por restaurante.
 * Permite que cada tenant tenga su propia configuración sin conflictos con otros.
 *
 * Ejemplos de claves: 'puntos_por_unidad', 'iva_porcentaje', 'general.moneda'
 */

import prisma from '../config/database';

export const configuracionRestauranteRepository = {

  findAll: (id_restaurante: number) =>
    prisma.configuracionRestaurante.findMany({
      where: { id_restaurante },
      orderBy: { clave: 'asc' },
    }),

  findByClave: (id_restaurante: number, clave: string) =>
    prisma.configuracionRestaurante.findUnique({
      where: { id_restaurante_clave: { id_restaurante, clave } },
    }),

  upsert: (id_restaurante: number, clave: string, valor: string) =>
    prisma.configuracionRestaurante.upsert({
      where:  { id_restaurante_clave: { id_restaurante, clave } },
      update: { valor },
      create: { id_restaurante, clave, valor },
    }),

  delete: (id_restaurante: number, clave: string) =>
    prisma.configuracionRestaurante.delete({
      where: { id_restaurante_clave: { id_restaurante, clave } },
    }),

  upsertMany: async (id_restaurante: number, items: { clave: string; valor: string }[]) =>
    prisma.$transaction(
      items.map(({ clave, valor }) =>
        prisma.configuracionRestaurante.upsert({
          where:  { id_restaurante_clave: { id_restaurante, clave } },
          update: { valor },
          create: { id_restaurante, clave, valor },
        })
      )
    ),
};
