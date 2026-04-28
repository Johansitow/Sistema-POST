/**
 * OrdenGrupoRepository — Órdenes multi-restaurante
 */

import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import { PaginationParams, getSkip } from '../lib/pagination';

const includeCompleto = {
  grupo:   { select: { id: true, nombre: true } },
  usuario: { select: { id: true, nombre_completo: true, usuario: true } },
  ordenes: {
    include: {
      estado:      { select: { id: true, nombre: true, codigo: true, color: true } },
      restaurante: { select: { id: true, nombre: true } },
      detalles:    { include: { producto: { select: { id: true, nombre: true, sku: true } } } },
    },
  },
  pagos: {
    include: { metodo_pago: { select: { id: true, nombre: true, codigo: true } } },
  },
};

export const ordenGrupoRepository = {

  findAll: (
    pagination: PaginationParams,
    filters: {
      id_grupo?:  number;
      id_usuario?: number;
      estado?:    string;
      desde?:     Date;
      hasta?:     Date;
    }
  ) => {
    const where = {
      ...(filters.id_grupo  ? { id_grupo:  filters.id_grupo  } : {}),
      ...(filters.id_usuario ? { id_usuario: filters.id_usuario } : {}),
      ...(filters.estado    ? { estado:    filters.estado    } : {}),
      ...(filters.desde || filters.hasta ? {
        fecha_creacion: {
          ...(filters.desde ? { gte: filters.desde } : {}),
          ...(filters.hasta ? { lte: filters.hasta } : {}),
        },
      } : {}),
    };
    return Promise.all([
      prisma.ordenGrupo.findMany({
        where,
        include: includeCompleto,
        orderBy: { fecha_creacion: 'desc' },
        skip:    getSkip(pagination),
        take:    pagination.limit,
      }),
      prisma.ordenGrupo.count({ where }),
    ]);
  },

  findById: (id: number) =>
    prisma.ordenGrupo.findUnique({ where: { id }, include: includeCompleto }),

  findByNumero: (numero_grupo: string) =>
    prisma.ordenGrupo.findUnique({ where: { numero_grupo }, include: includeCompleto }),

  findUltimo: () =>
    prisma.ordenGrupo.findFirst({ orderBy: { numero_grupo: 'desc' }, select: { numero_grupo: true } }),

  create: (data: {
    numero_grupo: string;
    id_grupo:     number;
    id_usuario:   number;
    notas?:       string;
  }) =>
    prisma.ordenGrupo.create({ data, include: includeCompleto }),

  /** Recalcula y guarda los totales consolidados del grupo */
  recalcularTotales: async (id: number) => {
    const ordenes = await prisma.orden.findMany({
      where:  { id_orden_grupo: id },
      select: { subtotal: true, descuento: true, impuestos: true, total: true },
    });
    const totales = ordenes.reduce(
      (acc, o) => ({
        subtotal:  acc.subtotal.plus(o.subtotal),
        descuento: acc.descuento.plus(o.descuento),
        impuestos: acc.impuestos.plus(o.impuestos),
        total:     acc.total.plus(o.total),
      }),
      { subtotal: new Decimal(0), descuento: new Decimal(0), impuestos: new Decimal(0), total: new Decimal(0) }
    );
    return prisma.ordenGrupo.update({ where: { id }, data: totales });
  },

  updateEstado: (id: number, estado: string, fecha_cierre?: Date) =>
    prisma.ordenGrupo.update({
      where: { id },
      data:  { estado, ...(fecha_cierre ? { fecha_cierre } : {}) },
    }),

  agregarPago: (data: {
    id_orden_grupo: number;
    id_metodo_pago: number;
    monto:          Decimal;
    referencia?:    string;
  }) =>
    prisma.pagoGrupo.create({
      data,
      include: { metodo_pago: { select: { id: true, nombre: true, codigo: true } } },
    }),

  sumPagos: (id_orden_grupo: number) =>
    prisma.pagoGrupo.aggregate({
      where: { id_orden_grupo },
      _sum:  { monto: true },
    }),
};
