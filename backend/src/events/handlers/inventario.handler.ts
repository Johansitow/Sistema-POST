/**
 * inventario.handler.ts
 * Reacciona a eventos de órdenes para:
 *   1. Descontar stock por receta al completar una orden.
 *   2. Emitir STOCK_BAJO si algún producto queda bajo el mínimo.
 */

import prisma from '../../config/database';
import { eventBus } from '../eventBus';
import {
  EVENTS,
  OrdenCompletadaPayload,
  StockBajoPayload,
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
}
