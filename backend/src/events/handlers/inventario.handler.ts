/**
 * inventario.handler.ts
 * Reacciona a eventos de órdenes e inventario para:
 *   1. Descontar stock por receta al completar una orden.
 *   2. Emitir STOCK_BAJO si algún producto queda bajo el mínimo.
 *   3. Alertar cuando una merma de un producto almacenable queda sin lote asociado
 *      (faltante de conteo que no se pudo justificar) — para poder sumarlas después
 *      como pérdida de capital no identificada.
 */

import prisma from '../../config/database';
import { eventBus } from '../eventBus';
import {
  EVENTS,
  OrdenCompletadaPayload,
  StockBajoPayload,
  MovimientoRegistradoPayload,
} from '../events';

export function registerInventarioHandlers(): void {

  eventBus.on<OrdenCompletadaPayload>(
    EVENTS.ORDEN_COMPLETADA,
    async (payload) => {
      const { idOrden, idRestaurante, detalles } = payload;

      // Por cada producto en la orden, buscar su receta activa para este restaurante
      // y descontar los ingredientes del stock de la sede.
      for (const detalle of detalles) {
        const receta = await prisma.receta.findFirst({
          where: {
            id_producto_final: detalle.idProducto,
            id_restaurante:    idRestaurante,
            estado:            'activo',
          },
          include: { ingredientes: true },
        });

        if (!receta) continue; // sin receta = sin descuento de inventario

        const factor = Number(detalle.cantidad) / Number(receta.cantidad_producida);

        for (const ingrediente of receta.ingredientes) {
          const consumo = Number(ingrediente.cantidad) * factor;

          // Obtener stock actual del ingrediente en este restaurante
          const stockRecord = await prisma.productoStock.findUnique({
            where: {
              id_producto_id_restaurante: {
                id_producto:    ingrediente.id_producto,
                id_restaurante: idRestaurante,
              },
            },
          });

          if (!stockRecord) continue;

          const stockAnterior = Number(stockRecord.stock_actual);
          const stockNuevo    = Math.max(0, stockAnterior - consumo);

          await prisma.$transaction([
            // Actualizar stock
            prisma.productoStock.update({
              where: {
                id_producto_id_restaurante: {
                  id_producto:    ingrediente.id_producto,
                  id_restaurante: idRestaurante,
                },
              },
              data: { stock_actual: stockNuevo },
            }),
            // Registrar movimiento de salida
            prisma.movimiento.create({
              data: {
                id_producto:     ingrediente.id_producto,
                id_restaurante:  idRestaurante,
                tipo_movimiento: 'venta',
                cantidad:        consumo,
                stock_anterior:  stockAnterior,
                stock_nuevo:     stockNuevo,
                motivo:          `Venta — orden ${idOrden}`,
                id_orden:        idOrden,
              },
            }),
          ]);

          // Verificar si quedó bajo el mínimo
          const minimo = Number(stockRecord.stock_minimo);
          if (stockNuevo <= minimo) {
            const producto = await prisma.producto.findUnique({
              where: { id: ingrediente.id_producto },
              select: { nombre: true },
            });

            const alertPayload: StockBajoPayload = {
              idProducto:     ingrediente.id_producto,
              idRestaurante:  idRestaurante,
              nombreProducto: producto?.nombre ?? `Producto ${ingrediente.id_producto}`,
              stockActual:    stockNuevo,
              stockMinimo:    minimo,
            };

            // Emitir evento de stock bajo (será capturado por socketHandler)
            await eventBus.emit(EVENTS.STOCK_BAJO, alertPayload);

            // Persistir alerta en DB
            await prisma.alerta.create({
              data: {
                id_tipo_alerta:  1, // STOCK_BAJO — debe existir en seed
                id_producto:     ingrediente.id_producto,
                id_restaurante:  idRestaurante,
                mensaje: `Stock bajo: ${alertPayload.nombreProducto} — ` +
                         `actual: ${stockNuevo.toFixed(3)}, mínimo: ${minimo}`,
                nivel_prioridad: stockNuevo === 0 ? 'alta' : 'media',
              },
            });
          }
        }
      }
    }
  );

  // ── MOVIMIENTO_REGISTRADO: merma de un producto almacenable sin lote asociado ──
  // Ocurre cuando un faltante de conteo (Inventario → Ajuste) no se pudo atribuir a
  // ningún lote. Se deja registrada como pérdida (ya ocurrió al crear el movimiento)
  // y además se alerta para poder revisarla y sumarla como pérdida de capital.
  eventBus.on<MovimientoRegistradoPayload>(
    EVENTS.MOVIMIENTO_REGISTRADO,
    async ({ idMovimiento, tipoMovimiento, idRestaurante }) => {
      if (tipoMovimiento !== 'merma' || !idRestaurante) return;

      const movimiento = await prisma.movimiento.findUnique({
        where: { id: idMovimiento },
        include: { producto: { select: { nombre: true, es_vendible: true } } },
      });
      if (!movimiento || movimiento.id_lote) return;       // ya quedó vinculada a un lote
      if (movimiento.producto.es_vendible) return;         // productos vendibles no usan lotes

      const tipoAlerta = await prisma.tipoAlerta.findUnique({ where: { codigo: 'PERDIDA_SIN_LOTE' } });
      if (!tipoAlerta) return; // seed no aplicado aún — no bloquear el movimiento por esto

      await prisma.alerta.create({
        data: {
          id_tipo_alerta:  tipoAlerta.id,
          id_producto:     movimiento.id_producto,
          id_restaurante:  idRestaurante,
          mensaje: `Pérdida sin justificar: "${movimiento.producto.nombre}" — ` +
                   `${Number(movimiento.cantidad).toFixed(3)} sin lote identificado. ${movimiento.motivo}`,
          nivel_prioridad: tipoAlerta.prioridad_default,
        },
      });
    },
  );
}
