/**
 * InventarioService - Solo lógica de negocio para inventario
 *
 * registrarMovimiento() suma/resta cantidad libremente (proveedor y lote son
 * siempre opcionales). El lote es un registro aparte y explícito:
 * - `generar_lote: true` en una entrada/producción crea un lote nuevo (solo
 *   para productos que se almacenan, es_vendible = false) y lo asocia al movimiento.
 * - `id_lote` en una salida/merma vincula el movimiento a un lote existente
 *   (para saber qué lote se dañó) y actualiza su merma acumulada.
 */

import { TipoMovimiento, EstadoLote, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { movimientoRepository } from '../repositories/movimiento.repository';
import { productoRepository } from '../repositories/producto.repository';
import { loteRepository } from '../repositories/lote.repository';
import { NotFoundError, BadRequestError } from '../exceptions/HttpErrors';
import { toDecimal } from '../lib/decimal';
import { costoConvertido } from '../lib/unidadesMedida';
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

/** Tipos de movimiento que admiten generar un lote nuevo (generar_lote: true) */
const TIPOS_CON_LOTE = new Set<TipoMovimiento>([
  TipoMovimiento.entrada,
  TipoMovimiento.produccion,
]);

/** Estados de lote que representan un cierre definitivo (para estampar fecha_cierre) */
const ESTADOS_CIERRE_LOTE = new Set<EstadoLote>([EstadoLote.agotado, EstadoLote.vencido]);

/**
 * vincularLoteASalida — asocia una salida/merma a un lote existente.
 * En 'merma' acumula la merma del lote; si la merma + salidas acumuladas
 * agotan la cantidad producida, cierra el lote (agotado + fecha_cierre).
 */
async function vincularLoteASalida(
  tx: Prisma.TransactionClient,
  id_lote: number,
  id_producto: number,
  id_restaurante: number,
  tipo_movimiento: TipoMovimiento,
  cantidad: number,
): Promise<number> {
  const lote = await tx.lote.findUnique({ where: { id: id_lote } });
  if (!lote) throw new NotFoundError('Lote');
  if (lote.id_producto !== id_producto || lote.id_restaurante !== id_restaurante) {
    throw new BadRequestError('El lote no corresponde a este producto o restaurante');
  }

  const dataUpdate: Record<string, unknown> = {};

  if (tipo_movimiento === TipoMovimiento.merma) {
    const cantidadProducida  = Number(lote.cantidad_producida);
    const mermaAcumulada     = Number(lote.merma_cantidad) + cantidad;
    dataUpdate.merma_cantidad   = toDecimal(mermaAcumulada);
    dataUpdate.merma_porcentaje = toDecimal(
      cantidadProducida > 0 ? (mermaAcumulada / cantidadProducida) * 100 : 0
    );
  }

  // ¿Se agotó el lote? (merma acumulada + salidas previas vinculadas a este lote)
  const salidasPrevias = await tx.movimiento.aggregate({
    where: { id_lote, tipo_movimiento: { in: [TipoMovimiento.salida, TipoMovimiento.merma] } },
    _sum: { cantidad: true },
  });
  const totalConsumido = Number(salidasPrevias._sum.cantidad ?? 0) + cantidad;
  if (!lote.fecha_cierre && totalConsumido >= Number(lote.cantidad_producida)) {
    dataUpdate.estado_lote  = EstadoLote.agotado;
    dataUpdate.fecha_cierre = new Date();
  }

  if (Object.keys(dataUpdate).length > 0) {
    await tx.lote.update({ where: { id: id_lote }, data: dataUpdate });
  }

  return lote.id;
}

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
   * - tipo 'salida' / 'merma' / 'venta': verifica stock suficiente
   * - tipo 'ajuste': establece el stock en el valor exacto recibido
   * - proveedor y lote son siempre opcionales — sumar/restar cantidad nunca
   *   depende de registrar un lote ni un proveedor.
   * - `generar_lote: true` crea un lote nuevo (solo tipo 'entrada'/'produccion',
   *   y solo si el producto se almacena: es_vendible = false).
   * - `id_lote` vincula el movimiento (tipo 'salida'/'merma') a un lote existente;
   *   en 'merma' acumula la merma del lote y lo cierra si se agota.
   */
  async registrarMovimiento(data: {
    id_producto:              number;
    id_restaurante:           number;
    tipo_movimiento:          TipoMovimiento;
    cantidad:                 number;
    motivo:                   string;
    id_proveedor?:            number;
    id_lote?:                 number;
    referencia?:              string;
    // Genera un lote nuevo junto con este movimiento (entrada/producción)
    generar_lote?:            boolean;
    fecha_vencimiento?:       Date;
    costo_produccion?:        number;
    observaciones_lote?:      string;
    id_usuario_responsable?:  number;
    vida_util_dias?:          number;
    merma_cantidad?:          number;
    merma_porcentaje?:        number;
  }) {
    return prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findUnique({ where: { id: data.id_producto } });
      if (!producto) throw new NotFoundError('Producto');

      if (data.generar_lote && !TIPOS_CON_LOTE.has(data.tipo_movimiento)) {
        throw new BadRequestError('Solo se puede registrar un lote en movimientos de entrada o producción');
      }
      if (data.generar_lote && producto.es_vendible) {
        throw new BadRequestError('Los lotes solo aplican a productos que se almacenan, no a productos vendibles ensamblados al momento de la venta');
      }
      if (data.id_lote && !TIPOS_SALIDA.has(data.tipo_movimiento)) {
        throw new BadRequestError('Solo se puede vincular un lote existente en movimientos de salida o merma');
      }

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

        if (data.generar_lote) {
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

        if (data.id_lote) {
          id_lote = await vincularLoteASalida(tx, data.id_lote, data.id_producto, data.id_restaurante, data.tipo_movimiento, data.cantidad);
        }

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
    estado_lote:       EstadoLote;
    fecha_vencimiento: Date;
    observaciones:     string;
  }>) {
    const lote = await loteRepository.findById(id);
    if (!lote) throw new NotFoundError('Lote');

    // Estampa la duración real observada la primera vez que el lote se cierra
    const cierraAhora = data.estado_lote != null
      && ESTADOS_CIERRE_LOTE.has(data.estado_lote)
      && !lote.fecha_cierre;

    return loteRepository.update(id, {
      ...data,
      ...(cierraAhora ? { fecha_cierre: new Date() } : {}),
    });
  },

  /** Lotes activos de un producto — para elegir "qué lote se dañó" al registrar una salida/merma */
  async lotesActivosPorProducto(id_producto: number, id_restaurante: number) {
    return loteRepository.findActivosPorProducto(id_producto, id_restaurante);
  },

  /**
   * vidaUtilPromedio — promedio de días de vida útil de productos que se almacenan
   * (es_vendible = false), combinando duración real observada (fecha_cierre - fecha_produccion)
   * con la estimación declarada (vida_util_dias) como respaldo.
   */
  async vidaUtilPromedio(id_restaurante?: number) {
    const lotes = await prisma.lote.findMany({
      where: {
        producto: { es_vendible: false },
        ...(id_restaurante !== undefined ? { id_restaurante } : {}),
      },
      select: {
        id_producto:       true,
        fecha_produccion:  true,
        fecha_cierre:      true,
        vida_util_dias:    true,
        producto:          { select: { nombre: true, sku: true } },
      },
    });

    type Acumulado = {
      nombre: string; sku: string;
      diasRealesSum: number; muestrasReales: number;
      diasEstimadosSum: number; muestrasEstimadas: number;
    };
    const porProducto = new Map<number, Acumulado>();

    for (const lote of lotes) {
      let entry = porProducto.get(lote.id_producto);
      if (!entry) {
        entry = {
          nombre: lote.producto.nombre, sku: lote.producto.sku,
          diasRealesSum: 0, muestrasReales: 0,
          diasEstimadosSum: 0, muestrasEstimadas: 0,
        };
        porProducto.set(lote.id_producto, entry);
      }
      if (lote.fecha_cierre) {
        const dias = (lote.fecha_cierre.getTime() - lote.fecha_produccion.getTime()) / 86_400_000;
        entry.diasRealesSum += dias;
        entry.muestrasReales++;
      }
      if (lote.vida_util_dias != null) {
        entry.diasEstimadosSum += lote.vida_util_dias;
        entry.muestrasEstimadas++;
      }
    }

    const round1 = (n: number) => Math.round(n * 10) / 10;

    return Array.from(porProducto.entries()).map(([id_producto, e]) => ({
      id_producto,
      nombre:                  e.nombre,
      sku:                     e.sku,
      dias_reales_promedio:    e.muestrasReales > 0 ? round1(e.diasRealesSum / e.muestrasReales) : null,
      dias_estimados_promedio: e.muestrasEstimadas > 0 ? round1(e.diasEstimadosSum / e.muestrasEstimadas) : null,
      muestras_reales:         e.muestrasReales,
      muestras_estimadas:      e.muestrasEstimadas,
    }));
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
          continue;
        }

        const { costo, incompatible } = costoConvertido(
          Number(ing.cantidad), ing.unidad, ing.producto.unidad_medida, Number(prov.precio_unitario),
        );
        if (incompatible) {
          advertencias.push({
            ingrediente: ing.producto.nombre,
            mensaje: `Unidad del ingrediente (${ing.unidad}) incompatible con la unidad del producto (${ing.producto.unidad_medida}). Costo no calculado.`,
          });
          continue;
        }
        costo_ingredientes += costo ?? 0;
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