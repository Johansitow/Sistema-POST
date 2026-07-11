/**
 * OrdenService — nueva arquitectura multi-restaurante
 *
 * Orden es el aggregate root global. Cada restaurante opera sobre su OrdenSede.
 *
 * Flujo principal:
 *   crear()            → Orden + N OrdenSede en una sola TX
 *   pagar()            → PagoOrden + cierre Factura → saga de entrega
 *   cancelar()         → cancela Orden + todas las sedes + revierte stock
 *   actualizarEstado() → compatibilidad legado (ordenes sin sedes)
 *
 * Legado (órdenes con OrdenDetalle directo):
 *   Las operaciones legado siguen funcionando sin cambios para órdenes
 *   creadas antes de esta migración.
 */

import { EstadoOrdenGlobal, TipoOrden } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import { ordenRepository, includeOrdenCompleta } from '../repositories/orden.repository';
import { ordenSedeRepository as _ordenSedeRepository }  from '../repositories/orden-sede.repository';
import { pagoOrdenRepository as _pagoOrdenRepository }  from '../repositories/pago-orden.repository';
import { estadoRepository }     from '../repositories/estado.repository';
import { NotFoundError, BadRequestError } from '../exceptions/HttpErrors';
import { toDecimal, calcularTotales }     from '../lib/decimal';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { generarNumeroOrden }   from '../lib/numero-generator';
import { facturaService }       from './factura.service';
import { recetaService }        from './receta.service';
import { configuracionService } from './configuracion.service';
import { eventBus }             from '../events/eventBus';
import { EVENTS }               from '../events/events';
import type { TenantCtx }       from '../lib/tenantCtx';

const SUFIJOS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ── IVA/impoconsumo desde configuración (sede → grupo → global) ──────────────
/** Resuelve tarifa + tipo de impuesto del restaurante. null si no hay ninguna capa configurada. */
async function resolverImpuestoDeRestaurante(id_restaurante: number | undefined): Promise<{ tarifa: number; tipo: string } | null> {
  if (!id_restaurante) return null;
  return configuracionService.resolverTasaImpuestoDeRestaurante(id_restaurante);
}

// ── Consolidar totales de Orden desde sus sedes ───────────────────────────────
// Suma los impuestos YA resueltos por sede (cada una puede tener su propia tasa,
// por eso no se recalcula con una tasa única aquí).
async function consolidarTotalesOrden(tx: any, id_orden: number) {
  const sedes = await tx.ordenSede.findMany({ where: { id_orden } });
  const orden = await tx.orden.findUnique({
    where: { id: id_orden },
    select: { descuento: true, propina: true, costo_domicilio: true },
  });
  if (!orden) return;

  const subtotalSedes = sedes.reduce(
    (acc: Decimal, s: any) => acc.plus(s.subtotal),
    new Decimal(0)
  );
  const impuestosTotal = sedes.reduce(
    (acc: Decimal, s: any) => acc.plus(s.impuestos),
    new Decimal(0)
  );
  const total = subtotalSedes
    .plus(impuestosTotal)
    .plus(orden.propina ?? 0)
    .plus(orden.costo_domicilio ?? 0)
    .minus(orden.descuento ?? 0);

  // El ticket de la Orden global solo puede mostrar un tipo de impuesto — se
  // propaga el de las sedes cuando todas coinciden (el caso común de un solo
  // restaurante). En un pedido multi-sede con tipos distintos queda null y el
  // detalle real vive en cada OrdenSede.
  const tiposUnicos = [...new Set(sedes.map((s: any) => s.impuesto_tipo).filter(Boolean))];
  const impuestoTipo = tiposUnicos.length === 1 ? tiposUnicos[0] : null;

  await tx.orden.update({
    where: { id: id_orden },
    data: { subtotal: subtotalSedes, impuestos: impuestosTotal, impuesto_tipo: impuestoTipo, total },
  });
}

export const ordenService = {

  // ── Listar ────────────────────────────────────────────────────────────────

  async listar(params: {
    page?: unknown; limit?: unknown; tipo_orden?: TipoOrden;
    id_estado?: number; estado_global?: EstadoOrdenGlobal;
    fecha_desde?: Date; fecha_hasta?: Date;
    id_restaurante?: number; id_grupo?: number;
  }) {
    const pagination = getPaginationParams(params.page, params.limit);
    const [ordenes, total] = await ordenRepository.findAll(pagination, {
      tipo_orden:     params.tipo_orden,
      id_estado:      params.id_estado,
      estado_global:  params.estado_global,
      fecha_desde:    params.fecha_desde,
      fecha_hasta:    params.fecha_hasta,
      id_restaurante: params.id_restaurante,
      id_grupo:       params.id_grupo,
    });
    return buildPaginatedResult(ordenes, total, pagination);
  },

  async obtenerPorId(id: number) {
    const orden = await ordenRepository.findById(id);
    if (!orden) throw new NotFoundError('Orden');
    return orden;
  },

  // ── CREAR — nueva arquitectura ────────────────────────────────────────────
  /**
   * Crea la Orden global + una OrdenSede por restaurante en una sola transacción.
   *
   * Para una orden simple: sedes[] tiene un solo elemento.
   * Para multi-restaurante: sedes[] tiene N elementos — cada uno con su id_restaurante e items.
   *
   * Stock de productos sin receta → se descuenta al crear (por restaurante).
   * Stock de ingredientes de recetas → se descuenta al ENTREGADA (StockDeductionSaga).
   */
  async crear(data: {
    id_grupo:    number;
    id_usuario:  number;
    id_cliente?: number;
    tipo_orden:  TipoOrden;
    // Campos delivery
    direccion_entrega?:   string;
    telefono_contacto?:   string;
    nombre_contacto?:     string;
    notas_entrega?:       string;
    costo_domicilio?:     number;
    plataforma_delivery?: string;
    propina?:             number;
    descuento?:           number;
    observaciones?:       string;
    sedes: Array<{
      id_restaurante: number;
      items: Array<{
        id_producto:      number;
        id_variante?:     number;
        cantidad:         number;
        precio_unitario:  number;
        descuento?:       number;
        notas?:           string;
      }>;
    }>;
  }) {
    // Verificar disponibilidad de recetas POR restaurante, antes de abrir TX
    for (const sede of data.sedes) {
      await recetaService.verificarDisponibilidadParaDetalles(
        sede.items.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad }))
      );
    }

    return prisma.$transaction(async (tx) => {
      const ultima = await ordenRepository.findUltima();
      const numero_orden = generarNumeroOrden(ultima?.numero_orden ?? null);

      // 1. Crear la Orden global
      const orden = await tx.orden.create({
        data: {
          numero_orden,
          tipo_orden:          data.tipo_orden,
          id_estado:           1,                 // estado legado — se mantiene para compatibilidad
          id_usuario:          data.id_usuario,
          id_cliente:          data.id_cliente,
          id_restaurante:      data.sedes[0].id_restaurante,  // sede principal
          id_grupo:            data.id_grupo,
          estado_global:       EstadoOrdenGlobal.RECIBIDA,
          direccion_entrega:   data.direccion_entrega,
          telefono_contacto:   data.telefono_contacto,
          nombre_contacto:     data.nombre_contacto,
          notas_entrega:       data.notas_entrega,
          costo_domicilio:     toDecimal(data.costo_domicilio ?? 0),
          plataforma_delivery: data.plataforma_delivery,
          descuento:           toDecimal(data.descuento ?? 0),
          propina:             toDecimal(data.propina ?? 0),
          observaciones:       data.observaciones,
          subtotal:            new Decimal(0),
          impuestos:           new Decimal(0),
          total:               new Decimal(0),
        },
      });

      // 2. Crear una OrdenSede por restaurante
      for (let idx = 0; idx < data.sedes.length; idx++) {
        const sedeData = data.sedes[idx];
        const sufijo = data.sedes.length > 1 ? `-${SUFIJOS[idx] ?? idx}` : null;

        // Calcular totales de esta sede
        let sedeSubtotal = new Decimal(0);
        const itemsData: any[] = [];
        const stockMeta: Array<{ id_producto: number; cantidad: number; tieneReceta: boolean; id_restaurante: number }> = [];

        for (const item of sedeData.items) {
          const producto = await tx.producto.findUnique({ where: { id: item.id_producto } });
          if (!producto) throw new BadRequestError(`Producto ${item.id_producto} no encontrado`);

          // Verificar si tiene receta activa en este restaurante
          const receta = await tx.receta.findFirst({
            where: { id_producto_final: item.id_producto, id_restaurante: sedeData.id_restaurante, estado: 'activo' },
            select: { id: true },
          });

          // Validar stock solo para productos sin receta
          if (!receta) {
            const stock = await tx.productoStock.findUnique({
              where: { id_producto_id_restaurante: { id_producto: item.id_producto, id_restaurante: sedeData.id_restaurante } },
            });
            const stockDisponible = stock ? Number(stock.stock_actual) : Number(producto.stock_actual);
            if (stockDisponible < item.cantidad) {
              throw new BadRequestError(`Stock insuficiente para ${producto.nombre} en la sede`);
            }
          }

          const pu   = toDecimal(item.precio_unitario);
          const cant = toDecimal(item.cantidad);
          const desc = toDecimal(item.descuento ?? 0);
          const sub  = pu.times(cant);
          sedeSubtotal = sedeSubtotal.plus(sub);

          itemsData.push({
            id_producto:     item.id_producto,
            id_variante:     item.id_variante,
            cantidad:        cant,
            precio_unitario: pu,
            descuento:       desc,
            subtotal:        sub,
            total:           sub.minus(desc),
            notas:           item.notas,
          });

          stockMeta.push({
            id_producto:    item.id_producto,
            cantidad:       item.cantidad,
            tieneReceta:    !!receta,
            id_restaurante: sedeData.id_restaurante,
          });
        }

        // Cada sede resuelve su propio impuesto — puede diferir entre restaurantes del mismo pedido
        const impuestoSede  = await resolverImpuestoDeRestaurante(sedeData.id_restaurante);
        const sedeImpuestos = impuestoSede ? sedeSubtotal.times(impuestoSede.tarifa / 100) : new Decimal(0);
        const sedeTotal     = sedeSubtotal.plus(sedeImpuestos);

        // Crear sede con sus ítems
        await tx.ordenSede.create({
          data: {
            id_orden:       orden.id,
            id_restaurante: sedeData.id_restaurante,
            sufijo,
            estado:         'PENDIENTE',
            subtotal:       sedeSubtotal,
            impuestos:      sedeImpuestos,
            impuesto_tipo:  impuestoSede?.tipo,
            total:          sedeTotal,
            items:          { create: itemsData },
          },
        });

        // Descontar stock inmediatamente para productos sin receta
        for (const meta of stockMeta) {
          if (meta.tieneReceta) continue;

          // Intentar descontar de ProductoStock (por restaurante) si existe
          const stockReg = await tx.productoStock.findUnique({
            where: { id_producto_id_restaurante: { id_producto: meta.id_producto, id_restaurante: meta.id_restaurante } },
          });

          if (stockReg) {
            const nuevoStock = Number(stockReg.stock_actual) - meta.cantidad;
            await tx.productoStock.update({
              where: { id_producto_id_restaurante: { id_producto: meta.id_producto, id_restaurante: meta.id_restaurante } },
              data: { stock_actual: toDecimal(nuevoStock) },
            });
          } else {
            // Fallback: descontar del stock global del producto
            const prod = await tx.producto.findUnique({ where: { id: meta.id_producto } });
            if (prod) {
              await tx.producto.update({
                where: { id: meta.id_producto },
                data: { stock_actual: toDecimal(Number(prod.stock_actual) - meta.cantidad) },
              });
            }
          }

          await tx.movimiento.create({
            data: {
              id_producto:     meta.id_producto,
              id_restaurante:  meta.id_restaurante,
              tipo_movimiento: 'venta',
              cantidad:        toDecimal(meta.cantidad),
              stock_anterior:  toDecimal(0), // aproximado — el valor real está en ProductoStock
              stock_nuevo:     toDecimal(0),
              motivo:          `Venta - Orden ${numero_orden}`,
              id_orden:        orden.id,
            },
          });
        }
      }

      // 3. Consolidar totales de la Orden desde sus sedes
      await consolidarTotalesOrden(tx, orden.id);

      // 4. Registrar evento
      await tx.ordenEvento.create({
        data: {
          id_orden:    orden.id,
          tipo_evento: 'ORDEN_CREADA',
          payload:     { numero_orden, id_grupo: data.id_grupo, sedes_count: data.sedes.length },
          id_usuario:  data.id_usuario,
        },
      });

      // 5. Emitir evento al bus (fire-and-forget) y obtener la orden completa.
      // Se consulta vía `tx` (no el cliente prisma global) porque la transacción
      // todavía no hizo commit — una consulta fuera de `tx` no vería estas filas
      // y devolvería null.
      const ordenFinal = await tx.orden.findUnique({
        where: { id: orden.id },
        include: includeOrdenCompleta,
      });

      eventBus.emit(EVENTS.ORDEN_GLOBAL_CREADA, {
        idOrden:     orden.id,
        numeroOrden: numero_orden,
        idGrupo:     data.id_grupo,
        idCliente:   data.id_cliente,
        tipoOrden:   data.tipo_orden,
        total:       0, // se recalculará
        sedes:       (ordenFinal?.sedes ?? []).map(s => ({
          idSede:        s.id,
          idRestaurante: s.id_restaurante,
          sufijo:        s.sufijo ?? '',
        })),
      });

      // Evento legado para compatibilidad con socket gateway
      eventBus.emit(EVENTS.ORDEN_CREADA, {
        idOrden:       orden.id,
        numeroOrden:   numero_orden,
        idRestaurante: data.sedes[0].id_restaurante,
        idGrupo:       data.id_grupo,
        idCliente:     data.id_cliente,
        tipoOrden:     data.tipo_orden,
        total:         0,
      });

      return ordenFinal;
    });
  },

  // ── PAGAR — nueva arquitectura ────────────────────────────────────────────
  /**
   * Registra el pago de la Orden global y activa la saga de entrega.
   * Solo se puede pagar si estado_global === LISTA (todas las sedes terminaron).
   * Permite múltiples métodos de pago en una sola llamada.
   */
  async pagar(
    id: number,
    pagos: Array<{ id_metodo_pago: number; monto: number; referencia?: string; notas?: string }>,
    ctx: TenantCtx,
    id_usuario?: number
  ) {
    const orden = await ordenRepository.findByIdScoped(id, ctx);

    if (!orden.sedes || orden.sedes.length === 0) {
      // Fallback al flujo legado si la orden no tiene sedes (ya validado por findByIdScoped)
      return this.actualizarEstadoLegado(id, pagos);
    }

    if (orden.estado_global === EstadoOrdenGlobal.ENTREGADA) {
      throw new BadRequestError('La orden ya fue entregada');
    }
    if (orden.estado_global === EstadoOrdenGlobal.CANCELADA) {
      throw new BadRequestError('La orden está cancelada');
    }
    if (orden.estado_global !== EstadoOrdenGlobal.LISTA) {
      throw new BadRequestError(
        `La orden no está lista para cobrar (estado actual: ${orden.estado_global}). ` +
        `Todas las sedes deben completar su preparación primero.`
      );
    }

    const totalOrden  = Number(orden.total);
    const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);

    if (totalPagado < totalOrden) {
      throw new BadRequestError(
        `El monto pagado (${totalPagado}) es menor al total de la orden (${totalOrden})`
      );
    }

    return prisma.$transaction(async (tx) => {
      // 1. Crear registros PagoOrden
      for (const pago of pagos) {
        await tx.pagoOrden.create({
          data: {
            id_orden:       id,
            id_metodo_pago: pago.id_metodo_pago,
            monto:          toDecimal(pago.monto),
            referencia:     pago.referencia,
            notas:          pago.notas,
            estado:         'confirmado',
          },
        });
      }

      // 2. Generar/cerrar factura global
      await facturaService.garantizarPagada(id, tx);

      // 3. Actualizar estado global → ENTREGADA y registrar fecha
      await tx.orden.update({
        where: { id },
        data: { estado_global: EstadoOrdenGlobal.ENTREGADA, fecha_entrega: new Date() },
      });

      // 4. Marcar todas las sedes como ENTREGADA
      await tx.ordenSede.updateMany({
        where: { id_orden: id, estado: { not: 'CANCELADA' } },
        data: { estado: 'ENTREGADA' },
      });

      // 5. Registrar evento
      await tx.ordenEvento.create({
        data: {
          id_orden:    id,
          tipo_evento: 'ORDEN_PAGADA',
          payload:     { total_pagado: totalPagado, metodos: pagos.map(p => p.id_metodo_pago) },
          id_usuario,
        },
      });

      return tx.orden.findUnique({
        where: { id },
        include: {
          sedes: { include: { items: { include: { producto: true } }, restaurante: { select: { id: true, nombre: true } } } },
          pagos_orden: { include: { metodo_pago: true } },
          factura: true,
        },
      });
    }).then(async (ordenFinal) => {
      // 6. Activar saga de descuento de stock (fuera de TX principal)
      await eventBus.emit(EVENTS.ORDEN_ENTREGADA, {
        idOrden:     id,
        numeroOrden: orden.numero_orden,
        idGrupo:     orden.id_grupo,
        sedes:       (ordenFinal?.sedes ?? []).map((s: any) => ({
          idSede:        s.id,
          idRestaurante: s.id_restaurante,
          items:         s.items.map((i: any) => ({
            idProducto:  i.id_producto,
            idVariante:  i.id_variante,
            cantidad:    Number(i.cantidad),
          })),
        })),
      });
      return ordenFinal;
    });
  },

  // ── CANCELAR — nueva arquitectura ─────────────────────────────────────────
  async cancelar(id: number, ctx: TenantCtx, motivo?: string, id_usuario?: number) {
    const orden = await ordenRepository.findByIdScoped(id, ctx);

    if (orden.estado_global === EstadoOrdenGlobal.ENTREGADA) {
      throw new BadRequestError('No se puede cancelar una orden ya entregada');
    }

    if (!orden.sedes || orden.sedes.length === 0) {
      // Fallback legado
      return this.eliminarLegado(id);
    }

    return prisma.$transaction(async (tx) => {
      // Cancelar todas las sedes activas y revertir stock de productos sin receta
      const sedes = await tx.ordenSede.findMany({
        where: { id_orden: id, estado: { not: 'CANCELADA' } },
        include: { items: true },
      });

      for (const sede of sedes) {
        for (const item of sede.items) {
          const receta = await tx.receta.findFirst({
            where: { id_producto_final: item.id_producto, id_restaurante: sede.id_restaurante, estado: 'activo' },
            select: { id: true },
          });
          if (receta) continue; // los ingredientes de receta nunca se descontaron

          // Devolver stock al ProductoStock del restaurante
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

        await tx.ordenSede.update({
          where: { id: sede.id },
          data: { estado: 'CANCELADA', fecha_cancelacion: new Date(), motivo_cancelacion: motivo },
        });
      }

      // Cancelar la Orden global
      await tx.orden.update({
        where: { id },
        data: { estado_global: EstadoOrdenGlobal.CANCELADA, fecha_cancelacion: new Date(), motivo_cancelacion: motivo },
      });

      await tx.ordenEvento.create({
        data: {
          id_orden:    id,
          tipo_evento: 'ORDEN_CANCELADA',
          payload:     { motivo },
          id_usuario,
        },
      });

      eventBus.emit(EVENTS.ORDEN_CANCELADA, { idOrden: id, idRestaurante: orden.id_restaurante });
    });
  },

  // ── ACTUALIZAR datos generales ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async actualizar(id: number, data: any, ctx: TenantCtx) {
    await ordenRepository.findByIdScoped(id, ctx);
    const updateData: any = { ...data };
    if (data.costo_domicilio != null) updateData.costo_domicilio = toDecimal(data.costo_domicilio);
    if (data.descuento       != null) updateData.descuento       = toDecimal(data.descuento);
    if (data.propina         != null) updateData.propina         = toDecimal(data.propina);
    return ordenRepository.update(id, updateData);
  },

  // ── ESTADÍSTICAS ───────────────────────────────────────────────────────────
  async estadisticas(params: { fecha_desde?: Date; fecha_hasta?: Date; id_grupo?: number }) {
    const where: any = {};
    if (params.id_grupo) where.id_grupo = params.id_grupo;
    if (params.fecha_desde || params.fecha_hasta) {
      where.fecha_apertura = {};
      if (params.fecha_desde) where.fecha_apertura.gte = params.fecha_desde;
      if (params.fecha_hasta) where.fecha_apertura.lte = params.fecha_hasta;
    }
    const [total, porEstado, porTipo, agg] = await Promise.all([
      ordenRepository.count(where),
      ordenRepository.groupByEstado(where),
      ordenRepository.groupByTipo(where),
      ordenRepository.aggregate(where),
    ]);
    return {
      total, porEstado, porTipo,
      ventasTotales: Number(agg._sum.total ?? 0),
      promedioVenta: Number(agg._avg.total ?? 0),
    };
  },

  // ============================================================================
  // COMPATIBILIDAD LEGADO — órdenes sin sedes (creadas antes de la migración)
  // ============================================================================

  async actualizarEstadoLegado(
    id: number,
    pagos?: Array<{ id_metodo_pago: number; monto: number; referencia?: string; notas?: string }>
  ) {
    // Redirige al flujo legado completo de pago
    const orden = await this.obtenerPorId(id);

    if (pagos && pagos.length > 0) {
      const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
      if (totalPagado < Number(orden.total)) {
        throw new BadRequestError(`El total pagado (${totalPagado}) es menor al total (${Number(orden.total)})`);
      }

      return prisma.$transaction(async (tx) => {
        for (const p of pagos) {
          await tx.pago.create({
            data: { id_orden: id, id_metodo_pago: p.id_metodo_pago, monto: toDecimal(p.monto), referencia: p.referencia, notas: p.notas },
          });
        }
        await facturaService.garantizarPagada(id, tx);
        await tx.orden.update({ where: { id }, data: { fecha_entrega: new Date(), estado_global: EstadoOrdenGlobal.ENTREGADA } });
        await recetaService.descontarIngredientesOrden(id, tx);
        return tx.orden.findUnique({ where: { id }, include: { estado: true, detalles: { include: { producto: true } }, pagos: { include: { metodo_pago: true } } } });
      });
    }

    return ordenRepository.findById(id);
  },

  /** Legado: cambio de estado con id_estado (tabla estados_orden) */
  async actualizarEstado(
    id: number,
    id_estado_nuevo: number,
    ctx: TenantCtx,
    pagos?: Array<{ id_metodo_pago: number; monto: number; referencia?: string; notas?: string }>
  ) {
    const orden = await ordenRepository.findByIdScoped(id, ctx);

    await estadoRepository.findTransicion(orden.id_estado, id_estado_nuevo).then(t => {
      if (!t) throw new BadRequestError('Transición no permitida desde el estado actual');
    });

    const estadoNuevo = await estadoRepository.findById(id_estado_nuevo);
    if (!estadoNuevo) throw new NotFoundError('Estado de orden');

    if (estadoNuevo.codigo === 'ENTREGADA') {
      // Si tiene sedes nuevas, redirigir a pagar() (orden ya validada por findByIdScoped)
      if (orden.sedes && orden.sedes.length > 0) {
        return this.pagar(id, pagos ?? [], ctx);
      }
      await recetaService.verificarStockParaOrden(id);
    }

    return prisma.$transaction(async (tx) => {
      if (estadoNuevo.codigo === 'EN_PREPARACION') {
        const facturaExistente = await tx.factura.findUnique({ where: { id_orden: id } });
        if (!facturaExistente) await facturaService.generarDesdeOrden(id, tx);
      }

      if (estadoNuevo.codigo === 'ENTREGADA') {
        if (!pagos || pagos.length === 0) throw new BadRequestError('Se requiere al menos un método de pago');
        const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
        if (totalPagado < Number(orden.total)) throw new BadRequestError(`Total pagado insuficiente`);

        await Promise.all(pagos.map(p => tx.pago.create({
          data: { id_orden: id, id_metodo_pago: p.id_metodo_pago, monto: toDecimal(p.monto), referencia: p.referencia, notas: p.notas },
        })));

        await facturaService.garantizarPagada(id, tx);
        await tx.orden.update({ where: { id }, data: { fecha_entrega: new Date() } });
        await recetaService.descontarIngredientesOrden(id, tx);
      }

      return tx.orden.update({
        where: { id },
        data: { id_estado: id_estado_nuevo },
        include: { estado: true, usuario: { select: { id: true, nombre_completo: true } }, detalles: { include: { producto: true } }, pagos: { include: { metodo_pago: true } } },
      });
    });
  },

  /** Legado: eliminar orden con reversa de stock */
  async eliminarLegado(id: number) {
    const orden = await this.obtenerPorId(id);
    return prisma.$transaction(async (tx) => {
      for (const detalle of (orden as any).detalles ?? []) {
        const tieneReceta = await tx.receta.findFirst({
          where: { id_producto_final: detalle.id_producto, estado: 'activo' },
          select: { id: true },
        });
        if (tieneReceta) continue;
        const prod = await tx.producto.findUnique({ where: { id: detalle.id_producto } });
        if (prod) await tx.producto.update({ where: { id: detalle.id_producto }, data: { stock_actual: toDecimal(Number(prod.stock_actual) + Number(detalle.cantidad)) } });
      }
      await tx.ordenDetalle.deleteMany({ where: { id_orden: id } });
      await tx.orden.delete({ where: { id } });
      eventBus.emit(EVENTS.ORDEN_CANCELADA, { idOrden: id, idRestaurante: orden.id_restaurante });
    });
  },

  /** Legado: agregar detalle a orden sin sedes */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async agregarDetalle(ordenId: number, data: any, ctx: TenantCtx) {
    await ordenRepository.findByIdScoped(ordenId, ctx);
    await recetaService.verificarDisponibilidadParaDetalles([{ id_producto: data.id_producto, cantidad: data.cantidad }]);
    return prisma.$transaction(async (tx) => {
      const prod = await tx.producto.findUnique({ where: { id: data.id_producto } });
      if (!prod) throw new NotFoundError('Producto');
      if (Number(prod.stock_actual) < data.cantidad) throw new BadRequestError('Stock insuficiente');

      const pu  = toDecimal(data.precio_unitario);
      const sub = pu.times(toDecimal(data.cantidad));
      const desc = toDecimal(data.descuento ?? 0);

      const detalle = await tx.ordenDetalle.create({
        data: { id_orden: ordenId, id_producto: data.id_producto, cantidad: toDecimal(data.cantidad), precio_unitario: pu, subtotal: sub, descuento: desc, total: sub.minus(desc), notas: data.notas },
        include: { producto: true },
      });

      const nuevoStock = Number(prod.stock_actual) - data.cantidad;
      await tx.producto.update({ where: { id: data.id_producto }, data: { stock_actual: toDecimal(nuevoStock) } });
      await this._recalcularTotalesLegado(tx, ordenId);
      return detalle;
    });
  },

  async actualizarDetalle(detalleId: number, data: { cantidad?: number; notas?: string }, ctx: TenantCtx) {
    // Validate tenant via parent order
    const detalleRaw = await ordenRepository.findDetalleById(detalleId);
    if (!detalleRaw) throw new NotFoundError('Detalle');
    await ordenRepository.findByIdScoped(detalleRaw.id_orden, ctx);

    if (data.cantidad != null) {
      const detalleActual = await prisma.ordenDetalle.findUnique({ where: { id: detalleId } });
      if (detalleActual) {
        const dif = data.cantidad - Number(detalleActual.cantidad);
        if (dif > 0) await recetaService.verificarDisponibilidadParaDetalles([{ id_producto: detalleActual.id_producto, cantidad: dif }]);
      }
    }
    return prisma.$transaction(async (tx) => {
      const detalle = await tx.ordenDetalle.findUnique({ where: { id: detalleId }, include: { producto: true } });
      if (!detalle) throw new NotFoundError('Detalle');

      const updateData: any = {};
      let dif = 0;
      if (data.cantidad != null && data.cantidad !== Number(detalle.cantidad)) {
        dif = data.cantidad - Number(detalle.cantidad);
        if (dif > 0 && Number(detalle.producto.stock_actual) < dif) throw new BadRequestError('Stock insuficiente');
        updateData.cantidad = toDecimal(data.cantidad);
        updateData.subtotal = detalle.precio_unitario.times(data.cantidad);
        updateData.total    = updateData.subtotal.minus(detalle.descuento);
      }
      if (data.notas != null) updateData.notas = data.notas;

      const actualizado = await tx.ordenDetalle.update({ where: { id: detalleId }, data: updateData, include: { producto: true } });
      if (dif !== 0) {
        await tx.producto.update({ where: { id: detalle.id_producto }, data: { stock_actual: toDecimal(Number(detalle.producto.stock_actual) - dif) } });
        await this._recalcularTotalesLegado(tx, detalle.id_orden);
      }
      return actualizado;
    });
  },

  async eliminarDetalle(detalleId: number, ctx: TenantCtx) {
    // Validate tenant via parent order
    const detalleRaw = await ordenRepository.findDetalleById(detalleId);
    if (!detalleRaw) throw new NotFoundError('Detalle');
    await ordenRepository.findByIdScoped(detalleRaw.id_orden, ctx);

    return prisma.$transaction(async (tx) => {
      const detalle = await tx.ordenDetalle.findUnique({ where: { id: detalleId } });
      if (!detalle) throw new NotFoundError('Detalle');
      const prod = await tx.producto.findUnique({ where: { id: detalle.id_producto } });
      if (prod) await tx.producto.update({ where: { id: detalle.id_producto }, data: { stock_actual: toDecimal(Number(prod.stock_actual) + Number(detalle.cantidad)) } });
      await tx.ordenDetalle.delete({ where: { id: detalleId } });
      await this._recalcularTotalesLegado(tx, detalle.id_orden);
    });
  },

  /** Legado: crea una Orden con OrdenDetalle directos (sin sedes). Usado por CQRS CreateOrdenCommand. */
  async crearLegado(data: {
    tipo_orden?:         string;
    id_estado?:          number;
    id_usuario:          number;
    id_restaurante?:     number;
    id_cliente?:         number;
    direccion_entrega?:  string;
    telefono_contacto?:  string;
    nombre_contacto?:    string;
    notas_entrega?:      string;
    costo_domicilio?:    number;
    plataforma_delivery?: string;
    descuento?:          number;
    propina?:            number;
    observaciones?:      string;
    detalles?: Array<{
      id_producto: number; cantidad: number; precio_unitario: number;
      id_variante?: number; descuento?: number; notas?: string;
    }>;
  }, _usuarioId?: number) {
    const detalles = data.detalles ?? [];
    await recetaService.verificarDisponibilidadParaDetalles(
      detalles.map(d => ({ id_producto: d.id_producto, cantidad: d.cantidad }))
    );

    const impuesto = await resolverImpuestoDeRestaurante(data.id_restaurante);
    const tasaIva  = impuesto?.tarifa ?? null;
    const ultima = await ordenRepository.findUltima();
    const numero_orden = generarNumeroOrden((ultima as any)?.numero_orden);

    return prisma.$transaction(async (tx: any) => {

      let subtotal = new Decimal(0);
      const detallesData: any[] = [];
      for (const d of detalles) {
        const pu   = toDecimal(d.precio_unitario);
        const sub  = pu.times(toDecimal(d.cantidad));
        const desc = toDecimal(d.descuento ?? 0);
        subtotal   = subtotal.plus(sub);
        detallesData.push({ id_producto: d.id_producto, id_variante: d.id_variante, cantidad: toDecimal(d.cantidad), precio_unitario: pu, subtotal: sub, descuento: desc, total: sub.minus(desc), notas: d.notas });
      }

      const { impuestos, total } = calcularTotales(
        subtotal,
        toDecimal(data.descuento ?? 0),
        toDecimal(data.propina ?? 0),
        toDecimal(data.costo_domicilio ?? 0),
        tasaIva,
      );

      const orden = await tx.orden.create({
        data: {
          numero_orden,
          tipo_orden:          (data.tipo_orden as TipoOrden) ?? TipoOrden.local,
          id_estado:           data.id_estado,
          id_usuario:          data.id_usuario,
          id_restaurante:      data.id_restaurante,
          id_cliente:          data.id_cliente,
          estado_global:       EstadoOrdenGlobal.EN_PROCESO,
          subtotal, impuestos, total,
          impuesto_tipo:       impuesto?.tipo,
          descuento:           toDecimal(data.descuento ?? 0),
          propina:             toDecimal(data.propina ?? 0),
          costo_domicilio:     data.costo_domicilio != null ? toDecimal(data.costo_domicilio) : undefined,
          plataforma_delivery: data.plataforma_delivery,
          direccion_entrega:   data.direccion_entrega,
          telefono_contacto:   data.telefono_contacto,
          nombre_contacto:     data.nombre_contacto,
          notas_entrega:       data.notas_entrega,
          observaciones:       data.observaciones,
          detalles:            { create: detallesData },
        },
        include: { estado: true, detalles: { include: { producto: true } } },
      });

      for (const d of detalles) {
        const tieneReceta = await tx.receta.findFirst({ where: { id_producto_final: d.id_producto, estado: 'activo' }, select: { id: true } });
        if (tieneReceta) continue;
        const prod = await tx.producto.findUnique({ where: { id: d.id_producto } });
        if (prod) {
          await tx.producto.update({ where: { id: d.id_producto }, data: { stock_actual: toDecimal(Number(prod.stock_actual) - d.cantidad) } });
          await tx.movimiento.create({ data: { id_producto: d.id_producto, id_restaurante: data.id_restaurante, tipo_movimiento: 'venta', cantidad: toDecimal(d.cantidad), stock_anterior: prod.stock_actual, stock_nuevo: toDecimal(Number(prod.stock_actual) - d.cantidad), referencia: `Orden ${numero_orden}` } });
        }
      }

      eventBus.emit(EVENTS.ORDEN_CREADA, { idOrden: orden.id, idRestaurante: data.id_restaurante });
      return orden;
    });
  },

  /** Alias legado para compatibilidad con tests y CQRS */
  async eliminar(id: number) {
    return this.eliminarLegado(id);
  },

  async _recalcularTotalesLegado(tx: any, ordenId: number) {
    const detalles = await tx.ordenDetalle.findMany({ where: { id_orden: ordenId } });
    const nuevoSubtotal = detalles.reduce((s: Decimal, d: any) => s.plus(d.subtotal), new Decimal(0));
    const orden = await tx.orden.findUnique({ where: { id: ordenId } });
    if (!orden) return;
    const impuesto = await resolverImpuestoDeRestaurante(orden.id_restaurante);
    const { impuestos, total } = calcularTotales(nuevoSubtotal, orden.descuento ?? new Decimal(0), orden.propina ?? new Decimal(0), orden.costo_domicilio ?? new Decimal(0), impuesto?.tarifa ?? null);
    await tx.orden.update({ where: { id: ordenId }, data: { subtotal: nuevoSubtotal, impuestos, total } });
  },
};
