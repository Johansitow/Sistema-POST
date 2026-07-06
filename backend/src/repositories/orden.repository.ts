/**
 * OrdenRepository — extiende TenantRepository para aislamiento de tenant.
 *
 * findByIdScoped(id, ctx): lookup guardado — NotFoundError si la orden no
 * existe O es de otro restaurante. ForbiddenError si ctx no tiene tenant.
 * Superadmin: accede sin restricción.
 *
 * findDetalleById(id): lookup raw de detalle (sin filtro de tenant — el tenant
 * se valida vía la orden padre, igual que ítems/fases en oleadas anteriores).
 *
 * API pública idéntica a la versión anterior (retrocompatible).
 */

import { TipoOrden, EstadoOrdenGlobal } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import { TenantRepository } from './base/TenantRepository';
import type { TenantCtx } from '../lib/tenantCtx';
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

/** Include completo de una Orden (legado + nueva arquitectura). Reusado por findById
 *  y por servicios que necesitan la orden completa desde dentro de una transacción
 *  (ej. ordenService.crear(), que debe leer vía `tx` antes del commit). */
export const includeOrdenCompleta = {
  ...includeCompleto,
  ...includeSedes,
  factura: true,
  eventos: { orderBy: { creado_en: 'asc' as const } },
};

class OrdenRepositoryImpl extends TenantRepository {
  constructor() {
    super(prisma);
  }

  findAll(
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
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  }

  findById(id: number) {
    return prisma.orden.findUnique({
      where: { id },
      include: includeOrdenCompleta,
    });
  }

  /**
   * Lookup guardado: verifica que la orden pertenece al tenant del ctx.
   * NotFoundError si no existe o es de otro restaurante.
   * ForbiddenError si ctx no tiene restauranteId y no es superadmin.
   */
  findByIdScoped(id: number, ctx: TenantCtx) {
    return this._scopedLookup(
      (i) => prisma.orden.findUnique({
        where: { id: i },
        include: includeOrdenCompleta,
      }),
      id,
      ctx,
      'id_restaurante',
    );
  }

  findUltima() {
    return prisma.orden.findFirst({ orderBy: { numero_orden: 'desc' } });
  }

  // ── Nueva arquitectura ──────────────────────────────────────────────────────

  updateEstadoGlobal(id: number, estado_global: EstadoOrdenGlobal, extraData?: Partial<{
    fecha_confirmacion: Date;
    fecha_entrega:      Date;
    fecha_cancelacion:  Date;
  }>) {
    return prisma.orden.update({
      where: { id },
      data: { estado_global, ...extraData },
      include: { ...includeBasico, ...includeSedes },
    });
  }

  updateTotalesGlobal(id: number, data: {
    subtotal:  Decimal;
    descuento: Decimal;
    impuestos: Decimal;
    propina:   Decimal;
    total:     Decimal;
  }) {
    return prisma.orden.update({ where: { id }, data });
  }

  registrarEvento(data: {
    id_orden:    number;
    tipo_evento: string;
    payload:     object;
    id_usuario?: number;
  }) {
    return prisma.ordenEvento.create({ data });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create(data: any) {
    return prisma.orden.create({ data, include: includeBasico });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update(id: number, data: any) {
    return prisma.orden.update({ where: { id }, data, include: includeBasico });
  }

  updateEstado(id: number, id_estado: number) {
    return prisma.orden.update({ where: { id }, data: { id_estado }, include: includeBasico });
  }

  updateTotales(id: number, data: { subtotal: Decimal; impuestos: Decimal; total: Decimal }) {
    return prisma.orden.update({ where: { id }, data });
  }

  delete(id: number) {
    return prisma.orden.delete({ where: { id } });
  }

  // ── Detalles (legado) ───────────────────────────────────────────────────────

  /** Lookup raw de detalle (tenant validado vía orden padre). */
  findDetalleById(id: number) {
    return prisma.ordenDetalle.findUnique({ where: { id }, include: { producto: true } });
  }

  findDetallesByOrden(id_orden: number) {
    return prisma.ordenDetalle.findMany({ where: { id_orden } });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createDetalle(data: any) {
    return prisma.ordenDetalle.create({ data, include: { producto: true } });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateDetalle(id: number, data: any) {
    return prisma.ordenDetalle.update({ where: { id }, data, include: { producto: true } });
  }

  deleteDetalle(id: number) {
    return prisma.ordenDetalle.delete({ where: { id } });
  }

  deleteDetallesByOrden(id_orden: number) {
    return prisma.ordenDetalle.deleteMany({ where: { id_orden } });
  }

  // ── Estadísticas ────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  count(where: any) {
    return prisma.orden.count({ where });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aggregate(where: any) {
    return prisma.orden.aggregate({
      where,
      _sum: { total: true },
      _avg: { total: true },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupByEstado(where: any) {
    return prisma.orden.groupBy({ by: ['id_estado'],  where, _count: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupByTipo(where: any) {
    return prisma.orden.groupBy({ by: ['tipo_orden'], where, _count: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupByFecha(where: any) {
    return prisma.orden.groupBy({
      by: ['fecha_apertura', 'tipo_orden'],
      where,
      _sum: { total: true },
      _count: true,
      orderBy: { fecha_apertura: 'asc' },
    });
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────

  countHoy(gte: Date, lt: Date, id_restaurante?: number) {
    return prisma.orden.count({ where: {
      fecha_apertura: { gte, lt },
      ...(id_restaurante ? { id_restaurante } : {}),
    } });
  }

  aggregateVentasHoy(id_estado: number, gte: Date, lt: Date, id_restaurante?: number) {
    return prisma.orden.aggregate({
      where: {
        id_estado, fecha_apertura: { gte, lt },
        ...(id_restaurante ? { id_restaurante } : {}),
      },
      _sum: { total: true },
    });
  }

  groupByFechaSemana(id_estado: number, gte: Date, id_restaurante?: number) {
    return prisma.orden.groupBy({
      by: ['fecha_apertura'],
      where: {
        id_estado, fecha_apertura: { gte },
        ...(id_restaurante ? { id_restaurante } : {}),
      },
      _sum: { total: true },
      orderBy: { fecha_apertura: 'asc' },
    });
  }

  topProductos(id_estado: number, take: number, id_restaurante?: number) {
    return prisma.ordenDetalle.groupBy({
      by: ['id_producto'],
      where: { orden: { id_estado, ...(id_restaurante ? { id_restaurante } : {}) } },
      _sum: { cantidad: true, subtotal: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take,
    });
  }
}

export const ordenRepository = new OrdenRepositoryImpl();
