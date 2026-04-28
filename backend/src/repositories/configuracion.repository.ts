/**
 * ConfiguracionRepository
 * Maneja la tabla `configuracion` — clave/valor tipado para ajustes del sistema.
 */

import prisma from '../config/database';
import { TipoDato } from '@prisma/client';

export const configuracionRepository = {

  findAll: (categoria?: string) =>
    prisma.configuracion.findMany({
      where: categoria ? { categoria } : undefined,
      orderBy: [{ categoria: 'asc' }, { clave: 'asc' }],
    }),

  findByClave: (clave: string) =>
    prisma.configuracion.findUnique({ where: { clave } }),

  findByCategoria: (categoria: string) =>
    prisma.configuracion.findMany({
      where: { categoria },
      orderBy: { clave: 'asc' },
    }),

  update: (clave: string, valor: string) =>
    prisma.configuracion.update({
      where: { clave },
      data:  { valor },
    }),

  updateMany: (items: { clave: string; valor: string }[]) =>
    prisma.$transaction(
      items.map(item =>
        prisma.configuracion.update({ where: { clave: item.clave }, data: { valor: item.valor } })
      )
    ),

  create: (data: {
    clave:       string;
    valor:       string;
    tipo_dato?:  TipoDato;
    descripcion?: string;
    categoria:   string;
    es_editable?: boolean;
  }) => prisma.configuracion.create({ data }),

  // Helper: parsea el valor al tipo correcto
  parseValor: (config: { valor: string; tipo_dato: TipoDato }): unknown => {
    switch (config.tipo_dato) {
      case 'number':  return Number(config.valor);
      case 'boolean': return config.valor === 'true';
      case 'json':    try { return JSON.parse(config.valor); } catch { return config.valor; }
      default:        return config.valor;
    }
  },
};
