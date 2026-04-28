/**
 * RegistrarMovimientoCommand — Comando para registrar un movimiento de inventario
 * (entrada, salida, ajuste, produccion, merma, vencimiento)
 */

import type { ICommand } from '../CommandBus';

export interface MovimientoData {
  id_producto:        number;
  tipo_movimiento:    string;
  cantidad:           number;
  motivo?:            string;
  id_usuario?:        number;
  id_restaurante?:    number;
  fecha_vencimiento?: Date;
  costo_unitario?:    number;
  numero_lote?:       string;
}

export class RegistrarMovimientoCommand implements ICommand {
  readonly commandName = 'RegistrarMovimientoCommand';

  constructor(
    public readonly data:      MovimientoData,
    public readonly usuarioId: number,
  ) {}
}
