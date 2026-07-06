/**
 * RecetaService
 */

import prisma from '../config/database';
import { recetaRepository } from '../repositories/receta.repository';
import { alertaService }    from './alerta.service';
import { NotFoundError, BadRequestError, ConflictError } from '../exceptions/HttpErrors';
import { assertRestauranteId } from '../lib/tenantQuery';
import { getPaginationParams, getSkip, buildPaginatedResult } from '../lib/pagination';
import { toDecimal } from '../lib/decimal';
import { tieneStock, convertUnits, costoConvertido } from '../lib/unidadesMedida';
import type { TenantCtx } from '../lib/tenantCtx';

const MARGEN_DEFAULT = 0.40;

export const recetaService = {

  async listar(params: { page?: unknown; limit?: unknown; id_producto?: number; estado?: string }) {
    const p = getPaginationParams(params.page, params.limit);
    const [data, total] = await recetaRepository.findAll({
      skip:        getSkip(p),
      take:        p.limit,
      id_producto: params.id_producto,
      estado:      params.estado,
    });
    return buildPaginatedResult(
      data.map(r => ({ ...r, rentabilidad: this._calcularRentabilidad(r as any) })),
      total, p
    );
  },

  async obtenerPorId(id: number) {
    const receta = await recetaRepository.findById(id);
    if (!receta) throw new NotFoundError('Receta');
    return { ...receta, rentabilidad: this._calcularRentabilidad(receta as any) };
  },

  async obtenerPorProducto(id_producto: number) {
    const receta = await recetaRepository.findByProductoFinal(id_producto);
    if (!receta) throw new NotFoundError('Receta para este producto');
    return { ...receta, rentabilidad: this._calcularRentabilidad(receta as any) };
  },

  async crear(data: {
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
      id_producto: number; cantidad: number; unidad: string;
      es_opcional?: boolean; notas?: string; orden?: number; numero_fase?: number;
      tipo_formula?: string; factor_formula?: number;
      id_ingrediente_base?: number; formula_descripcion?: string;
    }[];
    fases?: {
      numero_fase: number; nombre: string; descripcion: string;
      duracion_minutos?: number; merma_esperada_porcentaje?: number;
    }[];
  }) {
    assertRestauranteId(data.id_restaurante);

    const producto = await prisma.producto.findUnique({ where: { id: data.id_producto_final } });
    if (!producto) throw new NotFoundError('Producto final');

    const existente = await recetaRepository.findByProductoFinal(data.id_producto_final);
    if (existente) throw new ConflictError('Este producto ya tiene una receta activa');

    await this._verificarIngredientes(data.ingredientes);

    const receta = await recetaRepository.create(data);
    return { ...receta, rentabilidad: this._calcularRentabilidad(receta as any) };
  },

  async actualizar(id: number, data: any, ctx: TenantCtx) {
    await recetaRepository.findByIdScoped(id, ctx);
    return recetaRepository.update(id, data);
  },

  async actualizarIngredientes(id: number, ingredientes: any[], ctx: TenantCtx) {
    await recetaRepository.findByIdScoped(id, ctx);
    await this._verificarIngredientes(ingredientes);
    const receta = await recetaRepository.reemplazarIngredientes(id, ingredientes);
    return { ...receta, rentabilidad: this._calcularRentabilidad(receta as any) };
  },

  // ─── Fases ───────────────────────────────────────────────────────────────────

  async listarFases(id_receta: number, ctx: TenantCtx) {
    await recetaRepository.findByIdScoped(id_receta, ctx);
    return recetaRepository.findFasesByReceta(id_receta);
  },

  async crearFase(id_receta: number, data: {
    numero_fase: number; nombre: string; descripcion: string;
    duracion_minutos?: number; merma_esperada_porcentaje?: number;
  }, ctx: TenantCtx) {
    await recetaRepository.findByIdScoped(id_receta, ctx);
    const faseExistente = await prisma.recetaFase.findUnique({
      where: { id_receta_numero_fase: { id_receta, numero_fase: data.numero_fase } },
    });
    if (faseExistente && faseExistente.estado === 'activo') {
      throw new ConflictError(`Ya existe una fase número ${data.numero_fase} para esta receta`);
    }
    return recetaRepository.createFase({ id_receta, ...data });
  },

  async actualizarFase(id: number, data: Partial<{
    numero_fase: number; nombre: string; descripcion: string;
    duracion_minutos: number; merma_esperada_porcentaje: number;
  }>, ctx: TenantCtx) {
    const fase = await recetaRepository.findFaseById(id);
    if (!fase || fase.estado === 'eliminado') throw new NotFoundError('Fase de receta');
    // Valida que la receta padre pertenece al tenant del ctx
    await recetaRepository.findByIdScoped(fase.id_receta, ctx);
    return recetaRepository.updateFase(id, data);
  },

  async eliminarFase(id: number, ctx: TenantCtx) {
    const fase = await recetaRepository.findFaseById(id);
    if (!fase || fase.estado === 'eliminado') throw new NotFoundError('Fase de receta');
    // Valida que la receta padre pertenece al tenant del ctx
    await recetaRepository.findByIdScoped(fase.id_receta, ctx);
    return recetaRepository.deleteFase(id);
  },

  // ─── Disponibilidad ──────────────────────────────────────────────────────────

  async calcularDisponibilidad(id_receta: number) {
    const receta = await recetaRepository.findRecetaConStock(id_receta);
    if (!receta) throw new NotFoundError('Receta');

    const cantidadProducida = Number(receta.cantidad_producida);
    let disponibilidadMinima = Infinity;
    let ingredienteLimitante: any = null;

    const detalleIngredientes = receta.ingredientes.map(ing => {
      const stockActual    = Number(ing.producto.stock_actual);
      const cantNecesaria  = Number(ing.cantidad);
      // Convertir cantNecesaria (unidad receta) a la unidad del stock del producto
      const cantEnStockUnit = convertUnits(cantNecesaria, ing.unidad, ing.producto.unidad_medida);
      const unidadesPosibl = cantEnStockUnit > 0
        ? Math.floor((stockActual / cantEnStockUnit) * cantidadProducida)
        : Infinity;

      if (!ing.es_opcional && unidadesPosibl < disponibilidadMinima) {
        disponibilidadMinima  = unidadesPosibl;
        ingredienteLimitante  = ing.producto;
      }

      return {
        id_producto:       ing.id_producto,
        nombre:            ing.producto.nombre,
        cantidad_por_lote: cantNecesaria,
        stock_actual:      stockActual,
        unidad:            ing.unidad,
        unidades_posibles: unidadesPosibl === Infinity ? 9999 : unidadesPosibl,
        es_opcional:       ing.es_opcional,
        suficiente:        unidadesPosibl > 0,
      };
    });

    const disponibilidad = disponibilidadMinima === Infinity ? 0 : disponibilidadMinima;

    return {
      id_receta,
      nombre_receta:      receta.nombre_receta,
      producto_final:     receta.producto_final,
      disponibilidad:     disponibilidad,
      unidad_produccion:  receta.unidad_produccion,
      ingrediente_limitante: ingredienteLimitante,
      detalle_ingredientes:  detalleIngredientes,
    };
  },

  // ─── Rentabilidad ────────────────────────────────────────────────────────────

  /** Desglose detallado usando precios de ProveedorProducto (preferido o primero). */
  async obtenerDesgloseRentabilidad(id: number) {
    const receta = await recetaRepository.findByIdWithProveedores(id);
    if (!receta) throw new NotFoundError('Receta');

    const advertencias: { ingrediente: string; mensaje: string }[] = [];

    const desglose = receta.ingredientes.map(ing => {
      const proveedores = (ing.producto as any).proveedor_productos as
        { precio_unitario: number; es_proveedor_preferido: boolean }[];
      const proveedor    = proveedores.find(p => p.es_proveedor_preferido) ?? proveedores[0] ?? null;
      const precio_unitario = proveedor ? Number(proveedor.precio_unitario) : null;

      if (!proveedor) {
        advertencias.push({
          ingrediente: ing.producto.nombre,
          mensaje:     'Sin proveedor asignado. Asigna un proveedor para un margen más exacto.',
        });
      }

      let subtotal = 0;
      let unidad_incompatible = false;
      if (precio_unitario != null) {
        const { costo, incompatible } = costoConvertido(
          Number(ing.cantidad), ing.unidad, ing.producto.unidad_medida, precio_unitario,
        );
        if (incompatible) {
          unidad_incompatible = true;
          advertencias.push({
            ingrediente: ing.producto.nombre,
            mensaje:     `Unidad del ingrediente (${ing.unidad}) incompatible con la unidad del producto (${ing.producto.unidad_medida}). Costo no calculado.`,
          });
        } else {
          subtotal = costo ?? 0;
        }
      }

      return {
        ingrediente:   ing.producto.nombre,
        cantidad:      Number(ing.cantidad),
        unidad:        ing.unidad as string,
        precio_unitario,
        subtotal,
        unidad_incompatible,
      };
    });

    const costo_total      = desglose.reduce((s, d) => s + d.subtotal, 0);
    const merma_porcentaje = Number(receta.merma_esperada_porcentaje ?? 0);
    const merma_factor     = merma_porcentaje / 100;
    const costo_con_merma  = merma_factor > 0 ? costo_total / (1 - merma_factor) : costo_total;
    const merma_costo      = costo_con_merma - costo_total;

    const precio_venta    = receta.producto_final.precio_venta != null
      ? Number(receta.producto_final.precio_venta)
      : null;
    const margen_porcentaje = precio_venta != null && precio_venta > 0
      ? ((precio_venta - costo_con_merma) / precio_venta) * 100
      : null;

    return {
      desglose,
      costo_total:        Math.round(costo_total * 100) / 100,
      merma_porcentaje,
      merma_costo:        Math.round(merma_costo * 100) / 100,
      costo_con_merma:    Math.round(costo_con_merma * 100) / 100,
      precio_venta,
      margen_porcentaje:  margen_porcentaje != null
        ? Math.round(margen_porcentaje * 100) / 100
        : null,
      advertencias,
    };
  },

  _calcularRentabilidad(receta: {
    ingredientes: {
      cantidad: number; unidad: string;
      producto: { nombre?: string; precio_unitario: number; unidad_medida: string };
    }[];
    merma_esperada_porcentaje?: number | null;
    cantidad_producida: number;
    producto_final: { precio_venta?: number | null; precio_unitario: number };
  }) {
    const advertencias: { ingrediente: string; mensaje: string }[] = [];

    const costoIngredientes = receta.ingredientes.reduce((sum, ing) => {
      const { costo, incompatible } = costoConvertido(
        Number(ing.cantidad), ing.unidad, ing.producto.unidad_medida, Number(ing.producto.precio_unitario),
      );
      if (incompatible) {
        advertencias.push({
          ingrediente: ing.producto.nombre ?? 'Ingrediente',
          mensaje:     `Unidad del ingrediente (${ing.unidad}) incompatible con la unidad del producto (${ing.producto.unidad_medida}). Costo no calculado.`,
        });
        return sum;
      }
      return sum + (costo ?? 0);
    }, 0);

    const merma     = Number(receta.merma_esperada_porcentaje ?? 0) / 100;
    const costoCon  = merma > 0 ? costoIngredientes / (1 - merma) : costoIngredientes;
    const costoUnit = costoCon / Number(receta.cantidad_producida);
    const precioSugeridoMinimo = Math.ceil(costoUnit / (1 - MARGEN_DEFAULT));

    const precioActual = Number(receta.producto_final.precio_venta ?? receta.producto_final.precio_unitario);
    const margenActual = precioActual > 0
      ? ((precioActual - costoUnit) / precioActual) * 100
      : 0;

    return {
      costo_ingredientes:       Math.round(costoIngredientes),
      costo_con_merma:          Math.round(costoCon),
      costo_unitario:           Math.round(costoUnit),
      precio_sugerido_minimo:   precioSugeridoMinimo,
      precio_actual:            Math.round(precioActual),
      margen_actual_porcentaje: Math.round(margenActual * 100) / 100,
      es_rentable:              margenActual >= MARGEN_DEFAULT * 100,
      diferencia_precio:        Math.round(precioActual - precioSugeridoMinimo),
      alerta_rentabilidad:      precioActual < precioSugeridoMinimo
        ? `El precio actual ($${precioActual.toLocaleString()}) está $${Math.abs(precioActual - precioSugeridoMinimo).toLocaleString()} por debajo del mínimo rentable ($${precioSugeridoMinimo.toLocaleString()})`
        : null,
      advertencias,
    };
  },

  /**
   * Verifica disponibilidad de ingredientes para una lista de productos+cantidades
   * ANTES de crear la orden (no requiere que la orden exista).
   */
  async verificarDisponibilidadParaDetalles(
    detalles: { id_producto: number; cantidad: number }[]
  ) {
    const faltantes: {
      producto: string; ingrediente: string;
      cantidad_necesaria: number; stock_actual: number; unidad: string;
    }[] = [];

    for (const det of detalles) {
      const receta = await recetaRepository.findByProductoFinal(det.id_producto);
      if (!receta) continue; // Sin receta: el stock del producto ya lo valida crear()

      for (const ing of receta.ingredientes) {
        if (ing.es_opcional) continue;
        const cantNecesaria = Number(ing.cantidad) * det.cantidad;
        const stockActual   = Number(ing.producto.stock_actual);
        if (!tieneStock(stockActual, ing.producto.unidad_medida, cantNecesaria, ing.unidad)) {
          const prodFinal = await prisma.producto.findUnique({ where: { id: det.id_producto }, select: { nombre: true } });
          faltantes.push({
            producto:           prodFinal?.nombre ?? `Producto ${det.id_producto}`,
            ingrediente:        ing.producto.nombre,
            cantidad_necesaria: cantNecesaria,
            stock_actual:       stockActual,
            unidad:             ing.unidad,
          });
        }
      }
    }

    if (faltantes.length > 0) {
      throw new BadRequestError(
        `Materias primas insuficientes para preparar ${faltantes.length} ingrediente(s).`,
        // @ts-ignore
        { ingredientes_faltantes: faltantes }
      );
    }
    return { ok: true };
  },

  async verificarStockParaOrden(id_orden: number) {
    const orden = await prisma.orden.findUnique({
      where: { id: id_orden },
      include: { detalles: { include: { producto: true } } },
    });
    if (!orden) throw new NotFoundError('Orden');

    const faltantes: {
      producto: string; ingrediente: string;
      cantidad_necesaria: number; stock_actual: number; unidad: string;
    }[] = [];

    for (const detalle of orden.detalles) {
      const receta = await recetaRepository.findByProductoFinal(detalle.id_producto);

      if (!receta) {
        if (Number(detalle.producto.stock_actual) < Number(detalle.cantidad)) {
          faltantes.push({
            producto:           detalle.producto.nombre,
            ingrediente:        detalle.producto.nombre,
            cantidad_necesaria: Number(detalle.cantidad),
            stock_actual:       Number(detalle.producto.stock_actual),
            unidad:             detalle.producto.unidad_medida,
          });
        }
        continue;
      }

      const cantidadPlatos = Number(detalle.cantidad);
      for (const ing of receta.ingredientes) {
        if (ing.es_opcional) continue;
        const cantidadNecesaria = Number(ing.cantidad) * cantidadPlatos;
        const stockActual       = Number(ing.producto.stock_actual);
        if (!tieneStock(stockActual, ing.producto.unidad_medida, cantidadNecesaria, ing.unidad)) {
          faltantes.push({
            producto:           detalle.producto.nombre,
            ingrediente:        ing.producto.nombre,
            cantidad_necesaria: cantidadNecesaria,
            stock_actual:       stockActual,
            unidad:             ing.unidad,
          });
        }
      }
    }

    if (faltantes.length > 0) {
      try { await alertaService.sincronizar(); } catch { /* no bloquear */ }
      throw new BadRequestError(
        `Stock insuficiente para completar la orden. Faltan ${faltantes.length} ingrediente(s).`,
        // @ts-ignore
        { ingredientes_faltantes: faltantes }
      );
    }

    return { ok: true };
  },

  async descontarIngredientesOrden(id_orden: number, tx: any) {
    const orden = await tx.orden.findUnique({
      where: { id: id_orden },
      include: { detalles: { include: { producto: true } } },
    });
    if (!orden) return;

    for (const detalle of orden.detalles) {
      // Usar tx para que la lectura de receta sea parte de la misma transacción
      const receta = await tx.receta.findFirst({
        where: { id_producto_final: detalle.id_producto, estado: 'activo' },
        include: {
          ingredientes: {
            include: { producto: true },
            orderBy: { orden: 'asc' },
          },
        },
      });
      if (!receta) continue;

      const cantidadPlatos = Number(detalle.cantidad);

      for (const ing of receta.ingredientes) {
        if (ing.es_opcional) continue;

        const cantidadEnReceta = Number(ing.cantidad) * cantidadPlatos;
        const producto = await tx.producto.findUnique({ where: { id: ing.id_producto } });
        if (!producto) continue;

        // Convertir la cantidad de la receta a la unidad en que está el stock del producto
        const cantidadDescontar = convertUnits(cantidadEnReceta, ing.unidad, producto.unidad_medida);
        const stockNuevo = Math.max(0, Number(producto.stock_actual) - cantidadDescontar);

        await tx.producto.update({
          where: { id: ing.id_producto },
          data:  { stock_actual: toDecimal(stockNuevo) },
        });

        await tx.movimiento.create({
          data: {
            id_producto:     ing.id_producto,
            tipo_movimiento: 'salida',
            cantidad:        toDecimal(cantidadDescontar),
            stock_anterior:  toDecimal(Number(producto.stock_actual)),
            stock_nuevo:     toDecimal(stockNuevo),
            motivo:          `Ingrediente receta "${receta.nombre_receta}" - Orden ${orden.numero_orden}`,
            id_orden:        id_orden,
          },
        });
      }
    }

    try {
      await alertaService.sincronizar();
    } catch { /* no bloquear el flujo principal */ }
  },

  async _verificarIngredientes(ingredientes: { id_producto: number }[]) {
    const ids = [...new Set(ingredientes.map(i => i.id_producto))];
    const existentes = await prisma.producto.findMany({
      where: { id: { in: ids } }, select: { id: true, nombre: true, tipo_materia: true },
    });

    const encontrados = new Set(existentes.map(p => p.id));
    const faltantes   = ids.filter(id => !encontrados.has(id));
    if (faltantes.length > 0)
      throw new BadRequestError(`Los productos con ID [${faltantes.join(', ')}] no existen`);

    const procesados = existentes.filter(p => p.tipo_materia === 'procesada');
    return {
      advertencias_ingredientes_procesados: procesados.map(p => ({
        id:     p.id,
        nombre: p.nombre,
        aviso:  `'${p.nombre}' es un producto procesado. Si tiene stock insuficiente, se requerirá producirlo primero.`,
      })),
    };
  },
};
