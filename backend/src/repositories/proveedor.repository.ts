/**
 * ProveedorRepository — extiende TenantRepository para aislamiento de tenant.
 *
 * findByIdScoped(id, ctx): lookup guardado con id_grupo — NotFoundError si el
 * proveedor no existe O es de otro grupo. ForbiddenError si ctx no tiene grupoId.
 * Superadmin: accede sin restricción.
 */

import { EstadoGeneral } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import { TenantRepository } from './base/TenantRepository';
import type { TenantCtx } from '../lib/tenantCtx';
import { PaginationParams, getSkip } from '../lib/pagination';

type DecimalLike = Decimal | number | string;

const includeProductos = {
  productos: {
    include: { producto: { include: { categoria: true } } },
    where: { estado: EstadoGeneral.activo },
  },
} as const;

class ProveedorRepositoryImpl extends TenantRepository {
  constructor() {
    super(prisma);
  }

  findAll(
    pagination: PaginationParams,
    filters: {
      id_grupo?: number | null;
      search?:   string;
      estado?:   EstadoGeneral;
    }
  ) {
    const where: Record<string, unknown> = { estado: { not: EstadoGeneral.eliminado } };
    if (filters.id_grupo != null) where.id_grupo = filters.id_grupo;
    if (filters.estado)           where.estado   = filters.estado;
    if (filters.search) {
      where.OR = [
        { razon_social:    { contains: filters.search, mode: 'insensitive' } },
        { nit:             { contains: filters.search, mode: 'insensitive' } },
        { contacto_nombre: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return Promise.all([
      prisma.proveedor.findMany({
        where,
        include: { _count: { select: { productos: true } } },
        orderBy: [{ calificacion: 'desc' }, { razon_social: 'asc' }],
        skip: getSkip(pagination),
        take: pagination.limit,
      }),
      prisma.proveedor.count({ where }),
    ]);
  }

  findById(id: number, id_grupo?: number | null) {
    return prisma.proveedor.findFirst({
      where: {
        id,
        estado: { not: EstadoGeneral.eliminado },
        ...(id_grupo != null ? { id_grupo } : {}),
      },
      include: includeProductos,
    });
  }

  /**
   * Lookup guardado: verifica que el proveedor pertenece al grupo del ctx.
   * NotFoundError si no existe o es de otro grupo.
   * ForbiddenError si ctx no tiene grupoId y no es superadmin.
   */
  findByIdScoped(id: number, ctx: TenantCtx) {
    return this._scopedLookup(
      (i) => prisma.proveedor.findFirst({
        where: { id: i, estado: { not: EstadoGeneral.eliminado } },
        include: includeProductos,
      }),
      id,
      ctx,
      'id_grupo',
    );
  }

  findByNit(nit: string, excludeId?: number) {
    return prisma.proveedor.findFirst({
      where: {
        nit,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
  }

  create(data: {
    razon_social:             string;
    id_grupo:                 number;
    nit?:                     string;
    contacto_nombre?:         string;
    contacto_telefono?:       string;
    contacto_whatsapp?:       string;
    contacto_email?:          string;
    sitio_web?:               string;
    direccion?:               string;
    ciudad?:                  string;
    calificacion?:            number;
    tiempo_entrega_promedio?: number;
  }) {
    return prisma.proveedor.create({ data });
  }

  update(id: number, data: Partial<{
    razon_social:             string;
    nit:                      string;
    contacto_nombre:          string;
    contacto_telefono:        string;
    contacto_whatsapp:        string;
    contacto_email:           string;
    sitio_web:                string;
    direccion:                string;
    ciudad:                   string;
    calificacion:             DecimalLike;
    tiempo_entrega_promedio:  number;
    estado:                   EstadoGeneral;
  }>) {
    return prisma.proveedor.update({ where: { id }, data });
  }

  // ─── ProveedorProducto ───────────────────────────────────────────────────────

  findProductosByProveedor(id_proveedor: number) {
    return prisma.proveedorProducto.findMany({
      where:   { id_proveedor, estado: EstadoGeneral.activo },
      include: { producto: { include: { categoria: true } } },
      orderBy: { producto: { nombre: 'asc' } },
    });
  }

  findProveedoresByProducto(id_producto: number) {
    return prisma.proveedorProducto.findMany({
      where:   { id_producto, estado: EstadoGeneral.activo },
      include: { proveedor: true },
      orderBy: [{ es_proveedor_preferido: 'desc' }, { precio_unitario: 'asc' }],
    });
  }

  findRelacion(id_proveedor: number, id_producto: number) {
    return prisma.proveedorProducto.findUnique({
      where: { id_proveedor_id_producto: { id_proveedor, id_producto } },
    });
  }

  createRelacion(data: {
    id_proveedor:            number;
    id_producto:             number;
    precio_unitario:         DecimalLike;
    tiempo_entrega?:         number;
    cantidad_minima?:        DecimalLike;
    es_proveedor_preferido?: boolean;
    calidad_calificacion?:   DecimalLike;
  }) {
    return prisma.proveedorProducto.create({ data, include: { producto: true, proveedor: true } });
  }

  updateRelacion(id_proveedor: number, id_producto: number, data: Partial<{
    precio_unitario:         DecimalLike;
    tiempo_entrega:          number;
    cantidad_minima:         DecimalLike;
    es_proveedor_preferido:  boolean;
    calidad_calificacion:    DecimalLike;
    fecha_ultima_entrega:    Date;
    estado:                  EstadoGeneral;
  }>) {
    return prisma.proveedorProducto.update({
      where: { id_proveedor_id_producto: { id_proveedor, id_producto } },
      data,
      include: { producto: true, proveedor: true },
    });
  }

  // ─── Scoring ─────────────────────────────────────────────────────────────────

  findParaScoring(id_proveedor: number) {
    return prisma.proveedor.findUnique({
      where: { id: id_proveedor },
      include: {
        productos: {
          where: { estado: EstadoGeneral.activo },
          select: {
            precio_unitario:      true,
            tiempo_entrega:       true,
            calidad_calificacion: true,
            id_producto:          true,
          },
        },
      },
    });
  }

  findCompetidoresByProducto(id_producto: number, excludeProveedorId: number) {
    return prisma.proveedorProducto.findMany({
      where: {
        id_producto,
        estado:       EstadoGeneral.activo,
        id_proveedor: { not: excludeProveedorId },
        proveedor:    { estado: { not: EstadoGeneral.eliminado } },
      },
      select: { precio_unitario: true, tiempo_entrega: true },
    });
  }

  findMejorProveedorParaProducto(id_producto: number) {
    return prisma.proveedorProducto.findFirst({
      where: {
        id_producto,
        estado:    EstadoGeneral.activo,
        proveedor: { estado: EstadoGeneral.activo },
      },
      include: { proveedor: true },
      orderBy: [{ es_proveedor_preferido: 'desc' }, { proveedor: { calificacion: 'desc' } }],
    });
  }
}

export const proveedorRepository = new ProveedorRepositoryImpl();
