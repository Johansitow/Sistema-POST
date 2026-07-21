/**
 * LoteRepository - Solo queries Prisma para lotes
 */

import { EstadoLote } from '@prisma/client';
import prisma from '../config/database';
import { PaginationParams, getSkip } from '../lib/pagination';

export const loteRepository = {

  findAll: (
    pagination: PaginationParams,
    filters: {
      id_producto?:    number;
      estado_lote?:    EstadoLote;
      vence_antes_de?: Date;
      id_restaurante?: number;
    }
  ) => {
    const where: any = {};
    if (filters.id_producto)    where.id_producto    = filters.id_producto;
    if (filters.estado_lote)    where.estado_lote    = filters.estado_lote;
    if (filters.id_restaurante) where.id_restaurante = filters.id_restaurante;
    if (filters.vence_antes_de) {
      where.fecha_vencimiento = { lte: filters.vence_antes_de };
    }

    return Promise.all([
      prisma.lote.findMany({
        where,
        include: {
          producto:    { include: { categoria: true } },
          responsable: { select: { id: true, nombre_completo: true, usuario: true } },
        },
        orderBy: { fecha_produccion: 'desc' },
        skip: getSkip(pagination),
        take: pagination.limit,
      }),
      prisma.lote.count({ where }),
    ]);
  },

  findById: (id: number) =>
    prisma.lote.findUnique({
      where: { id },
      include: {
        producto:    { include: { categoria: true } },
        responsable: { select: { id: true, nombre_completo: true, usuario: true } },
      },
    }),

  /**
   * findUltimo — busca el último lote creado para generar el número siguiente
   */
  findUltimo: () =>
    prisma.lote.findFirst({ orderBy: { numero_lote: 'desc' } }),

  create: (data: {
    numero_lote:              string;
    id_producto:              number;
    id_restaurante:           number;
    id_usuario_responsable?:  number;
    cantidad_producida:       any;
    fecha_vencimiento?:       Date;
    vida_util_dias?:          number;
    costo_produccion?:        any;
    merma_cantidad?:          any;
    merma_porcentaje?:        any;
    observaciones?:           string;
  }) =>
    prisma.lote.create({
      data,
      include: {
        producto:    true,
        responsable: { select: { id: true, nombre_completo: true, usuario: true } },
      },
    }),

  /** Lotes activos de un producto en un restaurante, para vincular una salida/merma a un lote existente */
  findActivosPorProducto: (id_producto: number, id_restaurante: number) =>
    prisma.lote.findMany({
      where: {
        id_producto,
        id_restaurante,
        estado_lote: { in: [EstadoLote.activo, EstadoLote.en_produccion] },
      },
      orderBy: { fecha_vencimiento: 'asc' },
    }),

  findByIdWithReceta: (id: number) =>
    prisma.lote.findUnique({
      where: { id },
      include: {
        producto: {
          include: {
            recetas_como_final: {
              where:   { estado: 'activo' as never },
              take:    1,
              include: {
                ingredientes: {
                  include: {
                    producto: {
                      include: {
                        proveedor_productos: {
                          where:   { estado: 'activo' as never },
                          select:  { precio_unitario: true, es_proveedor_preferido: true },
                          orderBy: { es_proveedor_preferido: 'desc' as never },
                          take: 5,
                        },
                      },
                    },
                  },
                  orderBy: { orden: 'asc' },
                },
              },
            },
          },
        },
        restaurante: { select: { id: true } },
      },
    }) as unknown as Promise<any>,

  update: (id: number, data: Partial<{
    estado_lote:           EstadoLote;
    fecha_vencimiento:     Date;
    fecha_cierre:          Date;
    fecha_ultimo_reconteo: Date;
    observaciones:         string;
    merma_cantidad:        any;
    merma_porcentaje:      any;
  }>) => prisma.lote.update({ where: { id }, data }),
};
