/**
 * ProveedorRepository - Solo queries Prisma para proveedores
 */

import { EstadoGeneral } from '@prisma/client';
import prisma from '../config/database';
import { PaginationParams, getSkip } from '../lib/pagination';

export const proveedorRepository = {

  findAll: (
    pagination: PaginationParams,
    filters: {
      id_grupo?: number | null;   // tenant scope
      search?:   string;
      estado?:   EstadoGeneral;
    }
  ) => {
    const where: any = { estado: { not: EstadoGeneral.eliminado } };
    // Filtro de tenant: null = global (no debería haber proveedores sin grupo en producción)
    if (filters.id_grupo != null) where.id_grupo = filters.id_grupo;
    if (filters.estado) where.estado = filters.estado;
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
  },

  findById: (id: number, id_grupo?: number | null) =>
    prisma.proveedor.findFirst({
      where: {
        id,
        estado: { not: EstadoGeneral.eliminado },
        ...(id_grupo != null ? { id_grupo } : {}),
      },
      include: {
        productos: {
          include: { producto: { include: { categoria: true } } },
          where: { estado: EstadoGeneral.activo },
        },
      },
    }),

  findByNit: (nit: string, excludeId?: number) =>
    prisma.proveedor.findFirst({
      where: {
        nit,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    }),

  create: (data: {
    razon_social:             string;
    id_grupo:                 number;   // obligatorio — proveedor siempre del grupo
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
  }) => prisma.proveedor.create({ data }),

  update: (id: number, data: Partial<{
    razon_social:             string;
    nit:                      string;
    contacto_nombre:          string;
    contacto_telefono:        string;
    contacto_whatsapp:        string;
    contacto_email:           string;
    sitio_web:                string;
    direccion:                string;
    ciudad:                   string;
    calificacion:             any;
    tiempo_entrega_promedio:  number;
    estado:                   EstadoGeneral;
  }>) => prisma.proveedor.update({ where: { id }, data }),

  // ─── ProveedorProducto ───────────────────────────────────────────────────────

  findProductosByProveedor: (id_proveedor: number) =>
    prisma.proveedorProducto.findMany({
      where:   { id_proveedor, estado: EstadoGeneral.activo },
      include: { producto: { include: { categoria: true } } },
      orderBy: { producto: { nombre: 'asc' } },
    }),

  findProveedoresByProducto: (id_producto: number) =>
    prisma.proveedorProducto.findMany({
      where:   { id_producto, estado: EstadoGeneral.activo },
      include: { proveedor: true },
      orderBy: [{ es_proveedor_preferido: 'desc' }, { precio_unitario: 'asc' }],
    }),

  findRelacion: (id_proveedor: number, id_producto: number) =>
    prisma.proveedorProducto.findUnique({
      where: { id_proveedor_id_producto: { id_proveedor, id_producto } },
    }),

  createRelacion: (data: {
    id_proveedor:            number;
    id_producto:             number;
    precio_unitario:         any;
    tiempo_entrega?:         number;
    cantidad_minima?:        any;
    es_proveedor_preferido?: boolean;
    calidad_calificacion?:   any;
  }) => prisma.proveedorProducto.create({ data, include: { producto: true, proveedor: true } }),

  updateRelacion: (id_proveedor: number, id_producto: number, data: Partial<{
    precio_unitario:         any;
    tiempo_entrega:          number;
    cantidad_minima:         any;
    es_proveedor_preferido:  boolean;
    calidad_calificacion:    any;
    fecha_ultima_entrega:    Date;
    estado:                  EstadoGeneral;
  }>) =>
    prisma.proveedorProducto.update({
      where: { id_proveedor_id_producto: { id_proveedor, id_producto } },
      data,
      include: { producto: true, proveedor: true },
    }),

  // ─── Scoring ─────────────────────────────────────────────────────────────────

  findParaScoring: (id_proveedor: number) =>
    prisma.proveedor.findUnique({
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
    }),

  findCompetidoresByProducto: (id_producto: number, excludeProveedorId: number) =>
    prisma.proveedorProducto.findMany({
      where: {
        id_producto,
        estado:      EstadoGeneral.activo,
        id_proveedor: { not: excludeProveedorId },
        proveedor: { estado: { not: EstadoGeneral.eliminado } },
      },
      select: { precio_unitario: true, tiempo_entrega: true },
    }),

  findMejorProveedorParaProducto: (id_producto: number) =>
    prisma.proveedorProducto.findFirst({
      where: {
        id_producto,
        estado: EstadoGeneral.activo,
        proveedor: { estado: EstadoGeneral.activo },
      },
      include: { proveedor: true },
      orderBy: [{ es_proveedor_preferido: 'desc' }, { proveedor: { calificacion: 'desc' } }],
    }),
};
