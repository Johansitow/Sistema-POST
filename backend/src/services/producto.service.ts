/**
 * ProductoService - Solo lógica de negocio para productos
 */

import { EstadoGeneral } from '@prisma/client';
import { productoRepository } from '../repositories/producto.repository';
import { movimientoRepository } from '../repositories/movimiento.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../exceptions/HttpErrors';
import { toDecimal } from '../lib/decimal';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { cacheGetOrSet, cacheDel, CACHE_TTL } from '../config/redis';
import { assertGrupoId } from '../lib/tenantQuery';

const keyOne  = (id: number)  => `prod:${id}`;
const keySKU  = (sku: string) => `prod:sku:${sku}`;
const KEY_LIST = 'prod:list';      // wildcard para invalidar todas las listas paginadas

export const productoService = {
  async listar(params: {
    page?: unknown; limit?: unknown;
    search?: string; categoria?: number; estado?: EstadoGeneral; es_vendible?: boolean; id_grupo?: number;
  }) {
    const pagination = getPaginationParams(params.page, params.limit);
    // Listas con filtros NO se cachean (demasiadas combinaciones)
    const [productos, total] = await productoRepository.findAll(pagination, {
      search:       params.search,
      id_categoria: params.categoria,
      estado:       params.estado,
      es_vendible:  params.es_vendible,
      id_grupo:     params.id_grupo,
    });
    return buildPaginatedResult(productos, total, pagination);
  },

  async obtenerPorId(id: number) {
    const producto = await cacheGetOrSet(
      keyOne(id),
      CACHE_TTL.MID,
      () => productoRepository.findById(id)
    );
    if (!producto) throw new NotFoundError('Producto');
    return producto;
  },

  async obtenerPorSKU(sku: string) {
    const producto = await cacheGetOrSet(
      keySKU(sku),
      CACHE_TTL.MID,
      () => productoRepository.findBySKU(sku)
    );
    if (!producto) throw new NotFoundError('Producto');
    return producto;
  },

  async crear(data: any) {
    // Los productos son catálogo de grupo — siempre deben tener id_grupo
    assertGrupoId(data.id_grupo as number | undefined);

    const existeSKU = await productoRepository.findBySKU(data.sku);
    if (existeSKU) throw new ConflictError('Ya existe un producto con ese SKU');

    const producto = await productoRepository.create({
      ...data,
      precio_unitario: toDecimal(data.precio_unitario),
      precio_venta:    data.precio_venta    != null ? toDecimal(data.precio_venta)   : undefined,
      stock_actual:    data.stock_actual    != null ? toDecimal(data.stock_actual)   : toDecimal(0),
      stock_minimo:    data.stock_minimo    != null ? toDecimal(data.stock_minimo)   : toDecimal(0),
      stock_maximo:    data.stock_maximo    != null ? toDecimal(data.stock_maximo)   : undefined,
      punto_reorden:   data.punto_reorden   != null ? toDecimal(data.punto_reorden)  : undefined,
    });

    await cacheDel(KEY_LIST);
    return producto;
  },

  async actualizar(id: number, data: any) {
    const existente = await this.obtenerPorId(id);

    if (data.sku && data.sku !== existente.sku) {
      const existeSKU = await productoRepository.findBySKU(data.sku);
      if (existeSKU) throw new ConflictError('Ya existe un producto con ese SKU');
    }

    const updateData: any = { ...data };
    if (data.precio_unitario != null) updateData.precio_unitario = toDecimal(data.precio_unitario);
    if (data.precio_venta    != null) updateData.precio_venta    = toDecimal(data.precio_venta);
    if (data.stock_actual    != null) updateData.stock_actual    = toDecimal(data.stock_actual);
    if (data.stock_minimo    != null) updateData.stock_minimo    = toDecimal(data.stock_minimo);
    if (data.stock_maximo    != null) updateData.stock_maximo    = toDecimal(data.stock_maximo);
    if (data.punto_reorden   != null) updateData.punto_reorden   = toDecimal(data.punto_reorden);

    const producto = await productoRepository.update(id, updateData);
    await cacheDel(keyOne(id), keySKU(existente.sku), KEY_LIST);
    return producto;
  },

  async eliminar(id: number) {
    const existente = await this.obtenerPorId(id);
    const result = await productoRepository.softDelete(id);
    await cacheDel(keyOne(id), keySKU(existente.sku), KEY_LIST);
    return result;
  },

  async actualizarStock(id: number, cantidad: number, tipo: 'entrada' | 'salida', id_restaurante: number) {
    const producto = await this.obtenerPorId(id);
    const stockActual = Number(producto.stock_actual);
    const nuevoStock  = tipo === 'entrada' ? stockActual + cantidad : stockActual - cantidad;

    if (nuevoStock < 0) throw new BadRequestError('Stock insuficiente');

    await productoRepository.updateStock(id, toDecimal(nuevoStock));
    await movimientoRepository.create({
      id_producto:      id,
      id_restaurante,
      tipo_movimiento:  tipo as any,
      cantidad:         toDecimal(cantidad),
      stock_anterior:   toDecimal(stockActual),
      stock_nuevo:      toDecimal(nuevoStock),
      motivo: `${tipo === 'entrada' ? 'Entrada' : 'Salida'} manual de inventario`,
    });

    // Invalidar caché del producto para que el siguiente GET refleje el nuevo stock
    await cacheDel(keyOne(id));

    return productoRepository.findById(id);
  },

  async stockBajo() {
    const productos = await productoRepository.findActivos();
    return productos.filter(p => Number(p.stock_actual) <= Number(p.stock_minimo));
  },

  async estadisticas() {
    const [total, activos, inactivos, todos] = await Promise.all([
      productoRepository.count(),
      productoRepository.countByEstado(EstadoGeneral.activo),
      productoRepository.countByEstado(EstadoGeneral.inactivo),
      productoRepository.findActivos(),
    ]);
    const stockBajo   = todos.filter(p => Number(p.stock_actual) <= Number(p.stock_minimo)).length;
    const valorTotal  = todos.reduce((s, p) => s + Number(p.stock_actual) * Number(p.precio_unitario), 0);
    return { total, activos, inactivos, stockBajo, valorTotal };
  },
};
