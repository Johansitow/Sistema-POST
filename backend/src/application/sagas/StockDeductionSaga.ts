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
import { recetaService } from '../../services/receta.service';

export function registerStockDeductionSaga() {
  eventBus.on<OrdenEntregadaPayload>(EVENTS.ORDEN_ENTREGADA, async (payload) => {
    for (const sedePayload of payload.sedes) {
      try {
        // Un TX dedicado por sede para aislamiento — reusa la misma lógica de
        // descuento que el flujo legado (fórmula, unidades, opcionales, auditoría).
        await prisma.$transaction(async (tx) => {
          await recetaService.descontarIngredientesSede({
            id_orden:       payload.idOrden,
            numero_orden:   payload.numeroOrden,
            id_restaurante: sedePayload.idRestaurante,
            items: sedePayload.items.map((i) => ({
              id_producto: i.idProducto,
              cantidad:    i.cantidad,
            })),
          }, tx);
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
