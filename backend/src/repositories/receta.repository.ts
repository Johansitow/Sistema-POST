/**
 * RecetaRepository — extiende TenantRepository para aislamiento de tenant.
 *
 * findByIdScoped(id, ctx): lookup guardado — NotFoundError si la receta no
 * existe O es de otro restaurante. ForbiddenError si ctx no tiene tenant.
 * Superadmin: accede sin restricción.
 *
 * API pública idéntica a la versión anterior (retrocompatible).
 */

import prisma from '../config/database';
import { TenantRepository } from './base/TenantRepository';
import type { TenantCtx } from '../lib/tenantCtx';

// Precios de compra del insumo — única fuente válida para calcular rentabilidad.
// Preferido primero; el service toma el primero disponible.
const proveedorPreciosSelect = {
  where:   { estado: 'activo' as never },
  select:  { precio_unitario: true, es_proveedor_preferido: true },
  orderBy: { es_proveedor_preferido: 'desc' as never },
  take:    5,
} as const;

const ingredienteSelect = {
  include: {
    producto: {
      select: { id: true, nombre: true, sku: true, precio_unitario: true,
                unidad_medida: true, stock_actual: true, tipo_materia: true,
                proveedor_productos: proveedorPreciosSelect },
    },
  },
  orderBy: { orden: 'asc' as const },
};

// Include reutilizado en findById y findByIdScoped
const recetaFullInclude = {
  producto_final: true,
  ingredientes:   ingredienteSelect,
  fases:          { orderBy: { numero_fase: 'asc' as const }, where: { estado: 'activo' } },
} as const;

// Include reutilizado en findRecetaConStock y findRecetasVendiblesConStock
const disponibilidadInclude = {
  producto_final: {
    select: { id: true, nombre: true, sku: true, unidad_medida: true, stock_actual: true, es_vendible: true },
  },
  ingredientes: {
    include: {
      producto: {
        select: { id: true, nombre: true, sku: true, stock_actual: true, unidad_medida: true },
      },
    },
    orderBy: { orden: 'asc' as const },
  },
} as const;

class RecetaRepositoryImpl extends TenantRepository {
  constructor() {
    super(prisma);
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  findAll(params: { skip: number; take: number; id_producto?: number; estado?: string; id_restaurante?: number }) {
    const where = {
      ...(params.id_producto    && { id_producto_final: params.id_producto }),
      ...(params.estado         && { estado: params.estado as never }),
      // Recetas son POR SEDE: cada sucursal solo ve y gestiona las suyas
      ...(params.id_restaurante && { id_restaurante: params.id_restaurante }),
    };
    return prisma.$transaction([
      prisma.receta.findMany({
        skip: params.skip, take: params.take,
        where,
        include: {
          producto_final: {
            select: { id: true, nombre: true, sku: true, precio_venta: true,
                      precio_unitario: true, unidad_medida: true },
          },
          ingredientes: ingredienteSelect,
          fases: { orderBy: { numero_fase: 'asc' }, where: { estado: 'activo' } },
        },
        orderBy: { fecha_creacion: 'desc' },
      }),
      prisma.receta.count({ where }),
    ]);
  }

  /** Lookup sin filtro de tenant — solo para uso interno o lectura pública. */
  findById(id: number) {
    return prisma.receta.findUnique({
      where: { id },
      include: recetaFullInclude,
    });
  }

  /**
   * Lookup guardado: verifica que la receta pertenece al tenant del ctx.
   * NotFoundError si no existe o es de otro restaurante.
   * ForbiddenError si ctx no tiene restauranteId y no es superadmin.
   */
  findByIdScoped(id: number, ctx: TenantCtx) {
    return this._scopedLookup(
      (i) => prisma.receta.findUnique({ where: { id: i }, include: recetaFullInclude }),
      id,
      ctx,
      'id_restaurante',
    );
  }

  findByProductoFinal(id_producto: number, id_restaurante?: number) {
    return prisma.receta.findFirst({
      where: {
        id_producto_final: id_producto,
        estado: 'activo',
        ...(id_restaurante ? { id_restaurante } : {}),
      },
      include: {
        ingredientes: {
          include: {
            producto: { include: { proveedor_productos: proveedorPreciosSelect } },
          },
          orderBy: { orden: 'asc' },
        },
        fases: { orderBy: { numero_fase: 'asc' }, where: { estado: 'activo' } },
      },
    });
  }

  // ── Mutaciones de receta ──────────────────────────────────────────────────

  create(data: {
    id_producto_final:              number;
    id_restaurante:                 number;
    nombre_receta:                  string;
    descripcion?:                   string;
    cantidad_producida:             number;
    unidad_produccion:              string;
    tiempo_preparacion?:            number;
    instrucciones?:                 string;
    instrucciones_almacenamiento?:  string;
    notas?:                         string;
    merma_esperada_porcentaje?:     number;
    merma_maxima_porcentaje?:       number;
    medio_refrigeracion?:           string;
    ingredientes: {
      id_producto:          number;
      cantidad:             number;
      unidad:               string;
      es_opcional?:         boolean;
      notas?:               string;
      orden?:               number;
      numero_fase?:         number;
      tipo_formula?:        string;
      factor_formula?:      number;
      id_ingrediente_base?: number;
      formula_descripcion?: string;
    }[];
    fases?: {
      numero_fase:                number;
      nombre:                     string;
      descripcion:                string;
      duracion_minutos?:          number;
      merma_esperada_porcentaje?: number;
    }[];
  }) {
    return prisma.receta.create({
      data: {
        producto_final:                 { connect: { id: data.id_producto_final } },
        restaurante:                    { connect: { id: data.id_restaurante } },
        nombre_receta:                  data.nombre_receta,
        descripcion:                    data.descripcion,
        cantidad_producida:             data.cantidad_producida,
        unidad_produccion:              data.unidad_produccion as never,
        tiempo_preparacion:             data.tiempo_preparacion,
        instrucciones:                  data.instrucciones,
        instrucciones_almacenamiento:   data.instrucciones_almacenamiento,
        notas:                          data.notas,
        merma_esperada_porcentaje:      data.merma_esperada_porcentaje,
        merma_maxima_porcentaje:        data.merma_maxima_porcentaje,
        medio_refrigeracion:            data.medio_refrigeracion,
        ingredientes: {
          create: data.ingredientes.map((ing, idx) => ({
            id_producto:          ing.id_producto,
            cantidad:             ing.cantidad,
            unidad:               ing.unidad as never,
            es_opcional:          ing.es_opcional ?? false,
            notas:                ing.notas,
            orden:                ing.orden ?? idx,
            numero_fase:          ing.numero_fase,
            tipo_formula:         ing.tipo_formula as never,
            factor_formula:       ing.factor_formula,
            id_ingrediente_base:  ing.id_ingrediente_base,
            formula_descripcion:  ing.formula_descripcion,
          })),
        },
        ...(data.fases && data.fases.length > 0 ? {
          fases: {
            create: data.fases.map((f) => ({
              numero_fase:                f.numero_fase,
              nombre:                     f.nombre,
              descripcion:                f.descripcion,
              duracion_minutos:           f.duracion_minutos,
              merma_esperada_porcentaje:  f.merma_esperada_porcentaje,
            })),
          },
        } : {}),
      },
      include: {
        producto_final: true,
        ingredientes:   ingredienteSelect,
        fases:          { orderBy: { numero_fase: 'asc' } },
      },
    });
  }

  update(id: number, data: Partial<{
    nombre_receta:                  string;
    descripcion:                    string;
    cantidad_producida:             number;
    unidad_produccion:              string;
    tiempo_preparacion:             number;
    instrucciones:                  string;
    instrucciones_almacenamiento:   string;
    notas:                          string;
    merma_esperada_porcentaje:      number;
    merma_maxima_porcentaje:        number;
    estado:                         string;
  }>) {
    return prisma.receta.update({
      where: { id }, data: data as never,
      include: {
        producto_final: true,
        ingredientes:   ingredienteSelect,
        fases:          { orderBy: { numero_fase: 'asc' } },
      },
    });
  }

  /** Reemplaza ingredientes completamente dentro de una transacción. */
  reemplazarIngredientes(id_receta: number, ingredientes: {
    id_producto:          number;
    cantidad:             number;
    unidad:               string;
    es_opcional?:         boolean;
    notas?:               string;
    orden?:               number;
    numero_fase?:         number;
    tipo_formula?:        string;
    factor_formula?:      number;
    id_ingrediente_base?: number;
    formula_descripcion?: string;
  }[]) {
    return prisma.$transaction(async (tx) => {
      await tx.recetaIngrediente.deleteMany({ where: { id_receta } });
      await tx.recetaIngrediente.createMany({
        data: ingredientes.map((ing, idx) => ({
          id_receta,
          id_producto:          ing.id_producto,
          cantidad:             ing.cantidad,
          unidad:               ing.unidad as never,
          es_opcional:          ing.es_opcional ?? false,
          notas:                ing.notas,
          orden:                ing.orden ?? idx,
          numero_fase:          ing.numero_fase,
          tipo_formula:         ing.tipo_formula as never,
          factor_formula:       ing.factor_formula,
          id_ingrediente_base:  ing.id_ingrediente_base,
          formula_descripcion:  ing.formula_descripcion,
        })),
      });
      return tx.receta.findUnique({
        where: { id: id_receta },
        include: {
          producto_final: true,
          ingredientes:   ingredienteSelect,
          fases:          { orderBy: { numero_fase: 'asc' } },
        },
      });
    });
  }

  // ── Fases ─────────────────────────────────────────────────────────────────

  findFasesByReceta(id_receta: number) {
    return prisma.recetaFase.findMany({
      where:   { id_receta, estado: 'activo' },
      orderBy: { numero_fase: 'asc' },
    });
  }

  /** Lookup de fase por id (sin filtro de tenant — el tenant se valida vía la receta padre). */
  findFaseById(id: number) {
    return prisma.recetaFase.findUnique({ where: { id } });
  }

  createFase(data: {
    id_receta:                  number;
    numero_fase:                number;
    nombre:                     string;
    descripcion:                string;
    duracion_minutos?:          number;
    merma_esperada_porcentaje?: number;
  }) {
    return prisma.recetaFase.create({ data });
  }

  updateFase(id: number, data: Partial<{
    numero_fase:                number;
    nombre:                     string;
    descripcion:                string;
    duracion_minutos:           number;
    merma_esperada_porcentaje:  number;
    estado:                     string;
  }>) {
    return prisma.recetaFase.update({ where: { id }, data: data as never });
  }

  deleteFase(id: number) {
    return prisma.recetaFase.update({ where: { id }, data: { estado: 'eliminado' as never } });
  }

  // ── Rentabilidad con proveedores ──────────────────────────────────────────

  /** Trae la receta con los proveedores activos de cada ingrediente (preferido primero). */
  findByIdWithProveedores(id: number) {
    return prisma.receta.findUnique({
      where: { id },
      include: {
        producto_final: {
          select: { id: true, nombre: true, precio_venta: true, precio_unitario: true },
        },
        ingredientes: {
          include: {
            producto: { include: { proveedor_productos: proveedorPreciosSelect } },
          },
          orderBy: { orden: 'asc' },
        },
      },
    });
  }

  // ── Disponibilidad ────────────────────────────────────────────────────────

  findRecetaConStock(id_receta: number) {
    return prisma.receta.findUnique({
      where: { id: id_receta },
      include: disponibilidadInclude,
    });
  }

  /** Recetas de productos vendibles de una sede, con stock — usado para el catálogo de disponibilidad. */
  findRecetasVendiblesConStock(id_restaurante: number) {
    return prisma.receta.findMany({
      where: {
        id_restaurante,
        estado: 'activo' as never,
        producto_final: { es_vendible: true },
      },
      include: disponibilidadInclude,
    });
  }
}

export const recetaRepository = new RecetaRepositoryImpl();
