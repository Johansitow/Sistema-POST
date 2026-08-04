/**
 * VarianteService - Lógica de negocio para variantes de productos
 */

import { EstadoGeneral } from '@prisma/client';
import { varianteRepository } from '../repositories/variante.repository';
import { productoRepository } from '../repositories/producto.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../exceptions/HttpErrors';
import { toDecimal } from '../lib/decimal';
import type { TenantCtx } from '../lib/tenantCtx';
import { cacheGetOrSet, cacheDel, CACHE_TTL } from '../config/redis';

const keyVariantes = (id_producto: number) => `variantes:prod:${id_producto}`;
const keyVariante  = (id: number)           => `variante:${id}`;

/**
 * Aislamiento multi-tenant de variantes: una variante hereda el tenant de su
 * producto padre. Un producto es accesible si es global (id_grupo null) o
 * pertenece al grupo del usuario. Ante un producto de otro grupo respondemos
 * NotFound (no revelamos su existencia), igual que TenantRepository._scopedLookup.
 * Devuelve el producto validado para evitar una segunda lectura en `crear`.
 */
async function assertAccesoProducto(id_producto: number, ctx: TenantCtx) {
  const producto = await productoRepository.findById(id_producto);
  if (!producto) throw new NotFoundError('Producto');
  if (!ctx.esSuperAdmin && producto.id_grupo != null && producto.id_grupo !== ctx.grupoId) {
    console.warn(
      `[TenantGuard] IDOR attempt: grupo ${ctx.grupoId} intentó acceder a variantes del ` +
      `producto ${id_producto} (id_grupo=${producto.id_grupo})`,
    );
    throw new NotFoundError('Producto');
  }
  return producto;
}

export const varianteService = {
  async listarPorProducto(id_producto: number, ctx: TenantCtx) {
    await assertAccesoProducto(id_producto, ctx);
    return cacheGetOrSet(
      keyVariantes(id_producto),
      CACHE_TTL.MID,
      () => varianteRepository.findAllByProducto(id_producto)
    );
  },

  async obtenerPorId(id: number, ctx: TenantCtx) {
    const variante = await cacheGetOrSet(
      keyVariante(id),
      CACHE_TTL.MID,
      () => varianteRepository.findById(id)
    );
    if (!variante) throw new NotFoundError('Variante');
    // La variante hereda el tenant del producto padre: validar acceso al grupo.
    await assertAccesoProducto(variante.id_producto, ctx);
    return variante;
  },

  async crear(id_producto: number, data: {
    nombre: string;
    precio: number;
    sku?: string;
    atributos?: Record<string, unknown>;
    orden?: number;
    estado?: EstadoGeneral;
  }, ctx: TenantCtx) {
    // Verificar que el producto existe y pertenece al grupo del usuario (o es global)
    await assertAccesoProducto(id_producto, ctx);

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
  }>, ctx: TenantCtx) {
    const existente = await this.obtenerPorId(id, ctx);

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

  async eliminar(id: number, ctx: TenantCtx) {
    const existente = await this.obtenerPorId(id, ctx);
    await varianteRepository.softDelete(id);
    await cacheDel(keyVariante(id), keyVariantes(existente.id_producto));
  },

  async reordenar(id_producto: number, items: { id: number; orden: number }[], ctx: TenantCtx) {
    await assertAccesoProducto(id_producto, ctx);
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
