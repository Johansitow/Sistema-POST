/**
 * InventarioService - Solo lógica de negocio para inventario
 *
 * Cambios respecto a la versión anterior:
 * 1. registrarMovimiento() requiere id_proveedor cuando tipo = 'entrada'
 * 2. Al registrar una entrada se crea automáticamente un lote
 *    con número secuencial global (LOTE-000001, LOTE-000002...)
 * 3. El id del lote generado se asocia al movimiento
 *
 * Correcciones de TypeScript:
 * - TIPOS_ENTRADA y TIPOS_SALIDA tipados como Set<TipoMovimiento> (fix error 2345)
 */

import { TipoMovimiento } from '@prisma/client';
import prisma from '../config/database';
import { movimientoRepository } from '../repositories/movimiento.repository';
import { productoRepository } from '../repositories/producto.repository';
import { loteRepository } from '../repositories/lote.repository';
import { NotFoundError, BadRequestError } from '../exceptions/HttpErrors';
import { toDecimal } from '../lib/decimal';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { generarNumeroLote } from '../lib/numero-generator';

/** Tipos de movimiento que incrementan stock */
const TIPOS_ENTRADA = new Set<TipoMovimiento>([
  TipoMovimiento.entrada,
  TipoMovimiento.produccion,
  TipoMovimiento.devolucion,
]);

/** Tipos de movimiento que decrementan stock */
const TIPOS_SALIDA = new Set<TipoMovimiento>([
  TipoMovimiento.salida,
  TipoMovimiento.merma,
  TipoMovimiento.venta,
]);

export const inventarioService = {

  async listarMovimientos(params: {
    page?: unknown; limit?: unknown;
    id_restaurante: number;   // obligatorio — aislamiento de tenant
    id_producto?: number;
    tipo?: TipoMovimiento; fecha_desde?: Date; fecha_hasta?: Date;
  }) {
    const pagination = getPaginationParams(params.page, params.limit);
    const [movimientos, total] = await movimientoRepository.findAll(pagination, {
      id_restaurante: params.id_restaurante,
      id_producto:    params.id_producto,
      tipo:           params.tipo,
      fecha_desde:    params.fecha_desde,
      fecha_hasta:    params.fecha_hasta,
    });
    return buildPaginatedResult(movimientos, total, pagination);
  },

  /**
   * registrarMovimiento — registra un movimiento de inventario
   *
   * Reglas:
   * - tipo 'entrada': id_proveedor es REQUERIDO, se crea un lote automáticamente
   * - tipo 'salida' / 'merma' / 'venta': verifica stock suficiente
   * - tipo 'ajuste': establece el stock en el valor exacto recibido
   * - tipo 'produccion' / 'devolucion': incrementa sin requerir proveedor
   *
   * El lote generado tiene número secuencial global (LOTE-000001...).
   * fecha_vencimiento y costo_produccion son opcionales en el lote.
   */
  async registrarMovimiento(data: {
    id_producto:              number;
    id_restaurante:           number;
    tipo_movimiento:          TipoMovimiento;
    cantidad:                 number;
    motivo:                   string;
    id_proveedor?:            number;
    referencia?:              string;
    // Datos del lote (aplican para tipo 'entrada' y 'produccion')
    fecha_vencimiento?:       Date;
    costo_produccion?:        number;
    observaciones_lote?:      string;
    id_usuario_responsable?:  number;
    vida_util_dias?:          number;
    merma_cantidad?:          number;
    merma_porcentaje?:        number;
  }) {
    // Validar proveedor obligatorio en entradas
    if (data.tipo_movimiento === TipoMovimiento.entrada && !data.id_proveedor) {
      throw new BadRequestError('El proveedor es obligatorio para registrar una entrada de inventario');
    }

    return prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findUnique({ where: { id: data.id_producto } });
      if (!producto) throw new NotFoundError('Producto');

      // Stock POR RESTAURANTE — fuente autoritativa para multi-tenant.
      // Si el registro de ProductoStock no existe aún (primera vez que este restaurante
      // registra movimiento de este producto), se inicializa con el stock global del catálogo.
      const stockRecord = await tx.productoStock.findUnique({
        where: { id_producto_id_restaurante: { id_producto: data.id_producto, id_restaurante: data.id_restaurante } },
      });
      const stockActual = stockRecord ? Number(stockRecord.stock_actual) : Number(producto.stock_actual);
      let nuevoStock    = stockActual;
      let id_lote: number | undefined;

      if (TIPOS_ENTRADA.has(data.tipo_movimiento)) {
        nuevoStock = stockActual + data.cantidad;

        // Crear lote automáticamente para entradas y producciones
        if (data.tipo_movimiento === TipoMovimiento.entrada || data.tipo_movimiento === TipoMovimiento.produccion) {
          // IMPORTANTE: usar `tx` (no loteRepository) para que la lectura del último
          // lote sea parte de la misma transacción y evitar race conditions en numero_lote @unique
          const ultimoLote = await tx.lote.findFirst({ orderBy: { numero_lote: 'desc' }, select: { numero_lote: true } });
          const numeroLote = generarNumeroLote(ultimoLote?.numero_lote ?? null);

          const lote = await tx.lote.create({
            data: {
              numero_lote:              numeroLote,
              id_producto:              data.id_producto,
              id_restaurante:           data.id_restaurante,
              id_usuario_responsable:   data.id_usuario_responsable,
              cantidad_producida:       toDecimal(data.cantidad),
              fecha_vencimiento:        data.fecha_vencimiento,
              vida_util_dias:           data.vida_util_dias,
              costo_produccion:         data.costo_produccion != null
                                          ? toDecimal(data.costo_produccion)
                                          : undefined,
              merma_cantidad:           data.merma_cantidad != null
                                          ? toDecimal(data.merma_cantidad)
                                          : undefined,
              merma_porcentaje:         data.merma_porcentaje != null
                                          ? toDecimal(data.merma_porcentaje)
                                          : undefined,
              observaciones:            data.observaciones_lote,
            },
          });
          id_lote = lote.id;
        }

      } else if (TIPOS_SALIDA.has(data.tipo_movimiento)) {
        if (stockActual < data.cantidad) {
          throw new BadRequestError(
            `Stock insuficiente. Actual: ${stockActual}, requerido: ${data.cantidad}`
          );
        }
        nuevoStock = stockActual - data.cantidad;

      } else if (data.tipo_movimiento === TipoMovimiento.ajuste) {
        nuevoStock = data.cantidad; // ajuste directo al valor exacto
      }

      // Actualizar ProductoStock (per-restaurante — fuente autoritativa)
      await tx.productoStock.upsert({
        where:  { id_producto_id_restaurante: { id_producto: data.id_producto, id_restaurante: data.id_restaurante } },
        update: { stock_actual: toDecimal(nuevoStock) },
        create: {
          id_producto:    data.id_producto,
          id_restaurante: data.id_restaurante,
          stock_actual:   toDecimal(nuevoStock),
          stock_minimo:   producto.stock_minimo,
          stock_maximo:   producto.stock_maximo ?? undefined,
          precio_venta_local: producto.precio_venta ?? undefined,
        },
      });

      // Actualizar producto.stock_actual (campo global legacy — compatibilidad con código existente)
      // NOTA: en un sistema con múltiples restaurantes este campo pierde significado individual.
      // Se mantiene para no romper código que aún lo lee directamente (reportes, alertas legacy).
      await tx.producto.update({
        where: { id: data.id_producto },
        data:  { stock_actual: toDecimal(nuevoStock) },
      });

      // Registrar el movimiento
      const movimiento = await tx.movimiento.create({
        data: {
          id_producto:     data.id_producto,
          id_restaurante:  data.id_restaurante,
          tipo_movimiento: data.tipo_movimiento,
          cantidad:        toDecimal(data.cantidad),
          stock_anterior:  toDecimal(stockActual),
          stock_nuevo:     toDecimal(nuevoStock),
          motivo:          data.motivo,
          id_proveedor:    data.id_proveedor,
          id_lote:         id_lote,
          referencia:      data.referencia,
        },
        include: { producto: true },
      });

      return {
        movimiento,
        lote_generado: id_lote ? await tx.lote.findUnique({ where: { id: id_lote } }) : null,
      };
    });
  },

  async estadisticasMovimientos(id_restaurante: number, dias = 30) {
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - dias);

    const [porTipo, total, afectados] = await Promise.all([
      movimientoRepository.groupByTipo(fechaInicio, id_restaurante),
      movimientoRepository.count(fechaInicio, id_restaurante),
      movimientoRepository.findDistinctProductos(fechaInicio, id_restaurante),
    ]);

    return {
      porTipo: porTipo.map(t => ({
        tipo:                 t.tipo_movimiento,
        cantidad_movimientos: t._count,
        cantidad_total:       Number(t._sum.cantidad ?? 0),
      })),
      totalMovimientos:   total,
      productosAfectados: afectados.length,
      periodo:            `${dias} días`,
    };
  },

  async listarLotes(params: {
    page?: unknown; limit?: unknown;
    id_producto?: number;
    estado_lote?: any;
    vence_antes_de?: Date;
    id_restaurante?: number;
  }) {
    const pagination = getPaginationParams(params.page, params.limit);
    const [lotes, total] = await loteRepository.findAll(pagination, {
      id_producto:    params.id_producto,
      estado_lote:    params.estado_lote,
      vence_antes_de: params.vence_antes_de,
      id_restaurante: params.id_restaurante,
    });
    return buildPaginatedResult(lotes, total, pagination);
  },

  async lotesProximosVencer(dias = 30, id_restaurante?: number) {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + dias);

    return prisma.lote.findMany({
      where: {
        fecha_vencimiento: { lte: fechaLimite, gte: new Date() },
        estado_lote: { in: ['activo', 'en_produccion'] },
        // Aislamiento por restaurante — nunca mezclar lotes de diferentes sedes
        ...(id_restaurante !== undefined ? { id_restaurante } : {}),
      },
      include: { producto: { include: { categoria: true } } },
      orderBy: { fecha_vencimiento: 'asc' },
    });
  },

  async actualizarEstadoLote(id: number, data: Partial<{
    estado_lote:       any;
    fecha_vencimiento: Date;
    observaciones:     string;
  }>) {
    const lote = await loteRepository.findById(id);
    if (!lote) throw new NotFoundError('Lote');
    return loteRepository.update(id, data);
  },

  async calcularRentabilidadLote(id: number, id_restaurante: number) {
    const lote = await loteRepository.findByIdWithReceta(id);
    if (!lote) throw new NotFoundError('Lote');
    if (lote.restaurante.id !== id_restaurante) throw new NotFoundError('Lote');

    // Merma real desde Movimiento (tipo='merma', id_lote)
    const mermaAgg = await movimientoRepository.sumMermaByLote(id, id_restaurante);
    const merma_real_cantidad = Number(mermaAgg._sum.cantidad ?? 0);
    const cantidad_producida  = Number(lote.cantidad_producida);
    const merma_real_porcentaje =
      cantidad_producida > 0 ? (merma_real_cantidad / cantidad_producida) * 100 : 0;

    // Costo de ingredientes desde la receta (igual que E4)
    const receta = lote.producto.recetas_como_final[0] ?? null;
    const advertencias: { ingrediente: string; mensaje: string }[] = [];
    let costo_ingredientes = 0;

    if (receta) {
      for (const ing of receta.ingredientes) {
        const proveedores = (ing.producto as any).proveedor_productos as {
          precio_unitario: any; es_proveedor_preferido: boolean;
        }[];
        const prov = proveedores.find(p => p.es_proveedor_preferido) ?? proveedores[0] ?? null;
        if (!prov) {
          advertencias.push({
            ingrediente: ing.producto.nombre,
            mensaje: 'Sin proveedor asignado — costo de ingrediente omitido.',
          });
        }
        costo_ingredientes += Number(ing.cantidad) * (prov ? Number(prov.precio_unitario) : 0);
      }
    }

    // Costo ajustado por merma REAL (no estimada)
    const merma_factor    = merma_real_porcentaje / 100;
    const costo_con_merma = merma_factor > 0 && merma_factor < 1
      ? costo_ingredientes / (1 - merma_factor)
      : costo_ingredientes;
    const perdida_merma   = costo_con_merma - costo_ingredientes;

    // Ganancia neta = ingresos - costo total de producción
    const precio_venta    = lote.producto.precio_venta != null
      ? Number(lote.producto.precio_venta)
      : null;
    const cantidad_vendida = Number(lote.cantidad_producida) - merma_real_cantidad;
    const ingresos        = precio_venta != null ? cantidad_vendida * precio_venta : null;
    const ganancia_neta   = ingresos != null ? ingresos - costo_con_merma : null;
    const margen_porcentaje = ingresos != null && ingresos > 0 && ganancia_neta != null
      ? (ganancia_neta / ingresos) * 100
      : null;

    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      lote_id:               lote.id,
      numero_lote:           lote.numero_lote,
      producto:              lote.producto.nombre,
      cantidad_producida,
      merma_real_cantidad:   round2(merma_real_cantidad),
      merma_real_porcentaje: round2(merma_real_porcentaje),
      cantidad_vendida:      round2(cantidad_vendida),
      costo_ingredientes:    round2(costo_ingredientes),
      costo_con_merma:       round2(costo_con_merma),
      perdida_merma:         round2(perdida_merma),
      precio_venta,
      ingresos:              ingresos != null ? round2(ingresos) : null,
      ganancia_neta:         ganancia_neta != null ? round2(ganancia_neta) : null,
      margen_porcentaje:     margen_porcentaje != null ? round2(margen_porcentaje) : null,
      tiene_receta:          receta != null,
      advertencias,
    };
  },

  async valorInventario(id_restaurante?: number) {
    if (id_restaurante !== undefined) {
      // Stock real por restaurante — fuente de verdad para inventario multi-tenant
      const stocks = await prisma.productoStock.findMany({
        where: { id_restaurante, activo: true, stock_actual: { gt: 0 } },
        include: {
          producto: {
            select: { nombre: true, sku: true, precio_unitario: true, categoria: { select: { nombre: true } } },
          },
        },
      });
      const conValor = stocks.map(s => {
        const precioUnitario = Number((s as any).precio_venta_local ?? s.producto.precio_unitario);
        return {
          id:             s.id_producto,
          nombre:         s.producto.nombre,
          sku:            s.producto.sku,
          categoria:      s.producto.categoria,
          stock_actual:   Number(s.stock_actual),
          precio_unitario: precioUnitario,
          valor_total:    Number(s.stock_actual) * precioUnitario,
        };
      });
      const valorTotal = conValor.reduce((sum, p) => sum + p.valor_total, 0);
      const porCategoria = conValor.reduce((acc: any, p) => {
        const cat = p.categoria?.nombre ?? 'Sin categoría';
        if (!acc[cat]) acc[cat] = { nombre: cat, productos: 0, valor: 0 };
        acc[cat].productos++;
        acc[cat].valor += p.valor_total;
        return acc;
      }, {});
      return { valorTotal, totalProductos: conValor.length, productos: conValor, porCategoria: Object.values(porCategoria) };
    }

    // Fallback legacy — catálogo global (sin contexto de restaurante)
    const productos = await productoRepository.findActivos();
    const conValor = productos
      .filter(p => Number(p.stock_actual) > 0)
      .map(p => ({
        ...p,
        stock_actual:    Number(p.stock_actual),
        precio_unitario: Number(p.precio_unitario),
        valor_total:     Number(p.stock_actual) * Number(p.precio_unitario),
      }));
    const valorTotal = conValor.reduce((sum, p) => sum + p.valor_total, 0);
    const porCategoria = conValor.reduce((acc: any, p) => {
      const cat = (p as any).categoria?.nombre ?? 'Sin categoría';
      if (!acc[cat]) acc[cat] = { nombre: cat, productos: 0, valor: 0 };
      acc[cat].productos++;
      acc[cat].valor += p.valor_total;
      return acc;
    }, {});
    return { valorTotal, totalProductos: conValor.length, productos: conValor, porCategoria: Object.values(porCategoria) };
  },

  async alertasInventario(id_restaurante?: number) {
    if (id_restaurante !== undefined) {
      // Usar ProductoStock para aislamiento real por restaurante
      const stocks = await prisma.productoStock.findMany({
        where: { id_restaurante, activo: true },
        include: {
          producto: {
            select: { id: true, nombre: true, sku: true, estado: true, categoria: { select: { nombre: true } } },
          },
        },
      });
      const activos     = stocks.filter(s => (s.producto as any)?.estado === 'activo');
      const stockBajo    = activos.filter(s => Number(s.stock_actual) > 0 && Number(s.stock_actual) <= Number(s.stock_minimo));
      const stockAgotado = activos.filter(s => Number(s.stock_actual) === 0);
      const toDto = (s: typeof activos[0]) => ({
        ...(s.producto as any),
        stock_actual:  Number(s.stock_actual),
        stock_minimo:  Number(s.stock_minimo),
      });
      return {
        stockBajo:    stockBajo.map(toDto),
        stockAgotado: stockAgotado.map(toDto),
        totalAlertas: stockBajo.length + stockAgotado.length,
      };
    }
    // Fallback legacy (super admin sin contexto de restaurante): usa catálogo global
    const productos    = await productoRepository.findActivos() as any[];
    const stockBajo    = productos.filter(p => Number(p.stock_actual) > 0 && Number(p.stock_actual) <= Number(p.stock_minimo));
    const stockAgotado = productos.filter(p => Number(p.stock_actual) === 0);
    return { stockBajo, stockAgotado, totalAlertas: stockBajo.length + stockAgotado.length };
  },
};