/**
 * OrdenSedeRepository — extiende TenantRepository para aislamiento de tenant.
 *
 * findByIdScoped(id, ctx): lookup guardado — NotFoundError si la sede no
 * existe O es de otro restaurante. ForbiddenError si ctx no tiene tenant.
 * Superadmin: accede sin restricción.
 *
 * findItemById(id): lookup raw de item (sin filtro de tenant — el tenant se
 * valida vía la sede padre, igual que RecetaFase en el piloto).
 *
 * API pública idéntica a la versión anterior (retrocompatible).
 */

import { EstadoOrdenSede } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import { TenantRepository } from './base/TenantRepository';
import type { TenantCtx } from '../lib/tenantCtx';
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

class OrdenSedeRepositoryImpl extends TenantRepository {
  constructor() {
    super(prisma);
  }

  // ── Consultas de sede ─────────────────────────────────────────────────────

  findById(id: number) {
    return prisma.ordenSede.findUnique({ where: { id }, include: includeSedeBasico });
  }

  /**
   * Lookup guardado: verifica que la sede pertenece al tenant del ctx.
   * NotFoundError si no existe o es de otro restaurante.
   * ForbiddenError si ctx no tiene restauranteId y no es superadmin.
   */
  findByIdScoped(id: number, ctx: TenantCtx) {
    return this._scopedLookup(
      (i) => prisma.ordenSede.findUnique({ where: { id: i }, include: includeSedeBasico }),
      id,
      ctx,
      'id_restaurante',
    );
  }

  findByOrden(id_orden: number) {
    return prisma.ordenSede.findMany({
      where: { id_orden },
      include: includeSedeBasico,
      orderBy: { sufijo: 'asc' },
    });
  }

  findByOrdenAndRestaurante(id_orden: number, id_restaurante: number) {
    return prisma.ordenSede.findUnique({
      where: { id_orden_id_restaurante: { id_orden, id_restaurante } },
    });
  }

  /** Vista de cocina: sedes activas de un restaurante, ordenadas por fecha de creación */
  findActivas(
    id_restaurante: number,
    pagination: PaginationParams,
    filters: { estado?: EstadoOrdenSede; desde?: Date; hasta?: Date },
  ) {
    const where: Record<string, unknown> = { id_restaurante };
    if (filters.estado) {
      where.estado = filters.estado;
    } else {
      where.estado = { in: [EstadoOrdenSede.PENDIENTE, EstadoOrdenSede.EN_PREPARACION, EstadoOrdenSede.LISTA] };
    }
    if (filters.desde || filters.hasta) {
      where.orden = { fecha_apertura: {} as Record<string, Date> };
      if (filters.desde) (where.orden as Record<string, Record<string, Date>>).fecha_apertura.gte = filters.desde;
      if (filters.hasta) (where.orden as Record<string, Record<string, Date>>).fecha_apertura.lte = filters.hasta;
    }

    return Promise.all([
      prisma.ordenSede.findMany({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: where as any,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.ordenSede.count({ where: where as any }),
    ]);
  }

  // ── Mutaciones de sede ────────────────────────────────────────────────────

  updateEstado(id: number, estado: EstadoOrdenSede, extraData?: Partial<{
    fecha_inicio_prep:  Date;
    fecha_lista:        Date;
    fecha_cancelacion:  Date;
    motivo_cancelacion: string;
  }>) {
    return prisma.ordenSede.update({
      where: { id },
      data: { estado, ...extraData },
      include: includeSedeBasico,
    });
  }

  updateTotales(id: number, data: {
    subtotal:  Decimal;
    descuento: Decimal;
    impuestos: Decimal;
    total:     Decimal;
  }) {
    return prisma.ordenSede.update({ where: { id }, data });
  }

  // ── Verificación de completitud (para saga de delivery) ──────────────────

  /** Devuelve true si TODAS las sedes no-canceladas de la orden están en LISTA o ENTREGADA */
  async todasListas(id_orden: number): Promise<boolean> {
    const sedes = await prisma.ordenSede.findMany({
      where: { id_orden, estado: { not: EstadoOrdenSede.CANCELADA } },
      select: { estado: true },
    });
    if (sedes.length === 0) return false;
    return sedes.every(s =>
      s.estado === EstadoOrdenSede.LISTA || s.estado === EstadoOrdenSede.ENTREGADA,
    );
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  /** Lookup raw de item (sin filtro de tenant — el tenant se valida vía la sede padre). */
  findItemById(id: number) {
    return prisma.ordenSedeItem.findUnique({
      where: { id },
      include: {
        producto: true,
        variante: { select: { id: true, nombre: true, precio: true } },
      },
    });
  }

  findItemsBySede(id_sede: number) {
    return prisma.ordenSedeItem.findMany({
      where: { id_sede },
      include: {
        producto: { select: { id: true, nombre: true, sku: true, unidad_medida: true } },
        variante: { select: { id: true, nombre: true } },
      },
    });
  }

  createItem(data: {
    id_sede:         number;
    id_producto:     number;
    id_variante?:    number;
    cantidad:        Decimal;
    precio_unitario: Decimal;
    descuento:       Decimal;
    subtotal:        Decimal;
    total:           Decimal;
    notas?:          string;
  }) {
    return prisma.ordenSedeItem.create({
      data,
      include: {
        producto: true,
        variante: { select: { id: true, nombre: true } },
      },
    });
  }

  updateItem(id: number, data: {
    cantidad?:  Decimal;
    subtotal?:  Decimal;
    total?:     Decimal;
    notas?:     string;
  }) {
    return prisma.ordenSedeItem.update({
      where: { id },
      data,
      include: { producto: true },
    });
  }

  deleteItem(id: number) {
    return prisma.ordenSedeItem.delete({ where: { id } });
  }

  deleteItemsBySede(id_sede: number) {
    return prisma.ordenSedeItem.deleteMany({ where: { id_sede } });
  }

  // ── Recálculo de totales ──────────────────────────────────────────────────

  /** Suma los items de la sede y recalcula subtotal/total. Llamar dentro de TX. */
  async recalcularTotales(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    id_sede: number,
    tasaIva: number | null,
  ): Promise<{ subtotal: Decimal; impuestos: Decimal; total: Decimal }> {
    const items = await tx.ordenSedeItem.findMany({ where: { id_sede } });
    const subtotal = items.reduce(
      (acc: Decimal, i: { subtotal: Decimal }) => acc.plus(i.subtotal),
      new Decimal(0),
    );
    const impuestos = tasaIva !== null
      ? subtotal.times(tasaIva / 100)
      : new Decimal(0);
    const total = subtotal.plus(impuestos);
    await tx.ordenSede.update({ where: { id: id_sede }, data: { subtotal, impuestos, total } });
    return { subtotal, impuestos, total };
  }
}

export const ordenSedeRepository = new OrdenSedeRepositoryImpl();
