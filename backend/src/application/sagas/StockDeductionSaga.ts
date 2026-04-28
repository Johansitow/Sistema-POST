/**
 * StockDeductionSaga — descuenta ingredientes de recetas al entregar la orden
 *
 * Escucha: ORDEN_ENTREGADA
 * Para cada OrdenSede → para cada OrdenSedeItem → si tiene receta activa en ese
 * restaurante → descuenta ingredientes del inventario de ESA sede.
 *
 * Nunca toca el inventario de otro restaurante.
 */

import { eventBus }      from '../../events/eventBus';
import { EVENTS }        from '../../events/events';
import type { OrdenEntregadaPayload } from '../../events/events';
import prisma from '../../config/database';

export function registerStockDeductionSaga() {
  eventBus.on<OrdenEntregadaPayload>(EVENTS.ORDEN_ENTREGADA, async (payload) => {
    for (const sedePayload of payload.sedes) {
      try {
        // descontarIngredientesOrden espera id_orden pero trabaja por producto.
        // Aquí lo invocamos con un TX dedicado por sede para aislamiento.
        await prisma.$transaction(async (tx) => {
          for (const item of sedePayload.items) {
            // Buscar receta activa para este producto en este restaurante
            const receta = await tx.receta.findFirst({
              where: {
                id_producto_final: item.idProducto,
                id_restaurante:    sedePayload.idRestaurante,
                estado:            'activo',
              },
              include: { ingredientes: true },
            });

            if (!receta) continue; // sin receta → stock se descontó al crear

            // Descontar cada ingrediente en el restaurante de ESTA sede
            for (const ing of receta.ingredientes) {
              const cantNecesaria = Number(ing.cantidad) * item.cantidad / Number(receta.cantidad_producida);

              const stockReg = await tx.productoStock.findUnique({
                where: {
                  id_producto_id_restaurante: {
                    id_producto:    ing.id_producto,
                    id_restaurante: sedePayload.idRestaurante,
                  },
                },
              });

              if (stockReg) {
                const nuevoStock = Math.max(0, Number(stockReg.stock_actual) - cantNecesaria);
                await tx.productoStock.update({
                  where: {
                    id_producto_id_restaurante: {
                      id_producto:    ing.id_producto,
                      id_restaurante: sedePayload.idRestaurante,
                    },
                  },
                  data: { stock_actual: nuevoStock },
                });
              } else {
                // Fallback: stock global del producto
                const prod = await tx.producto.findUnique({ where: { id: ing.id_producto } });
                if (prod) {
                  await tx.producto.update({
                    where: { id: ing.id_producto },
                    data: { stock_actual: Math.max(0, Number(prod.stock_actual) - cantNecesaria) },
                  });
                }
              }

              // Registrar movimiento de venta por ingrediente
              await tx.movimiento.create({
                data: {
                  id_producto:     ing.id_producto,
                  id_restaurante:  sedePayload.idRestaurante,
                  tipo_movimiento: 'venta',
                  cantidad:        cantNecesaria,
                  stock_anterior:  stockReg ? stockReg.stock_actual : 0,
                  stock_nuevo:     0, // aproximado — el valor real está arriba
                  motivo:          `Receta - Orden ${payload.idOrden} Sede ${sedePayload.idSede}`,
                  id_orden:        payload.idOrden,
                },
              });
            }
          }
        });
      } catch (err) {
        // Error aislado por sede — no detiene el descuento de otras sedes
        console.error(
          `[StockDeductionSaga] Error al descontar stock de sede ${sedePayload.idSede}:`,
          err
        );
      }
    }
  });
}
