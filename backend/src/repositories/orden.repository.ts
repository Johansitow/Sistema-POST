/**
 * OrdenRepository - queries Prisma para órdenes
 *
 * Soporta tanto el modelo legado (Orden + OrdenDetalle) como el nuevo
 * (Orden + OrdenSede + OrdenSedeItem + PagoOrden).
 */

import { TipoOrden, EstadoOrdenGlobal } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import { PaginationParams, getSkip } from '../lib/pagination';

// Include legado (mantener para backwards compat)
const includeBasico = {
  estado: true,
  usuario: { select: { id: true, nombre_completo: true, email: true } },
  detalles: { include: { producto: true } },
};

const includeCompleto = {
  ...includeBasico,
  pagos: { include: { metodo_pago: true } },
};

// Include nueva arquitectura
const includeSedes = {
  sedes: {
    include: {
      restaurante: { select: { id: true, nombre: true, logo_url: true, direccion: true, telefono: true } },
      items: {
        include: {
          producto: { select: { id: true, nombre: true, sku: true, unidad_medida: true } },
          variante: { select: { id: true, nombre: true } },
        },
      },
    },
  },
  pagos_orden: { include: { metodo_pago: { select: { id: true, nombre: true, codigo: true, icono: true } } } },
  cliente: { select: { id: true, nombre_completo: true, email: true, telefono: true } },
};

export const ordenRepository = {
  findAll: (
    pagination: PaginationParams,
    filters: {
      tipo_orden?:      TipoOrden;
      id_estado?:       number;
      estado_global?:   EstadoOrdenGlobal;
      fecha_desde?:     Date;
      fecha_hasta?:     Date;
      id_restaurante?:  number;
      id_grupo?:        number;
    }
  ) => {
    const where: any = {};
    if (filters.tipo_orden)     where.tipo_orden     = filters.tipo_orden;
    if (filters.id_estado)      where.id_estado      = filters.id_estado;
    if (filters.estado_global)  where.estado_global  = filters.estado_global;
    if (filters.id_restaurante) where.id_restaurante = filters.id_restaurante;
    if (filters.id_grupo)       where.id_grupo       = filters.id_grupo;
    if (filters.fecha_desde || filters.fecha_hasta) {
      where.fecha_apertura = {};
      if (filters.fecha_desde) where.fecha_apertura.gte = filters.fecha_desde;
      if (filters.fecha_hasta) where.fecha_apertura.lte = filters.fecha_hasta;
    }

    return Promise.all([
      prisma.orden.findMany({
        where,
        include: { ...includeBasico, ...includeSedes },
        orderBy: { fecha_apertura: 'desc' },
        skip: getSkip(pagination),
        take: pagination.limit,
      }),
      prisma.orden.count({ where }),
    ]);
  },

  findById: (id: number) =>
    prisma.orden.findUnique({
      where: { id },
      include: { ...includeCompleto, ...includeSedes, factura: true, eventos: { orderBy: { creado_en: 'asc' } } },
    }),

  findUltima: () =>
    prisma.orden.findFirst({ orderBy: { numero_orden: 'desc' } }),

  // ── Nueva arquitectura ────────────────────────────────────────────────────

  updateEstadoGlobal: (id: number, estado_global: EstadoOrdenGlobal, extraData?: Partial<{
    fecha_confirmacion: Date;
    fecha_entrega:      Date;
    fecha_cancelacion:  Date;
  }>) =>
    prisma.orden.update({
      where: { id },
      data: { estado_global, ...extraData },
      include: { ...includeBasico, ...includeSedes },
    }),

  updateTotalesGlobal: (id: number, data: {
    subtotal:  Decimal;
    descuento: Decimal;
    impuestos: Decimal;
    propina:   Decimal;
    total:     Decimal;
  }) => prisma.orden.update({ where: { id }, data }),

  registrarEvento: (data: {
    id_orden:   number;
    tipo_evento: string;
    payload:    object;
    id_usuario?: number;
  }) => prisma.ordenEvento.create({ data }),

  create: (data: any) =>
    prisma.orden.create({ data, include: includeBasico }),

  update: (id: number, data: any) =>
    prisma.orden.update({ where: { id }, data, include: includeBasico }),

  updateEstado: (id: number, id_estado: number) =>
    prisma.orden.update({ where: { id }, data: { id_estado }, include: includeBasico }),

  updateTotales: (id: number, data: { subtotal: Decimal; impuestos: Decimal; total: Decimal }) =>
    prisma.orden.update({ where: { id }, data }),

  delete: (id: number) =>
    prisma.orden.delete({ where: { id } }),

  // Detalles
  findDetalleById: (id: number) =>
    prisma.ordenDetalle.findUnique({ where: { id }, include: { producto: true } }),

  findDetallesByOrden: (id_orden: number) =>
    prisma.ordenDetalle.findMany({ where: { id_orden } }),

  createDetalle: (data: any) =>
    prisma.ordenDetalle.create({ data, include: { producto: true } }),

  updateDetalle: (id: number, data: any) =>
    prisma.ordenDetalle.update({ where: { id }, data, include: { producto: true } }),

  deleteDetalle: (id: number) =>
    prisma.ordenDetalle.delete({ where: { id } }),

  deleteDetallesByOrden: (id_orden: number) =>
    prisma.ordenDetalle.deleteMany({ where: { id_orden } }),

  // Estadísticas
  count: (where: any)     => prisma.orden.count({ where }),
  aggregate: (where: any) => prisma.orden.aggregate({
    where,
    _sum: { total: true },
    _avg: { total: true },
  }),
  groupByEstado: (where: any) =>
    prisma.orden.groupBy({ by: ['id_estado'],   where, _count: true }),
  groupByTipo: (where: any) =>
    prisma.orden.groupBy({ by: ['tipo_orden'],  where, _count: true }),
  groupByFecha: (where: any) =>
    prisma.orden.groupBy({
      by: ['fecha_apertura', 'tipo_orden'],
      where,
      _sum: { total: true },
      _count: true,
      orderBy: { fecha_apertura: 'asc' },
    }),

  // Dashboard
  countHoy: (gte: Date, lt: Date, id_restaurante?: number) =>
    prisma.orden.count({ where: {
      fecha_apertura: { gte, lt },
      ...(id_restaurante ? { id_restaurante } : {}),
    } }),
  aggregateVentasHoy: (id_estado: number, gte: Date, lt: Date, id_restaurante?: number) =>
    prisma.orden.aggregate({
      where: {
        id_estado, fecha_apertura: { gte, lt },
        ...(id_restaurante ? { id_restaurante } : {}),
      },
      _sum: { total: true },
    }),
  groupByFechaSemana: (id_estado: number, gte: Date, id_restaurante?: number) =>
    prisma.orden.groupBy({
      by: ['fecha_apertura'],
      where: {
        id_estado, fecha_apertura: { gte },
        ...(id_restaurante ? { id_restaurante } : {}),
      },
      _sum: { total: true },
      orderBy: { fecha_apertura: 'asc' },
    }),
  topProductos: (id_estado: number, take: number, id_restaurante?: number) =>
    prisma.ordenDetalle.groupBy({
      by: ['id_producto'],
      where: { orden: { id_estado, ...(id_restaurante ? { id_restaurante } : {}) } },
      _sum: { cantidad: true, subtotal: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take,
    }),
};
