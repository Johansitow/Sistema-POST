/**
 * ProductoService - Solo lógica de negocio para productos
 */

import { EstadoGeneral, ProductoStock, TipoMovimiento } from '@prisma/client';
import { productoRepository } from '../repositories/producto.repository';
import { productoStockRepository } from '../repositories/producto-stock.repository';
import { inventarioService } from './inventario.service';
import { NotFoundError, ConflictError } from '../exceptions/HttpErrors';
import { toDecimal } from '../lib/decimal';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { cacheGetOrSet, cacheDel, CACHE_TTL } from '../config/redis';
import { assertGrupoId } from '../lib/tenantQuery';

const keyOne  = (id: number)  => `prod:${id}`;
const keySKU  = (sku: string) => `prod:sku:${sku}`;
const KEY_LIST = 'prod:list';      // wildcard para invalidar todas las listas paginadas

/**
 * Sobrescribe los campos de stock legacy del producto con los valores de
 * ProductoStock de la sede activa (cuando la query incluyó `stocks`).
 * - Con fila de la sede → stock/mínimo/máximo y precio_venta_local de la sede.
 * - Sin fila (la sede nunca ha movido este producto) → stock 0.
 * - Sin include de stocks (sin contexto de sede) → producto tal cual.
 */
function aplicarStockSede<T extends { stocks?: ProductoStock[] }>(producto: T) {
  const { stocks, ...resto } = producto;
  if (stocks === undefined) return producto;
  const stockSede = stocks[0];
  return {
    ...resto,
    stock_actual:  stockSede?.stock_actual  ?? toDecimal(0),
    stock_minimo:  stockSede?.stock_minimo  ?? (resto as Record<string, unknown>).stock_minimo,
    stock_maximo:  stockSede?.stock_maximo  ?? (resto as Record<string, unknown>).stock_maximo,
    ...(stockSede?.precio_venta_local != null ? { precio_venta: stockSede.precio_venta_local } : {}),
  };
}

export const productoService = {
  async listar(params: {
    page?: unknown; limit?: unknown;
    search?: string; categoria?: number; estado?: EstadoGeneral; es_vendible?: boolean;
    id_grupo?: number; id_restaurante?: number;
  }) {
    const pagination = getPaginationParams(params.page, params.limit);
    // Listas con filtros NO se cachean (demasiadas combinaciones)
    const [productos, total] = await productoRepository.findAll(pagination, {
      search:         params.search,
      id_categoria:   params.categoria,
      estado:         params.estado,
      es_vendible:    params.es_vendible,
      id_grupo:       params.id_grupo,
      id_restaurante: params.id_restaurante,
    });
    return buildPaginatedResult(productos.map(aplicarStockSede), total, pagination);
  },

  async obtenerPorId(id: number, id_restaurante?: number) {
    const producto = await cacheGetOrSet(
      keyOne(id),
      CACHE_TTL.MID,
      () => productoRepository.findById(id)
    );
    if (!producto) throw new NotFoundError('Producto');
    if (!id_restaurante) return producto;
    // Stock de la sede siempre fresco (no cacheado): cambia con cada movimiento
    const stockSede = await productoStockRepository.findOne(id, id_restaurante);
    return aplicarStockSede({ ...producto, stocks: stockSede ? [stockSede] : [] });
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
    // Delegar al flujo canónico de inventario: mantiene ProductoStock (por sede),
    // el campo legacy y el movimiento en una sola transacción.
    await inventarioService.registrarMovimiento({
      id_producto:     id,
      id_restaurante,
      tipo_movimiento: tipo === 'entrada' ? TipoMovimiento.entrada : TipoMovimiento.salida,
      cantidad,
      motivo: `${tipo === 'entrada' ? 'Entrada' : 'Salida'} manual de inventario`,
    });

    // Invalidar caché del producto para que el siguiente GET refleje el nuevo stock
    await cacheDel(keyOne(id));

    return this.obtenerPorId(id, id_restaurante);
  },

  async stockBajo(id_restaurante?: number) {
    if (id_restaurante) {
      // Fuente por sede: ProductoStock (Prisma no compara columnas → filtro en memoria)
      const stocks = await productoStockRepository.findBajoMinimo(id_restaurante);
      return stocks
        .filter(s => Number(s.stock_actual) <= Number(s.stock_minimo))
        .map(s => ({
          id:              s.producto.id,
          nombre:          s.producto.nombre,
          sku:             s.producto.sku,
          stock_actual:    s.stock_actual,
          stock_minimo:    s.stock_minimo,
          precio_unitario: s.producto.precio_unitario,
          categoria:       s.producto.categoria ? { nombre: s.producto.categoria.nombre } : null,
        }));
    }
    // Sin contexto de sede (superadmin sin header): comportamiento global legacy
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
