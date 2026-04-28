/**
 * OrdenSedeRepository — queries Prisma para OrdenSede y OrdenSedeItem
 *
 * OrdenSede es la unidad operacional por restaurante dentro de una Orden global.
 * Este repositorio solo maneja data access; la lógica de negocio vive en orden-sede.service.ts.
 */

import { EstadoOrdenSede } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import { PaginationParams, getSkip } from '../lib/pagination';

// Include estándar para lectura de sede con ítems
const includeSedeBasico = {
  restaurante: { select: { id: true, nombre: true, logo_url: true, telefono: true, direccion: true } },
  items: {
    include: {
      producto: { select: { id: true, nombre: true, sku: true, unidad_medida: true } },
      variante: { select: { id: true, nombre: true } },
    },
  },
};

export const ordenSedeRepository = {

  // ── Consultas de sede ───────────────────────────────────────────────────────

  findById: (id: number) =>
    prisma.ordenSede.findUnique({ where: { id }, include: includeSedeBasico }),

  findByOrden: (id_orden: number) =>
    prisma.ordenSede.findMany({
      where: { id_orden },
      include: includeSedeBasico,
      orderBy: { sufijo: 'asc' },
    }),

  findByOrdenAndRestaurante: (id_orden: number, id_restaurante: number) =>
    prisma.ordenSede.findUnique({ where: { id_orden_id_restaurante: { id_orden, id_restaurante } } }),

  /** Vista de cocina: sedes activas de un restaurante, ordenadas por fecha de creación */
  findActivas: (
    id_restaurante: number,
    pagination: PaginationParams,
    filters: { estado?: EstadoOrdenSede; desde?: Date; hasta?: Date }
  ) => {
    const where: any = { id_restaurante };
    if (filters.estado) where.estado = filters.estado;
    else {
      // Por defecto, excluir estados finales
      where.estado = { in: [EstadoOrdenSede.PENDIENTE, EstadoOrdenSede.EN_PREPARACION, EstadoOrdenSede.LISTA] };
    }
    if (filters.desde || filters.hasta) {
      where.orden = { fecha_apertura: {} };
      if (filters.desde) where.orden.fecha_apertura.gte = filters.desde;
      if (filters.hasta) where.orden.fecha_apertura.lte = filters.hasta;
    }

    return Promise.all([
      prisma.ordenSede.findMany({
        where,
        include: {
          ...includeSedeBasico,
          orden: {
            select: {
              id: true, numero_orden: true, tipo_orden: true,
              fecha_apertura: true, estado_global: true,
              cliente: { select: { id: true, nombre_completo: true } },
            },
          },
        },
        orderBy: { id: 'asc' },
        skip: getSkip(pagination),
        take: pagination.limit,
      }),
      prisma.ordenSede.count({ where }),
    ]);
  },

  // ── Mutaciones de sede ──────────────────────────────────────────────────────

  updateEstado: (id: number, estado: EstadoOrdenSede, extraData?: Partial<{
    fecha_inicio_prep:  Date;
    fecha_lista:        Date;
    fecha_cancelacion:  Date;
    motivo_cancelacion: string;
  }>) =>
    prisma.ordenSede.update({
      where: { id },
      data: { estado, ...extraData },
      include: includeSedeBasico,
    }),

  updateTotales: (id: number, data: {
    subtotal:  Decimal;
    descuento: Decimal;
    impuestos: Decimal;
    total:     Decimal;
  }) => prisma.ordenSede.update({ where: { id }, data }),

  // ── Verificación de completitud (para saga de delivery) ─────────────────────

  /** Devuelve true si TODAS las sedes no-canceladas de la orden están en LISTA o ENTREGADA */
  todasListas: async (id_orden: number): Promise<boolean> => {
    const sedes = await prisma.ordenSede.findMany({
      where: { id_orden, estado: { not: EstadoOrdenSede.CANCELADA } },
      select: { estado: true },
    });
    if (sedes.length === 0) return false;
    return sedes.every(s =>
      s.estado === EstadoOrdenSede.LISTA || s.estado === EstadoOrdenSede.ENTREGADA
    );
  },

  // ── Items ───────────────────────────────────────────────────────────────────

  findItemById: (id: number) =>
    prisma.ordenSedeItem.findUnique({
      where: { id },
      include: {
        producto: true,
        variante: { select: { id: true, nombre: true, precio: true } },
      },
    }),

  findItemsBySede: (id_sede: number) =>
    prisma.ordenSedeItem.findMany({
      where: { id_sede },
      include: {
        producto: { select: { id: true, nombre: true, sku: true, unidad_medida: true } },
        variante: { select: { id: true, nombre: true } },
      },
    }),

  createItem: (data: {
    id_sede:        number;
    id_producto:    number;
    id_variante?:   number;
    cantidad:       Decimal;
    precio_unitario: Decimal;
    descuento:      Decimal;
    subtotal:       Decimal;
    total:          Decimal;
    notas?:         string;
  }) =>
    prisma.ordenSedeItem.create({
      data,
      include: {
        producto: true,
        variante: { select: { id: true, nombre: true } },
      },
    }),

  updateItem: (id: number, data: {
    cantidad?:  Decimal;
    subtotal?:  Decimal;
    total?:     Decimal;
    notas?:     string;
  }) =>
    prisma.ordenSedeItem.update({
      where: { id },
      data,
      include: { producto: true },
    }),

  deleteItem: (id: number) => prisma.ordenSedeItem.delete({ where: { id } }),

  deleteItemsBySede: (id_sede: number) =>
    prisma.ordenSedeItem.deleteMany({ where: { id_sede } }),

  // ── Recálculo de totales ─────────────────────────────────────────────────────

  /** Suma los items de la sede y recalcula subtotal/total. Llamar dentro de TX. */
  recalcularTotales: async (
    tx: any,
    id_sede: number,
    tasaIva: number | null
  ): Promise<{ subtotal: Decimal; impuestos: Decimal; total: Decimal }> => {
    const items = await tx.ordenSedeItem.findMany({ where: { id_sede } });
    const subtotal = items.reduce(
      (acc: Decimal, i: any) => acc.plus(i.subtotal),
      new Decimal(0)
    );
    const impuestos = tasaIva !== null
      ? subtotal.times(tasaIva / 100)
      : new Decimal(0);
    const total = subtotal.plus(impuestos);
    await tx.ordenSede.update({ where: { id: id_sede }, data: { subtotal, impuestos, total } });
    return { subtotal, impuestos, total };
  },
};
