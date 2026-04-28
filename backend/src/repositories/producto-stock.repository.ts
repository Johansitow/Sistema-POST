/**
 * ProductoStockRepository — Stock segregado por restaurante
 */

import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

const includeProducto = {
  producto: {
    select: {
      id: true, sku: true, nombre: true, unidad_medida: true,
      precio_unitario: true, stock_minimo: true, categoria: { select: { id: true, nombre: true } },
    },
  },
};

export const productoStockRepository = {

  /** Obtener el stock de todos los productos de un restaurante */
  findByRestaurante: (id_restaurante: number) =>
    prisma.productoStock.findMany({
      where:   { id_restaurante, activo: true },
      include: includeProducto,
      orderBy: { producto: { nombre: 'asc' } },
    }),

  /** Obtener el stock de un producto en un restaurante específico */
  findOne: (id_producto: number, id_restaurante: number) =>
    prisma.productoStock.findUnique({
      where:   { id_producto_id_restaurante: { id_producto, id_restaurante } },
      include: includeProducto,
    }),

  /** Obtener todos los productos con stock bajo el mínimo en un restaurante */
  findBajoMinimo: (id_restaurante: number) =>
    prisma.productoStock.findMany({
      where: {
        id_restaurante,
        activo: true,
        stock_minimo: { gt: 0 },
        // Prisma no soporta comparación entre columnas — usamos un raw approach simple
        // El servicio/job debe filtrar tras consultar
      },
      include: includeProducto,
    }),

  /** Crear o actualizar el registro de stock de un producto en un restaurante */
  upsert: (id_producto: number, id_restaurante: number, data: {
    stock_actual?:       Decimal | number;
    stock_minimo?:       Decimal | number;
    stock_maximo?:       Decimal | number;
    punto_reorden?:      Decimal | number;
    precio_venta_local?: Decimal | number;
    activo?:             boolean;
  }) =>
    prisma.productoStock.upsert({
      where:  { id_producto_id_restaurante: { id_producto, id_restaurante } },
      update: data as any,
      create: { id_producto, id_restaurante, ...data as any },
      include: includeProducto,
    }),

  /** Ajustar stock_actual de un producto en un restaurante */
  updateStock: (id_producto: number, id_restaurante: number, stock_actual: Decimal) =>
    prisma.productoStock.update({
      where: { id_producto_id_restaurante: { id_producto, id_restaurante } },
      data:  { stock_actual },
    }),

  /** Actualizar precio local de venta */
  updatePrecio: (id_producto: number, id_restaurante: number, precio_venta_local: Decimal) =>
    prisma.productoStock.update({
      where: { id_producto_id_restaurante: { id_producto, id_restaurante } },
      data:  { precio_venta_local },
    }),
};
