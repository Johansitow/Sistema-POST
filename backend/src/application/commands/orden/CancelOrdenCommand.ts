/**
 * CancelOrdenCommand — Comando para cancelar una orden existente
 */

import type { ICommand } from '../CommandBus';

export class CancelOrdenCommand implements ICommand {
  readonly commandName = 'CancelOrdenCommand';

  constructor(
    public readonly ordenId:   number,
    public readonly usuarioId: number,
    public readonly motivo?:   string,
  ) {}
}
