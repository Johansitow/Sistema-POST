/**
 * ListaComprasRepository
 */

import { EstadoListaCompras } from '@prisma/client';
import prisma from '../config/database';
import { PaginationParams, getSkip } from '../lib/pagination';

const itemsInclude = {
  items: {
    include: {
      producto: {
        select: { id: true, nombre: true, sku: true, unidad_medida: true,
                  stock_actual: true, stock_minimo: true, stock_maximo: true },
      },
    },
  },
};

export const listaComprasRepository = {

  findAll: (
    pagination: PaginationParams,
    filters: {
      estado?:         EstadoListaCompras;
      id_proveedor?:   number;
      desde?:          Date;
      hasta?:          Date;
      id_restaurante?: number;
    }
  ) => {
    const where: any = {};
    if (filters.estado)         where.estado                = filters.estado;
    if (filters.id_proveedor)   where.id_proveedor_asignado = filters.id_proveedor;
    if (filters.id_restaurante) where.id_restaurante        = filters.id_restaurante;
    if (filters.desde || filters.hasta) {
      where.fecha_generacion = {
        ...(filters.desde && { gte: filters.desde }),
        ...(filters.hasta && { lte: filters.hasta }),
      };
    }

    return Promise.all([
      prisma.listaCompras.findMany({
        where,
        include: {
          usuario_generado:   { select: { id: true, nombre_completo: true } },
          proveedor_asignado: { select: { id: true, razon_social: true } },
          _count:             { select: { items: true } },
        },
        orderBy: { fecha_generacion: 'desc' },
        skip: getSkip(pagination),
        take: pagination.limit,
      }),
      prisma.listaCompras.count({ where }),
    ]);
  },

  findById: (id: number) =>
    prisma.listaCompras.findUnique({
      where: { id },
      include: {
        usuario_generado:   { select: { id: true, nombre_completo: true } },
        proveedor_asignado: true,
        ...itemsInclude,
      },
    }),

  findUltima: () =>
    prisma.listaCompras.findFirst({ orderBy: { numero_lista: 'desc' } }),

  create: (data: {
    numero_lista:           string;
    id_usuario_generado:    number;
    id_restaurante:         number;
    id_proveedor_asignado?: number;
    notas?:                 string;
    total_estimado?:        number;
    items: {
      id_producto:             number;
      id_proveedor_sugerido?:  number;
      cantidad_sugerida:       number;
      precio_estimado?:        number;
      observaciones?:          string;
    }[];
  }) =>
    prisma.listaCompras.create({
      data: {
        numero_lista:           data.numero_lista,
        id_usuario_generado:    data.id_usuario_generado,
        id_restaurante:         data.id_restaurante,
        id_proveedor_asignado:  data.id_proveedor_asignado,
        notas:                  data.notas,
        total_estimado:         data.total_estimado,
        items: {
          create: data.items.map((item) => ({
            id_producto:            item.id_producto,
            id_proveedor_sugerido:  item.id_proveedor_sugerido,
            cantidad_sugerida:      item.cantidad_sugerida,
            precio_estimado:        item.precio_estimado,
            observaciones:          item.observaciones,
          })),
        },
      },
      include: {
        usuario_generado:   { select: { id: true, nombre_completo: true } },
        proveedor_asignado: true,
        ...itemsInclude,
      },
    }),

  update: (id: number, data: Partial<{
    estado:                EstadoListaCompras;
    id_proveedor_asignado: number;
    notas:                 string;
    fecha_envio:           Date;
    fecha_recepcion:       Date;
    total_estimado:        number;
  }>) =>
    prisma.listaCompras.update({
      where: { id },
      data,
      include: {
        usuario_generado:   { select: { id: true, nombre_completo: true } },
        proveedor_asignado: true,
        ...itemsInclude,
      },
    }),

  updateItem: (id: number, data: Partial<{
    cantidad_recibida: number;
    observaciones:     string;
  }>) => prisma.listaComprasItem.update({ where: { id }, data }),
};
