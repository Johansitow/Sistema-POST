/**
 * FacturaRepository - Solo queries Prisma para facturas
 */

import { EstadoFactura } from '@prisma/client';
import prisma from '../config/database';
import { PaginationParams, getSkip } from '../lib/pagination';

// Misma forma que includeSedes.sedes.items en orden.repository.ts — reutilizada para que
// el detalle de factura muestre los productos también en órdenes de arquitectura nueva.
const includeItemsSede = {
  include: {
    producto: { select: { id: true, nombre: true, sku: true } },
    variante: { select: { id: true, nombre: true } },
  },
};

export const facturaRepository = {

  findAll: (
    pagination: PaginationParams,
    filters: { estado_factura?: EstadoFactura; fecha_desde?: Date; fecha_hasta?: Date; id_restaurante?: number; search?: string }
  ) => {
    const where: any = {};
    if (filters.estado_factura) where.estado_factura = filters.estado_factura;
    if (filters.id_restaurante) where.orden = { id_restaurante: filters.id_restaurante };
    if (filters.fecha_desde || filters.fecha_hasta) {
      where.fecha_emision = {};
      if (filters.fecha_desde) where.fecha_emision.gte = filters.fecha_desde;
      if (filters.fecha_hasta) where.fecha_emision.lte = filters.fecha_hasta;
    }
    if (filters.search) {
      where.OR = [
        { numero_factura: { contains: filters.search, mode: 'insensitive' } },
        { orden: { numero_orden: { contains: filters.search, mode: 'insensitive' } } },
        { orden: { cliente: { nombre_completo: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }

    return Promise.all([
      prisma.factura.findMany({
        where,
        include: {
          orden: {
            include: {
              estado:  true,
              usuario: { select: { id: true, nombre_completo: true } },
              pagos:   { include: { metodo_pago: true } },
              cliente: { select: { id: true, nombre_completo: true, telefono: true } },
            },
          },
        },
        orderBy: { fecha_emision: 'desc' },
        skip: getSkip(pagination),
        take: pagination.limit,
      }),
      prisma.factura.count({ where }),
    ]);
  },

  findById: (id: number) =>
    prisma.factura.findUnique({
      where: { id },
      include: {
        orden: {
          include: {
            estado:   true,
            usuario:  { select: { id: true, nombre_completo: true } },
            detalles: { include: { producto: true } },
            pagos:    { include: { metodo_pago: true } },
            sedes:    { include: { items: includeItemsSede } },
          },
        },
      },
    }),

  findByOrden: (id_orden: number) =>
    prisma.factura.findUnique({
      where: { id_orden },
      include: {
        orden: {
          include: {
            detalles: { include: { producto: true } },
            pagos:    { include: { metodo_pago: true } },
            sedes:    { include: { items: includeItemsSede } },
          },
        },
      },
    }),

  /**
   * findUltima — busca la última factura para generar el número secuencial
   */
  findUltima: () =>
    prisma.factura.findFirst({ orderBy: { numero_factura: 'desc' } }),

  create: (data: {
    id_orden:       number;
    numero_factura: string;
    subtotal:       any;
    impuestos:      any;
    total:          any;
  }) => prisma.factura.create({ data }),

  update: (id: number, data: Partial<{
    estado_factura: EstadoFactura;
    fecha_pago:     Date;
  }>) => prisma.factura.update({ where: { id }, data }),
};
