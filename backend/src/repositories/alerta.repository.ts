/**
 * AlertaRepository - Solo queries Prisma para alertas y tipos de alerta
 */

import prisma from '../config/database';
import { PaginationParams, getSkip } from '../lib/pagination';

export const alertaRepository = {

  // ─── TipoAlerta (global — no tiene tenant) ───────────────────────────────────

  findTipoAll: () =>
    prisma.tipoAlerta.findMany({
      where:   { activo: true },
      orderBy: { nombre: 'asc' },
    }),

  findTipoByCodigo: (codigo: string) =>
    prisma.tipoAlerta.findFirst({ where: { codigo } }),

  findTipoById: (id: number) =>
    prisma.tipoAlerta.findUnique({ where: { id } }),

  createTipo: (data: {
    nombre:             string;
    codigo:             string;
    descripcion?:       string;
    icono?:             string;
    color?:             string;
    prioridad_default?: string;
  }) => prisma.tipoAlerta.create({ data }),

  updateTipo: (id: number, data: Partial<{
    nombre:             string;
    descripcion:        string;
    icono:              string;
    color:              string;
    prioridad_default:  string;
    activo:             boolean;
  }>) => prisma.tipoAlerta.update({ where: { id }, data }),

  // ─── Alertas (con aislamiento por restaurante) ───────────────────────────────

  findAll: (
    pagination: PaginationParams,
    filters: {
      id_restaurante:   number;   // obligatorio — aislamiento de tenant
      es_leida?:        boolean;
      nivel_prioridad?: string;
      id_tipo_alerta?:  number;
    }
  ) => {
    const where: any = { id_restaurante: filters.id_restaurante };
    if (filters.es_leida       !== undefined) where.es_leida       = filters.es_leida;
    if (filters.nivel_prioridad)              where.nivel_prioridad = filters.nivel_prioridad;
    if (filters.id_tipo_alerta)               where.id_tipo_alerta  = filters.id_tipo_alerta;

    return Promise.all([
      prisma.alerta.findMany({
        where,
        include: {
          tipo_alerta: true,
          producto:    { select: { id: true, nombre: true, sku: true, stock_actual: true, stock_minimo: true } },
        },
        orderBy: [{ es_leida: 'asc' }, { fecha_creacion: 'desc' }],
        skip: getSkip(pagination),
        take: pagination.limit,
      }),
      prisma.alerta.count({ where }),
    ]);
  },

  countNoLeidas: (id_restaurante: number) =>
    prisma.alerta.count({ where: { es_leida: false, id_restaurante } }),

  findActivaByProductoYTipo: (id_producto: number, id_tipo_alerta: number, id_restaurante: number) =>
    prisma.alerta.findFirst({
      where: { id_producto, id_tipo_alerta, es_leida: false, id_restaurante },
    }),

  create: (data: {
    id_tipo_alerta:  number;
    id_producto?:    number;
    id_restaurante:  number;   // obligatorio — toda alerta pertenece a una sede
    mensaje:         string;
    nivel_prioridad: string;
  }) => prisma.alerta.create({ data }),

  marcarLeida: (id: number) =>
    prisma.alerta.update({
      where: { id },
      data:  { es_leida: true, fecha_leida: new Date() },
    }),

  marcarTodasLeidas: (id_restaurante: number) =>
    prisma.alerta.updateMany({
      where: { es_leida: false, id_restaurante },
      data:  { es_leida: true, fecha_leida: new Date() },
    }),
};
