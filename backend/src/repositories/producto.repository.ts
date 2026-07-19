/**
 * ProductoRepository - Solo queries Prisma para productos
 */

import { EstadoGeneral } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import { PaginationParams, getSkip } from '../lib/pagination';

export interface ProductoData {
  codigo_barras?: string;
  sku: string;
  nombre: string;
  descripcion?: string;
  id_categoria?: number;
  tipo_materia: any;
  unidad_medida: any;
  precio_unitario: Decimal;
  precio_venta?: Decimal;
  stock_actual?: Decimal;
  stock_minimo?: Decimal;
  stock_maximo?: Decimal;
  punto_reorden?: Decimal;
  dias_vida_util?: number;
  requiere_refrigeracion?: boolean;
  imagen_url?: string;
  es_vendible?: boolean;
  estado?: EstadoGeneral;
}

const includeDefault = { categoria: true };
const includeDetalle = {
  categoria: true,
  movimientos: { orderBy: { fecha_movimiento: 'desc' as const }, take: 10 },
};

/**
 * Filtro de tenant para productos:
 * - id_grupo = undefined → superadmin, sin filtro
 * - id_grupo = N         → productos globales (id_grupo null) + los del grupo N
 */
function tenantWhere(id_grupo?: number | null) {
  if (id_grupo == null) return {};
  return { OR: [{ id_grupo: null as number | null }, { id_grupo }] };
}

export const productoRepository = {
  findAll: (
    pagination: PaginationParams,
    filters: {
      id_grupo?:       number | null;   // tenant scope (catálogo por grupo)
      id_restaurante?: number;          // incluye ProductoStock de esta sede
      search?:         string;
      id_categoria?:   number;
      estado?:         EstadoGeneral;
      es_vendible?:    boolean;
    }
  ) => {
    const where: any = {
      estado: { not: EstadoGeneral.eliminado },
      ...tenantWhere(filters.id_grupo),
    };
    if (filters.search) {
      where.AND = [
        { OR: [
          { nombre: { contains: filters.search, mode: 'insensitive' } },
          { sku:    { contains: filters.search, mode: 'insensitive' } },
        ]},
      ];
    }
    if (filters.id_categoria)             where.id_categoria = filters.id_categoria;
    if (filters.estado)                   where.estado       = filters.estado;
    if (filters.es_vendible !== undefined) where.es_vendible = filters.es_vendible;

    return Promise.all([
      prisma.producto.findMany({
        where,
        include: {
          ...includeDefault,
          ...(filters.id_restaurante
            ? { stocks: { where: { id_restaurante: filters.id_restaurante } } }
            : {}),
        },
        orderBy: { nombre: 'asc' },
        skip: getSkip(pagination),
        take: pagination.limit,
      }),
      prisma.producto.count({ where }),
    ]);
  },

  findById: (id: number, id_restaurante?: number) =>
    prisma.producto.findFirst({
      where: { id, estado: { not: EstadoGeneral.eliminado } },
      include: {
        ...includeDetalle,
        ...(id_restaurante
          ? { stocks: { where: { id_restaurante } } }
          : {}),
      },
    }),

  findBySKU: (sku: string) =>
    prisma.producto.findUnique({ where: { sku }, include: includeDefault }),

  findActivos: () =>
    prisma.producto.findMany({
      where: { estado: EstadoGeneral.activo },
      select: {
        id: true, nombre: true, sku: true,
        stock_actual: true, stock_minimo: true, precio_unitario: true,
        categoria: { select: { nombre: true } },
      },
      orderBy: { stock_actual: 'asc' },
    }),

  create: (data: ProductoData) =>
    prisma.producto.create({ data, include: includeDefault }),

  update: (id: number, data: Partial<ProductoData>) =>
    prisma.producto.update({ where: { id }, data, include: includeDefault }),

  updateStock: (id: number, stock_actual: Decimal) =>
    prisma.producto.update({ where: { id }, data: { stock_actual } }),

  softDelete: (id: number) =>
    prisma.producto.update({
      where: { id },
      data: { estado: EstadoGeneral.eliminado },
    }),

  count: (id_grupo?: number) =>
    prisma.producto.count({ where: { ...tenantWhere(id_grupo) } }),
  countByEstado: (estado: EstadoGeneral, id_grupo?: number) =>
    prisma.producto.count({ where: { estado, ...tenantWhere(id_grupo) } }),
};
