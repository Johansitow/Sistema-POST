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
import { precioCompra, MSG_SIN_PRECIO_COMPRA, type PrecioProveedor } from '../lib/costoProveedor';
import type { TenantCtx } from '../lib/tenantCtx';

const MARGEN_DEFAULT = 0.40;

/**
 * Colapsa proveedor_productos de cada ingrediente en `producto.precio_compra`
 * (null si no hay precio) y elimina el arreglo crudo antes de responder.
 * Deja una sola forma de dato para el frontend: precio_compra es la base de costo.
 */
function conPrecioCompra<T extends { ingredientes?: unknown[] }>(receta: T): T {
  const ingredientes = (receta.ingredientes ?? []).map((ing) => {
    const i = ing as { producto?: { proveedor_productos?: PrecioProveedor[] } };
    if (!i.producto) return ing;
    const { proveedor_productos, ...prod } = i.producto;
    return { ...i, producto: { ...prod, precio_compra: precioCompra(proveedor_productos) } };
  });
  return { ...receta, ingredientes };
}

export const recetaService = {

  async listar(params: { page?: unknown; limit?: unknown; id_producto?: number; estado?: string; id_restaurante?: number }) {
    const p = getPaginationParams(params.page, params.limit);
    const [data, total] = await recetaRepository.findAll({
      skip:           getSkip(p),
      take:           p.limit,
      id_producto:    params.id_producto,
      estado:         params.estado,
      id_restaurante: params.id_restaurante,
    });
    return buildPaginatedResult(
      data.map(r => conPrecioCompra({ ...r, rentabilidad: this._calcularRentabilidad(r as any) })),
      total, p
    );
  },

  async obtenerPorId(id: number) {
    const receta = await recetaRepository.findById(id);
    if (!receta) throw new NotFoundError('Receta');
    return conPrecioCompra({ ...receta, rentabilidad: this._calcularRentabilidad(receta as any) });
  },

  /** Lookup guardado por tenant: NotFoundError si la receta es de otra sede. */
  async obtenerPorIdScoped(id: number, ctx: TenantCtx) {
    const receta = await recetaRepository.findByIdScoped(id, ctx);
    return conPrecioCompra({ ...receta, rentabilidad: this._calcularRentabilidad(receta as any) });
  },

  async obtenerPorProducto(id_producto: number, id_restaurante?: number) {
    const receta = await recetaRepository.findByProductoFinal(id_producto, id_restaurante);
    if (!receta) throw new NotFoundError('Receta para este producto');
    return conPrecioCompra({ ...receta, rentabilidad: this._calcularRentabilidad(receta as any) });
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

    // El conflicto se valida POR SEDE: cada sucursal maneja sus propias recetas
    const existente = await recetaRepository.findByProductoFinal(data.id_producto_final, data.id_restaurante);
    if (existente) throw new ConflictError('Este producto ya tiene una receta activa en esta sede');

    await this._verificarIngredientes(data.ingredientes);

    const receta = await recetaRepository.create(data);
    return conPrecioCompra({ ...receta, rentabilidad: this._calcularRentabilidad(receta as any) });
  },

  async actualizar(id: number, data: any, ctx: TenantCtx) {
    await recetaRepository.findByIdScoped(id, ctx);
    return recetaRepository.update(id, data);
  },

  async actualizarIngredientes(id: number, ingredientes: any[], ctx: TenantCtx) {
    await recetaRepository.findByIdScoped(id, ctx);
    await this._verificarIngredientes(ingredientes);
    const receta = await recetaRepository.reemplazarIngredientes(id, ingredientes);
    return conPrecioCompra({ ...receta, rentabilidad: this._calcularRentabilidad(receta as any) });
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

  async calcularDisponibilidad(id_receta: number, ctx: TenantCtx) {
    // Guard de tenant: la receta debe ser de la sede activa
    await recetaRepository.findByIdScoped(id_receta, ctx);
    const receta = await recetaRepository.findRecetaConStock(id_receta);
    if (!receta) throw new NotFoundError('Receta');

    const { disponibilidad, disponibilidadPorReceta, stockProducido, ingredienteLimitante, detalleIngredientes } =
      this._calcularDisponibilidadDeReceta(receta);

    return {
      id_receta,
      nombre_receta:      receta.nombre_receta,
      producto_final:     receta.producto_final,
      disponibilidad:     disponibilidad,
      stock_producido:    stockProducido,
      disponibilidad_por_receta: disponibilidadPorReceta,
      unidad_produccion:  receta.unidad_produccion,
      ingrediente_limitante: ingredienteLimitante,
      detalle_ingredientes:  detalleIngredientes,
    };
  },

  /** Disponibilidad de todos los productos vendibles de una sede — usado por Inventario. */
  async calcularDisponibilidadCatalogo(id_restaurante: number) {
    const recetas = await recetaRepository.findRecetasVendiblesConStock(id_restaurante);
    return recetas.map(receta => {
      const { disponibilidad } = this._calcularDisponibilidadDeReceta(receta);
      return {
        id_producto:       receta.id_producto_final,
        disponibilidad,
        unidad_produccion: receta.unidad_produccion,
      };
    });
  },

  /** Lógica compartida por calcularDisponibilidad y calcularDisponibilidadCatalogo. */
  _calcularDisponibilidadDeReceta(receta: {
    cantidad_producida: unknown;
    producto_final: { stock_actual: unknown };
    ingredientes: Array<{
      id_producto: number; cantidad: unknown; unidad: string; es_opcional: boolean;
      producto: { id: number; nombre: string; stock_actual: unknown; unidad_medida: string };
    }>;
  }) {
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

    // Disponibilidad por receta: lo que se podría preparar desde cero con los
    // ingredientes crudos restantes (no incluye lo que ya está producido y listo).
    const disponibilidadPorReceta = disponibilidadMinima === Infinity ? 0 : disponibilidadMinima;
    // Stock ya producido y listo para vender (ej. lotes hechos por adelantado en Lotes → Producción).
    const stockProducido = Number(receta.producto_final.stock_actual ?? 0);
    // Disponibilidad total = lo ya producido + lo que aún se puede preparar.
    const disponibilidad = stockProducido + disponibilidadPorReceta;

    return { disponibilidad, disponibilidadPorReceta, stockProducido, ingredienteLimitante, detalleIngredientes };
  },

  // ─── Rentabilidad ────────────────────────────────────────────────────────────

  /** Desglose detallado usando precios de ProveedorProducto (preferido o primero). */
  async obtenerDesgloseRentabilidad(id: number, ctx: TenantCtx) {
    // Guard de tenant: la receta debe ser de la sede activa
    await recetaRepository.findByIdScoped(id, ctx);
    const receta = await recetaRepository.findByIdWithProveedores(id);
    if (!receta) throw new NotFoundError('Receta');

    const advertencias: { ingrediente: string; mensaje: string }[] = [];

    let ingredientesSinPrecio = 0;

    const desglose = receta.ingredientes.map(ing => {
      const precio_unitario = precioCompra(
        (ing.producto as { proveedor_productos?: PrecioProveedor[] }).proveedor_productos,
      );

      if (precio_unitario == null) {
        ingredientesSinPrecio++;
        advertencias.push({ ingrediente: ing.producto.nombre, mensaje: MSG_SIN_PRECIO_COMPRA });
      }

      let subtotal = 0;
      let unidad_incompatible = false;
      if (precio_unitario != null) {
        const { costo, incompatible } = costoConvertido(
          Number(ing.cantidad), ing.unidad, ing.producto.unidad_medida, precio_unitario,
        );
        if (incompatible) {
          unidad_incompatible = true;
          ingredientesSinPrecio++;
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

    // Mismo criterio que _calcularRentabilidad: con precios de compra faltantes
    // el costo está subestimado, así que el margen se reporta en 0%.
    const datos_incompletos = ingredientesSinPrecio > 0 || receta.ingredientes.length === 0;

    const margen_porcentaje = datos_incompletos
      ? 0
      : precio_venta != null && precio_venta > 0
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
      datos_incompletos,
      ingredientes_sin_precio: ingredientesSinPrecio,
      advertencias,
    };
  },

  /**
   * Rentabilidad de una receta a partir del precio de compra de los insumos.
   *
   * El costo SOLO puede salir de ProveedorProducto (precio bruto pagado al
   * proveedor). Mientras falte el precio de algún ingrediente el costo estaría
   * subestimado y el margen saldría inflado, así que se reporta 0% y
   * `datos_incompletos: true` en vez de un número que engaña. En cuanto se
   * cargan todos los precios, el margen se calcula solo.
   */
  _calcularRentabilidad(receta: {
    ingredientes: {
      cantidad: number; unidad: string;
      producto: {
        nombre?: string; unidad_medida: string;
        proveedor_productos?: PrecioProveedor[] | null;
      };
    }[];
    merma_esperada_porcentaje?: number | null;
    cantidad_producida: number;
    producto_final: { precio_venta?: number | null; precio_unitario: number };
  }) {
    const advertencias: { ingrediente: string; mensaje: string }[] = [];
    let ingredientesSinPrecio = 0;

    const costoIngredientes = receta.ingredientes.reduce((sum, ing) => {
      const nombre = ing.producto.nombre ?? 'Ingrediente';
      const precio = precioCompra(ing.producto.proveedor_productos);

      if (precio == null) {
        ingredientesSinPrecio++;
        advertencias.push({ ingrediente: nombre, mensaje: MSG_SIN_PRECIO_COMPRA });
        return sum;
      }

      const { costo, incompatible } = costoConvertido(
        Number(ing.cantidad), ing.unidad, ing.producto.unidad_medida, precio,
      );
      if (incompatible) {
        ingredientesSinPrecio++;
        advertencias.push({
          ingrediente: nombre,
          mensaje:     `Unidad del ingrediente (${ing.unidad}) incompatible con la unidad del producto (${ing.producto.unidad_medida}). Costo no calculado.`,
        });
        return sum;
      }
      return sum + (costo ?? 0);
    }, 0);

    const precioActual     = Number(receta.producto_final.precio_venta ?? receta.producto_final.precio_unitario);
    const datosIncompletos = ingredientesSinPrecio > 0 || receta.ingredientes.length === 0;

    // Sin el costo completo no hay margen que reportar: todo queda en 0%.
    if (datosIncompletos) {
      return {
        costo_ingredientes:       0,
        costo_con_merma:          0,
        costo_unitario:           0,
        precio_sugerido_minimo:   0,
        precio_actual:            Math.round(precioActual),
        margen_actual_porcentaje: 0,
        es_rentable:              false,
        diferencia_precio:        0,
        alerta_rentabilidad:      null,
        datos_incompletos:        true,
        ingredientes_sin_precio:  ingredientesSinPrecio,
        advertencias,
      };
    }

    const merma     = Number(receta.merma_esperada_porcentaje ?? 0) / 100;
    const costoCon  = merma > 0 ? costoIngredientes / (1 - merma) : costoIngredientes;
    const costoUnit = costoCon / Number(receta.cantidad_producida);
    const precioSugeridoMinimo = Math.ceil(costoUnit / (1 - MARGEN_DEFAULT));

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
      datos_incompletos:        false,
      ingredientes_sin_precio:  0,
      advertencias,
    };
  },

  /**
   * Verifica disponibilidad de ingredientes para una lista de productos+cantidades
   * ANTES de crear la orden (no requiere que la orden exista).
   */
  async verificarDisponibilidadParaDetalles(
    detalles: { id_producto: number; cantidad: number }[],
    id_restaurante?: number,
  ) {
    const faltantes: {
      producto: string; ingrediente: string;
      cantidad_necesaria: number; stock_actual: number; unidad: string;
    }[] = [];

    for (const det of detalles) {
      // La receta que aplica es la de la SEDE que prepara la orden
      const receta = await recetaRepository.findByProductoFinal(det.id_producto, id_restaurante);
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

  async verificarStockParaOrden(id_orden: number, ctx?: TenantCtx) {
    const orden = await prisma.orden.findUnique({
      where: { id: id_orden },
      include: { detalles: { include: { producto: true } } },
    });
    if (!orden) throw new NotFoundError('Orden');
    // Anti-IDOR: la orden debe ser de la sede activa (mismo error que "no existe")
    if (ctx && !ctx.esSuperAdmin && ctx.restauranteId !== undefined && orden.id_restaurante !== ctx.restauranteId) {
      throw new NotFoundError('Orden');
    }

    const faltantes: {
      producto: string; ingrediente: string;
      cantidad_necesaria: number; stock_actual: number; unidad: string;
    }[] = [];

    for (const detalle of orden.detalles) {
      // La receta que aplica es la de la sede de la orden
      const receta = await recetaRepository.findByProductoFinal(detalle.id_producto, orden.id_restaurante);

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

  /**
   * _descontarIngredientesDeVenta — lógica única de descuento de ingredientes por receta.
   *
   * Reusada por descontarIngredientesOrden (legado, vía OrdenDetalle) y
   * descontarIngredientesSede (arquitectura nueva, vía OrdenSedeItem) para que ambas
   * rutas apliquen exactamente la misma fórmula, respeten ingredientes opcionales,
   * conviertan unidades y registren auditoría real — antes divergían entre sí.
   */
  async _descontarIngredientesDeVenta(tx: any, params: {
    id_orden: number;
    numero_orden: string;
    id_restaurante: number;
    items: Array<{ id_producto: number; cantidad: number }>;
  }) {
    for (const item of params.items) {
      const receta = await tx.receta.findFirst({
        where: { id_producto_final: item.id_producto, id_restaurante: params.id_restaurante, estado: 'activo' },
        include: {
          ingredientes: {
            include: { producto: true },
            orderBy: { orden: 'asc' },
          },
        },
      });
      if (!receta) continue; // sin receta → su stock se descontó al crear la orden

      // ing.cantidad está definida para producir `cantidad_producida` unidades del
      // producto final — por eso se divide antes de multiplicar por lo vendido.
      const factorPorUnidad = item.cantidad / Number(receta.cantidad_producida);

      for (const ing of receta.ingredientes) {
        if (ing.es_opcional) continue;

        const cantidadEnReceta = Number(ing.cantidad) * factorPorUnidad;
        const producto = await tx.producto.findUnique({ where: { id: ing.id_producto } });
        if (!producto) continue;

        // Convertir la cantidad de la receta a la unidad en que está el stock del producto
        const cantidadDescontar = convertUnits(cantidadEnReceta, ing.unidad, producto.unidad_medida);

        // Stock POR SEDE (ProductoStock) — fuente autoritativa multi-sede.
        // Si la sede aún no tiene fila, se inicializa desde el campo legacy.
        const stockRecord = await tx.productoStock.findUnique({
          where: { id_producto_id_restaurante: { id_producto: ing.id_producto, id_restaurante: params.id_restaurante } },
        });
        const stockAnterior = stockRecord ? Number(stockRecord.stock_actual) : Number(producto.stock_actual);
        const stockNuevo = Math.max(0, stockAnterior - cantidadDescontar);

        await tx.productoStock.upsert({
          where:  { id_producto_id_restaurante: { id_producto: ing.id_producto, id_restaurante: params.id_restaurante } },
          update: { stock_actual: toDecimal(stockNuevo) },
          create: {
            id_producto:    ing.id_producto,
            id_restaurante: params.id_restaurante,
            stock_actual:   toDecimal(stockNuevo),
            stock_minimo:   producto.stock_minimo,
            stock_maximo:   producto.stock_maximo ?? undefined,
          },
        });

        // Campo legacy — se mantiene por compatibilidad con código que aún lo lee
        await tx.producto.update({
          where: { id: ing.id_producto },
          data:  { stock_actual: toDecimal(stockNuevo) },
        });

        await tx.movimiento.create({
          data: {
            id_producto:     ing.id_producto,
            id_restaurante:  params.id_restaurante,
            tipo_movimiento: 'salida',
            cantidad:        toDecimal(cantidadDescontar),
            stock_anterior:  toDecimal(stockAnterior),
            stock_nuevo:     toDecimal(stockNuevo),
            motivo:          `Ingrediente receta "${receta.nombre_receta}" - Orden ${params.numero_orden}`,
            id_orden:        params.id_orden,
          },
        });
      }
    }

    try {
      await alertaService.sincronizar();
    } catch { /* no bloquear el flujo principal */ }
  },

  /** Legado: descuenta ingredientes de receta para los OrdenDetalle de una orden. */
  async descontarIngredientesOrden(id_orden: number, tx: any) {
    const orden = await tx.orden.findUnique({
      where: { id: id_orden },
      include: { detalles: true },
    });
    if (!orden) return;

    await this._descontarIngredientesDeVenta(tx, {
      id_orden,
      numero_orden:   orden.numero_orden,
      id_restaurante: orden.id_restaurante,
      items: orden.detalles.map((d: { id_producto: number; cantidad: unknown }) => ({
        id_producto: d.id_producto,
        cantidad:    Number(d.cantidad),
      })),
    });
  },

  /** Arquitectura nueva: descuenta ingredientes de receta para los OrdenSedeItem de una sede. */
  async descontarIngredientesSede(params: {
    id_orden: number;
    numero_orden: string;
    id_restaurante: number;
    items: Array<{ id_producto: number; cantidad: number }>;
  }, tx: any) {
    await this._descontarIngredientesDeVenta(tx, params);
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
