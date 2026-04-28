/**
 * VarianteService - Lógica de negocio para variantes de productos
 */

import { EstadoGeneral } from '@prisma/client';
import { varianteRepository } from '../repositories/variante.repository';
import { productoRepository } from '../repositories/producto.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../exceptions/HttpErrors';
import { toDecimal } from '../lib/decimal';
import { cacheGetOrSet, cacheDel, CACHE_TTL } from '../config/redis';

const keyVariantes = (id_producto: number) => `variantes:prod:${id_producto}`;
const keyVariante  = (id: number)           => `variante:${id}`;

export const varianteService = {
  async listarPorProducto(id_producto: number) {
    return cacheGetOrSet(
      keyVariantes(id_producto),
      CACHE_TTL.MID,
      () => varianteRepository.findAllByProducto(id_producto)
    );
  },

  async obtenerPorId(id: number) {
    const variante = await cacheGetOrSet(
      keyVariante(id),
      CACHE_TTL.MID,
      () => varianteRepository.findById(id)
    );
    if (!variante) throw new NotFoundError('Variante');
    return variante;
  },

  async crear(id_producto: number, data: {
    nombre: string;
    precio: number;
    sku?: string;
    atributos?: Record<string, unknown>;
    orden?: number;
    estado?: EstadoGeneral;
  }) {
    // Verificar que el producto existe
    const producto = await productoRepository.findById(id_producto);
    if (!producto) throw new NotFoundError('Producto');

    // Verificar SKU único entre variantes NO eliminadas
    // (las eliminadas ya tienen sku=null por diseño, así que findBySKU nunca las devuelve)
    if (data.sku) {
      const existeSKU = await varianteRepository.findBySKU(data.sku);
      if (existeSKU && existeSKU.estado !== EstadoGeneral.eliminado) {
        throw new ConflictError('Ya existe una variante activa con ese SKU');
      }
    }

    const variante = await varianteRepository.create({
      ...data,
      id_producto,
      precio: toDecimal(data.precio).toString(),
    });

    await cacheDel(keyVariantes(id_producto));
    return variante;
  },

  async actualizar(id: number, data: Partial<{
    nombre: string;
    precio: number;
    sku: string;
    atributos: Record<string, unknown>;
    orden: number;
    estado: EstadoGeneral;
  }>) {
    const existente = await this.obtenerPorId(id);

    if (data.sku && data.sku !== existente.sku) {
      const existeSKU = await varianteRepository.findBySKU(data.sku);
      if (existeSKU && existeSKU.estado !== EstadoGeneral.eliminado) {
        throw new ConflictError('Ya existe una variante activa con ese SKU');
      }
    }

    const updateData: any = { ...data };
    if (data.precio != null) updateData.precio = toDecimal(data.precio).toString();

    const variante = await varianteRepository.update(id, updateData);
    await cacheDel(keyVariante(id), keyVariantes(existente.id_producto));
    return variante;
  },

  async eliminar(id: number) {
    const existente = await this.obtenerPorId(id);
    await varianteRepository.softDelete(id);
    await cacheDel(keyVariante(id), keyVariantes(existente.id_producto));
  },

  async reordenar(id_producto: number, items: { id: number; orden: number }[]) {
    const variantes = await varianteRepository.findAllByProducto(id_producto);

    // Solo se consideran variantes activas (no eliminadas)
    const variantesActivas = variantes.filter(v => v.estado !== EstadoGeneral.eliminado);
    const ids_validos      = new Set(variantesActivas.map(v => v.id));
    const ids_enviados     = new Set(items.map(i => i.id));

    // 1. Ningún ID ajeno al producto
    for (const item of items) {
      if (!ids_validos.has(item.id)) {
        throw new BadRequestError(
          `La variante ${item.id} no pertenece al producto ${id_producto} o no está activa`,
        );
      }
    }

    // 2. Se deben incluir TODAS las variantes activas
    for (const v of variantesActivas) {
      if (!ids_enviados.has(v.id)) {
        throw new BadRequestError(
          `Falta la variante ${v.id} ("${v.nombre}"). Debes incluir todas las variantes activas en el reordenamiento.`,
        );
      }
    }

    // 3. Sin valores de orden duplicados
    const ordenes = items.map(i => i.orden);
    if (new Set(ordenes).size !== ordenes.length) {
      throw new BadRequestError('Los valores de orden no pueden repetirse');
    }

    // 4. Órdenes deben ser enteros no negativos
    if (ordenes.some(o => !Number.isInteger(o) || o < 0)) {
      throw new BadRequestError('Los valores de orden deben ser enteros no negativos');
    }

    await varianteRepository.reorder(items);
    await cacheDel(keyVariantes(id_producto));
  },
};
