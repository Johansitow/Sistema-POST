/**
 * RegistrarMovimientoHandler — Handler real para movimientos de inventario
 *
 * Este handler de clase encapsula la lógica propia del comando:
 *   1. Valida que el tipo de movimiento sea válido
 *   2. Delega la persistencia al service
 *   3. Emite el evento de dominio correspondiente
 *
 * IMPORTANTE: `cantidad` siempre viaja positiva (así lo exige el DTO y así la
 * usan el service, los reportes de tendencias de consumo y la rentabilidad
 * por lote). El signo del movimiento (suma o resta de stock) lo decide
 * `inventarioService.registrarMovimiento()` según `tipo_movimiento` — no aquí.
 */

import type { ICommandHandler }          from '../ICommandHandler';
import type { RegistrarMovimientoCommand } from './RegistrarMovimientoCommand';
import { inventarioService }             from '../../../services/inventario.service';
import { eventBus } from '../../../events/eventBus';
import { EVENTS }   from '../../../events/events';
import logger                            from '../../../config/logger';

/** Tipos de movimiento válidos */
const TIPOS_VALIDOS = new Set([
  'entrada', 'salida', 'ajuste', 'produccion', 'merma', 'vencimiento', 'devolucion', 'venta',
]);

export class RegistrarMovimientoHandler
  implements ICommandHandler<RegistrarMovimientoCommand, unknown>
{
  async execute(command: RegistrarMovimientoCommand): Promise<unknown> {
    const { data, usuarioId } = command;

    // 1. Validar tipo
    if (!TIPOS_VALIDOS.has(data.tipo_movimiento)) {
      throw new Error(
        `Tipo de movimiento inválido: "${data.tipo_movimiento}". ` +
        `Valores aceptados: ${[...TIPOS_VALIDOS].join(', ')}`
      );
    }

    const dataFinal = { ...data, id_usuario: usuarioId };

    // 2. Persistir
    const movimiento = await inventarioService.registrarMovimiento(dataFinal as any);

    // 3. Emitir evento de dominio para que otros módulos puedan reaccionar
    const result = movimiento as { movimiento: { id: number }; lote_generado: unknown };
    eventBus.emit(EVENTS.MOVIMIENTO_REGISTRADO, {
      idMovimiento:   result.movimiento.id,
      idProducto:     data.id_producto,
      idRestaurante:  data.id_restaurante,
      tipoMovimiento: data.tipo_movimiento,
      cantidad:       data.cantidad,
    });

    logger.debug(
      `[RegistrarMovimientoHandler] Producto ${data.id_producto} — ` +
      `${data.tipo_movimiento} ${data.cantidad}`
    );

    return movimiento;
  }
}

/** Instancia singleton para registrar en el CommandBus */
export const registrarMovimientoHandler = new RegistrarMovimientoHandler();
