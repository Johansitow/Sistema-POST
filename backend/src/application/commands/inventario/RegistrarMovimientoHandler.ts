/**
 * RegistrarMovimientoHandler — Handler real para movimientos de inventario
 *
 * A diferencia del handler funcional anterior (que simplemente delega al service),
 * este handler de clase encapsula la lógica propia del comando:
 *   1. Valida que el tipo de movimiento sea válido
 *   2. Ajusta el signo de la cantidad según el tipo (salidas y mermas son negativas)
 *   3. Delega la persistencia al service
 *   4. Emite el evento de dominio correspondiente
 */

import type { ICommandHandler }          from '../ICommandHandler';
import type { RegistrarMovimientoCommand } from './RegistrarMovimientoCommand';
import { inventarioService }             from '../../../services/inventario.service';
import { eventBus } from '../../../events/eventBus';
import { EVENTS }   from '../../../events/events';
import logger                            from '../../../config/logger';

/** Tipos de movimiento que representan salidas (la cantidad pasa a negativa) */
const TIPOS_SALIDA = new Set(['salida', 'merma', 'vencimiento']);

/** Tipos de movimiento válidos */
const TIPOS_VALIDOS = new Set([
  'entrada', 'salida', 'ajuste', 'produccion', 'merma', 'vencimiento',
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

    // 2. Normalizar cantidad (salidas siempre negativas en DB)
    const cantidadFinal = TIPOS_SALIDA.has(data.tipo_movimiento)
      ? -Math.abs(data.cantidad)
      : Math.abs(data.cantidad);

    const dataFinal = { ...data, cantidad: cantidadFinal, id_usuario: usuarioId };

    // 3. Persistir
    const movimiento = await inventarioService.registrarMovimiento(dataFinal as any);

    // 4. Emitir evento de dominio para que otros módulos puedan reaccionar
    const result = movimiento as { movimiento: { id: number }; lote_generado: unknown };
    eventBus.emit(EVENTS.MOVIMIENTO_REGISTRADO, {
      idMovimiento:   result.movimiento.id,
      idProducto:     data.id_producto,
      idRestaurante:  data.id_restaurante,
      tipoMovimiento: data.tipo_movimiento,
      cantidad:       cantidadFinal,
    });

    logger.debug(
      `[RegistrarMovimientoHandler] Producto ${data.id_producto} — ` +
      `${data.tipo_movimiento} ${cantidadFinal}`
    );

    return movimiento;
  }
}

/** Instancia singleton para registrar en el CommandBus */
export const registrarMovimientoHandler = new RegistrarMovimientoHandler();
