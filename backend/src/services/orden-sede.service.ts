/**
 * OrdenSedeService — operaciones de cocina por restaurante
 *
 * Este service maneja el ciclo de vida de OrdenSede:
 *   avanzarEstado()  → PENDIENTE → EN_PREPARACION → LISTA
 *   agregarItem()    → agrega producto a una sede activa
 *   actualizarItem() → modifica cantidad / notas
 *   eliminarItem()   → quita producto y revierte stock
 *   cancelar()       → cancela esta sede (feature-flagged)
 *
 * La saga OrdenDeliveryReadinessSaga escucha SEDE_LISTA y transiciona
 * la Orden global a LISTA cuando todas las sedes terminan.
 */

import { EstadoOrdenSede, EstadoOrdenGlobal } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import { ordenSedeRepository }  from '../repositories/orden-sede.repository';
import { ordenRepository }      from '../repositories/orden.repository';
import { configuracionRepository } from '../repositories/configuracion.repository';
import { NotFoundError, BadRequestError } from '../exceptions/HttpErrors';
import { toDecimal }            from '../lib/decimal';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { recetaService }        from './receta.service';
import { eventBus }             from '../events/eventBus';
import { EVENTS }               from '../events/events';
import type { TenantCtx }       from '../lib/tenantCtx';

const TRANSICIONES: Record<EstadoOrdenSede, EstadoOrdenSede[]> = {
  PENDIENTE:      [EstadoOrdenSede.EN_PREPARACION, EstadoOrdenSede.CANCELADA],
  EN_PREPARACION: [EstadoOrdenSede.LISTA,          EstadoOrdenSede.CANCELADA],
  LISTA:          [EstadoOrdenSede.ENTREGADA],
  ENTREGADA:      [],
  CANCELADA:      [],
};

function validarTransicion(desde: EstadoOrdenSede, hacia: EstadoOrdenSede) {
  if (!TRANSICIONES[desde]?.includes(hacia)) {
    throw new BadRequestError(`Transición inválida de sede: ${desde} → ${hacia}`);
  }
}

async function getTasaIva(): Promise<number | null> {
  try {
    const activo = await configuracionRepository.findByClave('impuestos_activos');
    if (!activo || configuracionRepository.parseValor(activo) === false) return null;
    const tasa = await configuracionRepository.findByClave('porcentaje_iva');
    return tasa ? Number(configuracionRepository.parseValor(tasa)) : 19;
  } catch { return 19; }
}

export const ordenSedeService = {

  // ── Vista de cocina ────────────────────────────────────────────────────────
  /**
   * Lista las sedes activas de un restaurante.
   * Usado por la pantalla de cocina / KDS — solo muestra las sedes de ESE restaurante.
   */
  async listarPorRestaurante(id_restaurante: number, params: {
    page?:   unknown;
    limit?:  unknown;
    estado?: EstadoOrdenSede;
    desde?:  Date;
    hasta?:  Date;
  }) {
    const pagination = getPaginationParams(params.page, params.limit);
    const [sedes, total] = await ordenSedeRepository.findActivas(id_restaurante, pagination, {
      estado: params.estado,
      desde:  params.desde,
      hasta:  params.hasta,
    });
    return buildPaginatedResult(sedes, total, pagination);
  },

  async obtenerPorId(id: number) {
    const sede = await ordenSedeRepository.findById(id);
    if (!sede) throw new NotFoundError('OrdenSede');
    return sede;
  },

  // ── Avanzar estado de cocina ───────────────────────────────────────────────
  /**
   * Avanza el estado de la sede al siguiente en la cadena.
   * PENDIENTE → EN_PREPARACION → LISTA
   *
   * Al llegar a LISTA, el servicio verifica si TODAS las sedes de la Orden
   * están listas y, si es así, transiciona la Orden global a LISTA.
   * Emite SEDE_EN_PREPARACION o SEDE_LISTA según el caso.
   */
  async avanzarEstado(id_sede: number, ctx: TenantCtx, id_usuario?: number) {
    const sede = await ordenSedeRepository.findByIdScoped(id_sede, ctx);

    const siguienteEstado = TRANSICIONES[sede.estado][0];
    if (!siguienteEstado || siguienteEstado === EstadoOrdenSede.CANCELADA) {
      throw new BadRequestError(
        `La sede no puede avanzar desde el estado ${sede.estado}`
      );
    }

    validarTransicion(sede.estado, siguienteEstado);

    const extraData: Partial<{
      fecha_inicio_prep:  Date;
      fecha_lista:        Date;
      fecha_cancelacion:  Date;
      motivo_cancelacion: string;
    }> = {};
    if (siguienteEstado === EstadoOrdenSede.EN_PREPARACION) {
      extraData.fecha_inicio_prep = new Date();
    }
    if (siguienteEstado === EstadoOrdenSede.LISTA) {
      extraData.fecha_lista = new Date();
    }

    const sedeActualizada = await ordenSedeRepository.updateEstado(id_sede, siguienteEstado, extraData);

    // Registrar evento en OrdenEvento
    await ordenRepository.registrarEvento({
      id_orden:    sede.id_orden,
      tipo_evento: siguienteEstado === EstadoOrdenSede.EN_PREPARACION
        ? 'SEDE_EN_PREPARACION'
        : 'SEDE_LISTA',
      payload: { id_sede, id_restaurante: sede.id_restaurante, sufijo: (sede as Record<string, unknown>).sufijo },
      id_usuario,
    });

    // Emitir evento al bus
    if (siguienteEstado === EstadoOrdenSede.EN_PREPARACION) {
      eventBus.emit(EVENTS.SEDE_EN_PREPARACION, {
        idOrden:       sede.id_orden,
        idSede:        id_sede,
        idRestaurante: sede.id_restaurante,
        sufijo:        (sede as Record<string, unknown>).sufijo,
      });

      // Si la Orden global estaba en RECIBIDA → pasar a EN_PROCESO
      const orden = await ordenRepository.findById(sede.id_orden);
      if (orden?.estado_global === EstadoOrdenGlobal.RECIBIDA) {
        await ordenRepository.updateEstadoGlobal(sede.id_orden, EstadoOrdenGlobal.EN_PROCESO);
      }
    }

    if (siguienteEstado === EstadoOrdenSede.LISTA) {
      eventBus.emit(EVENTS.SEDE_LISTA, {
        idOrden:       sede.id_orden,
        idSede:        id_sede,
        idRestaurante: sede.id_restaurante,
      });

      // Verificar si todas las sedes están listas → activar saga
      const todasListas = await ordenSedeRepository.todasListas(sede.id_orden);
      if (todasListas) {
        const orden = await ordenRepository.findById(sede.id_orden);
        if (orden && orden.estado_global !== EstadoOrdenGlobal.LISTA) {
          await ordenRepository.updateEstadoGlobal(sede.id_orden, EstadoOrdenGlobal.LISTA);
          await ordenRepository.registrarEvento({
            id_orden:    sede.id_orden,
            tipo_evento: 'ORDEN_LISTA',
            payload:     { todas_sedes_listas: true },
            id_usuario,
          });
          eventBus.emit(EVENTS.ORDEN_LISTA, {
            idOrden:     sede.id_orden,
            numeroOrden: orden.numero_orden,
            idGrupo:     orden.id_grupo,
            total:       Number(orden.total),
          });
        }
      }
    }

    return sedeActualizada;
  },

  // ── Gestión de ítems de la sede ────────────────────────────────────────────
  /**
   * Agrega un producto a la sede (mesero modifica la orden después de abrirla).
   * Valida stock del restaurante de esa sede — nunca del global ni de otra sede.
   */
  async agregarItem(id_sede: number, data: {
    id_producto:     number;
    id_variante?:    number;
    cantidad:        number;
    precio_unitario: number;
    descuento?:      number;
    notas?:          string;
  }, ctx: TenantCtx) {
    const sede = await ordenSedeRepository.findByIdScoped(id_sede, ctx);

    if (sede.estado === EstadoOrdenSede.LISTA || sede.estado === EstadoOrdenSede.ENTREGADA) {
      throw new BadRequestError('No se puede modificar una sede ya terminada');
    }
    if (sede.estado === EstadoOrdenSede.CANCELADA) {
      throw new BadRequestError('La sede está cancelada');
    }

    // Verificar receta y stock
    await recetaService.verificarDisponibilidadParaDetalles([
      { id_producto: data.id_producto, cantidad: data.cantidad },
    ]);

    const tasaIva = await getTasaIva();

    return prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findUnique({ where: { id: data.id_producto } });
      if (!producto) throw new NotFoundError('Producto');

      const receta = await tx.receta.findFirst({
        where: { id_producto_final: data.id_producto, id_restaurante: sede.id_restaurante, estado: 'activo' },
        select: { id: true },
      });

      if (!receta) {
        const stockReg = await tx.productoStock.findUnique({
          where: { id_producto_id_restaurante: { id_producto: data.id_producto, id_restaurante: sede.id_restaurante } },
        });
        const disponible = stockReg ? Number(stockReg.stock_actual) : Number(producto.stock_actual);
        if (disponible < data.cantidad) throw new BadRequestError('Stock insuficiente para esta sede');
      }

      const pu   = toDecimal(data.precio_unitario);
      const cant = toDecimal(data.cantidad);
      const desc = toDecimal(data.descuento ?? 0);
      const sub  = pu.times(cant);

      const item = await tx.ordenSedeItem.create({
        data: {
          id_sede,
          id_producto:     data.id_producto,
          id_variante:     data.id_variante,
          cantidad:        cant,
          precio_unitario: pu,
          descuento:       desc,
          subtotal:        sub,
          total:           sub.minus(desc),
          notas:           data.notas,
        },
        include: { producto: true, variante: { select: { id: true, nombre: true } } },
      });

      // Descontar stock si no tiene receta
      if (!receta) {
        const stockReg = await tx.productoStock.findUnique({
          where: { id_producto_id_restaurante: { id_producto: data.id_producto, id_restaurante: sede.id_restaurante } },
        });
        if (stockReg) {
          await tx.productoStock.update({
            where: { id_producto_id_restaurante: { id_producto: data.id_producto, id_restaurante: sede.id_restaurante } },
            data: { stock_actual: toDecimal(Number(stockReg.stock_actual) - data.cantidad) },
          });
        } else {
          await tx.producto.update({
            where: { id: data.id_producto },
            data: { stock_actual: toDecimal(Number(producto.stock_actual) - data.cantidad) },
          });
        }
      }

      // Recalcular totales de la sede y consolidar en la Orden
      await ordenSedeRepository.recalcularTotales(tx, id_sede, tasaIva);
      const sedeActualizada = await tx.ordenSede.findUnique({ where: { id: id_sede } });
      if (sedeActualizada) {
        const todasSedes = await tx.ordenSede.findMany({ where: { id_orden: sede.id_orden } });
        const subtotalTotal = todasSedes.reduce((a: Decimal, s: { subtotal: Decimal }) => a.plus(s.subtotal), new Decimal(0));
        const impTotal = tasaIva !== null ? subtotalTotal.times(tasaIva / 100) : new Decimal(0);
        await tx.orden.update({
          where: { id: sede.id_orden },
          data: { subtotal: subtotalTotal, impuestos: impTotal, total: subtotalTotal.plus(impTotal) },
        });
      }

      return item;
    });
  },

  async actualizarItem(id_item: number, data: { cantidad?: number; notas?: string }, ctx: TenantCtx) {
    const item = await ordenSedeRepository.findItemById(id_item);
    if (!item) throw new NotFoundError('Item de sede');

    // Valida que la sede padre pertenece al tenant del ctx
    const sede = await ordenSedeRepository.findByIdScoped(item.id_sede, ctx);
    if (sede.estado === EstadoOrdenSede.LISTA || sede.estado === EstadoOrdenSede.ENTREGADA || sede.estado === EstadoOrdenSede.CANCELADA) {
      throw new BadRequestError('No se puede modificar este item');
    }

    const tasaIva = await getTasaIva();

    return prisma.$transaction(async (tx) => {
      const updateData: Partial<{
        cantidad: Decimal;
        subtotal: Decimal;
        total:    Decimal;
        notas:    string;
      }> = {};
      if (data.cantidad != null) {
        updateData.cantidad = toDecimal(data.cantidad);
        updateData.subtotal = item.precio_unitario.times(data.cantidad);
        updateData.total    = updateData.subtotal.minus(item.descuento);
      }
      if (data.notas != null) updateData.notas = data.notas;

      const actualizado = await tx.ordenSedeItem.update({ where: { id: id_item }, data: updateData, include: { producto: true } });
      await ordenSedeRepository.recalcularTotales(tx, item.id_sede, tasaIva);
      return actualizado;
    });
  },

  async eliminarItem(id_item: number, ctx: TenantCtx) {
    const item = await ordenSedeRepository.findItemById(id_item);
    if (!item) throw new NotFoundError('Item de sede');

    // Valida que la sede padre pertenece al tenant del ctx
    const sede = await ordenSedeRepository.findByIdScoped(item.id_sede, ctx);
    if (sede.estado !== EstadoOrdenSede.PENDIENTE && sede.estado !== EstadoOrdenSede.EN_PREPARACION) {
      throw new BadRequestError('No se puede eliminar items de una sede en este estado');
    }

    const tasaIva = await getTasaIva();

    return prisma.$transaction(async (tx) => {
      // Devolver stock si no tiene receta
      const receta = await tx.receta.findFirst({
        where: { id_producto_final: item.id_producto, id_restaurante: sede.id_restaurante, estado: 'activo' },
        select: { id: true },
      });

      if (!receta) {
        const stockReg = await tx.productoStock.findUnique({
          where: { id_producto_id_restaurante: { id_producto: item.id_producto, id_restaurante: sede.id_restaurante } },
        });
        if (stockReg) {
          await tx.productoStock.update({
            where: { id_producto_id_restaurante: { id_producto: item.id_producto, id_restaurante: sede.id_restaurante } },
            data: { stock_actual: toDecimal(Number(stockReg.stock_actual) + Number(item.cantidad)) },
          });
        }
      }

      await tx.ordenSedeItem.delete({ where: { id: id_item } });
      await ordenSedeRepository.recalcularTotales(tx, item.id_sede, tasaIva);
    });
  },

  // ── Cancelar sede ──────────────────────────────────────────────────────────
  /**
   * Cancela solo esta sede (feature-flagged: 'orden.cancelacion_parcial').
   * Si es la única sede activa de la Orden → cancela la Orden completa.
   */
  async cancelar(id_sede: number, motivo: string, ctx: TenantCtx, id_usuario?: number) {
    const sede = await ordenSedeRepository.findByIdScoped(id_sede, ctx);

    if (sede.estado === EstadoOrdenSede.ENTREGADA) {
      throw new BadRequestError('No se puede cancelar una sede ya entregada');
    }
    if (sede.estado === EstadoOrdenSede.CANCELADA) {
      throw new BadRequestError('La sede ya está cancelada');
    }

    return prisma.$transaction(async (tx) => {
      // Revertir stock de productos sin receta
      const items = await tx.ordenSedeItem.findMany({ where: { id_sede } });
      for (const item of items) {
        const receta = await tx.receta.findFirst({
          where: { id_producto_final: item.id_producto, id_restaurante: sede.id_restaurante, estado: 'activo' },
          select: { id: true },
        });
        if (receta) continue;

        const stockReg = await tx.productoStock.findUnique({
          where: { id_producto_id_restaurante: { id_producto: item.id_producto, id_restaurante: sede.id_restaurante } },
        });
        if (stockReg) {
          await tx.productoStock.update({
            where: { id_producto_id_restaurante: { id_producto: item.id_producto, id_restaurante: sede.id_restaurante } },
            data: { stock_actual: toDecimal(Number(stockReg.stock_actual) + Number(item.cantidad)) },
          });
        }
      }

      // Cancelar la sede
      await tx.ordenSede.update({
        where: { id: id_sede },
        data: { estado: EstadoOrdenSede.CANCELADA, fecha_cancelacion: new Date(), motivo_cancelacion: motivo },
      });

      // ¿Es la última sede activa?
      const sedesRestantes = await tx.ordenSede.count({
        where: { id_orden: sede.id_orden, estado: { not: EstadoOrdenSede.CANCELADA } },
      });

      const eraUnica = sedesRestantes === 0;

      if (eraUnica) {
        // Cancelar la orden completa
        await tx.orden.update({
          where: { id: sede.id_orden },
          data: { estado_global: EstadoOrdenGlobal.CANCELADA, fecha_cancelacion: new Date(), motivo_cancelacion: motivo },
        });
      }

      await tx.ordenEvento.create({
        data: {
          id_orden:    sede.id_orden,
          tipo_evento: 'SEDE_CANCELADA',
          payload:     { id_sede, id_restaurante: sede.id_restaurante, motivo, cancelacion_total: eraUnica },
          id_usuario,
        },
      });

      eventBus.emit(EVENTS.SEDE_CANCELADA, {
        idOrden:       sede.id_orden,
        idSede:        id_sede,
        idRestaurante: sede.id_restaurante,
        motivo,
        eraUnicaSede:  eraUnica,
      });
    });
  },
};
