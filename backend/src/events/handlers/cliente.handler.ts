/**
 * cliente.handler.ts
 * Reacciona a ORDEN_COMPLETADA para acumular puntos de fidelización
 * y actualizar estadísticas del cliente (total_gastado, total_ordenes, ultima_visita).
 *
 * Regla de puntos por defecto: 1 punto por cada 1000 unidades monetarias.
 * Configurable por restaurante vía ConfiguracionRestaurante clave='puntos_por_unidad'.
 */

import prisma from '../../config/database';
import { eventBus } from '../eventBus';
import { EVENTS, OrdenCompletadaPayload } from '../events';

const PUNTOS_POR_UNIDAD_DEFAULT = 1000; // 1 punto cada $1.000 COP

export function registerClienteHandlers(): void {

  eventBus.on<OrdenCompletadaPayload>(
    EVENTS.ORDEN_COMPLETADA,
    async (payload) => {
      const { idCliente, idRestaurante, total, idOrden } = payload;
      if (!idCliente) return; // orden sin cliente identificado → sin puntos

      // Leer configuración de puntos de este restaurante
      const config = await prisma.configuracionRestaurante.findUnique({
        where: {
          id_restaurante_clave: {
            id_restaurante: idRestaurante,
            clave:          'puntos_por_unidad',
          },
        },
      });
      const puntosXUnidad = config ? Number(config.valor) : PUNTOS_POR_UNIDAD_DEFAULT;
      const puntosGanados = Math.floor(total / puntosXUnidad);

      if (puntosGanados <= 0) {
        // Aun sin puntos, actualizar estadísticas
        await prisma.cliente.update({
          where: { id: idCliente },
          data: {
            total_gastado:  { increment: total },
            total_ordenes:  { increment: 1 },
            ultima_visita:  new Date(),
          },
        });
        return;
      }

      // Obtener saldo actual para el historial
      const cliente = await prisma.cliente.findUnique({
        where:  { id: idCliente },
        select: { puntos_acumulados: true },
      });
      if (!cliente) return;

      const saldoAntes   = cliente.puntos_acumulados;
      const saldoDespues = saldoAntes + puntosGanados;

      await prisma.$transaction([
        // Actualizar totales y puntos del cliente
        prisma.cliente.update({
          where: { id: idCliente },
          data: {
            puntos_acumulados: saldoDespues,
            total_gastado:     { increment: total },
            total_ordenes:     { increment: 1 },
            ultima_visita:     new Date(),
          },
        }),
        // Registrar transacción de puntos
        prisma.clientePunto.create({
          data: {
            id_cliente:    idCliente,
            id_orden:      idOrden,
            tipo:          'ganado',
            puntos:        puntosGanados,
            descripcion:   `Compra — ${puntosGanados} puntos ganados`,
            saldo_antes:   saldoAntes,
            saldo_despues: saldoDespues,
          },
        }),
      ]);
    }
  );
}
