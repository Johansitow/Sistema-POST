/**
 * ICommandHandler — Interfaz tipada para handlers de comandos
 *
 * Permite escribir handlers como clases en lugar de funciones sueltas.
 * Las clases son más fáciles de inyectar dependencias, testear y documentar.
 *
 * Uso:
 *   export class CreateOrdenHandler implements ICommandHandler<CreateOrdenCommand, Orden> {
 *     constructor(private readonly ordenService: OrdenService) {}
 *
 *     async execute(command: CreateOrdenCommand): Promise<Orden> {
 *       return this.ordenService.crear(command.data, command.usuarioId);
 *     }
 *   }
 *
 *   // Registrar:
 *   commandBus.register(CreateOrdenCommand, new CreateOrdenHandler(ordenService).execute.bind(...));
 */

import type { ICommand } from './CommandBus';

export interface ICommandHandler<C extends ICommand, R = void> {
  execute(command: C): Promise<R>;
}
