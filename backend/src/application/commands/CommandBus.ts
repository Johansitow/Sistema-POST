/**
 * CommandBus — Bus de comandos (CQRS write side)
 *
 * Permite desacoplar el emisor de un comando de su handler.
 * Los controllers despachan un Command; el bus lo enruta al handler registrado.
 *
 * Usos:
 *   // Agregar middleware (logging, auditoría, etc.)
 *   commandBus.use(async (command, next) => {
 *     const t = Date.now();
 *     const result = await next();
 *     logger.info(`[CMD] ${command.commandName} completado en ${Date.now() - t}ms`);
 *     return result;
 *   });
 *
 *   // Registrar handler
 *   commandBus.register(CreateOrdenCommand, createOrdenHandler);
 *
 *   // Despachar desde un controller
 *   const orden = await commandBus.dispatch(new CreateOrdenCommand(data, usuarioId));
 */

// ── Base ──────────────────────────────────────────────────────────────────────

/** Interfaz base para todos los comandos del sistema */
export interface ICommand {
  readonly commandName: string;
}

/** Handler que procesa un comando y retorna un resultado */
export type CommandHandler<C extends ICommand, R = void> = (command: C) => Promise<R>;

/** Constructor de un comando — usado como clave de registro */
export type CommandConstructor<C extends ICommand = ICommand> = new (...args: any[]) => C;

/**
 * Middleware del bus. Recibe el comando y una función `next` que ejecuta
 * el siguiente middleware (o el handler final).
 */
export type CommandMiddleware = (
  command: ICommand,
  next: () => Promise<unknown>,
) => Promise<unknown>;

// ── Bus ───────────────────────────────────────────────────────────────────────

class CommandBus {
  private readonly handlers    = new Map<string, CommandHandler<any, any>>();
  private readonly middlewares: CommandMiddleware[] = [];

  /**
   * Agrega un middleware al pipeline.
   * Los middlewares se ejecutan en orden de registro, antes del handler.
   */
  use(middleware: CommandMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Registra un handler para un tipo de comando.
   * Si ya existe un handler para ese comando, lo sobreescribe.
   */
  register<C extends ICommand, R>(
    CommandClass: CommandConstructor<C>,
    handler:      CommandHandler<C, R>,
  ): void {
    const key = CommandClass.name;
    if (this.handlers.has(key)) {
      console.warn(`[CommandBus] Sobreescribiendo handler para: ${key}`);
    }
    this.handlers.set(key, handler);
  }

  /**
   * Despacha un comando al handler registrado, pasando por el pipeline
   * de middlewares en orden.
   * Lanza si no hay handler registrado para ese comando.
   */
  async dispatch<C extends ICommand, R>(command: C): Promise<R> {
    const key     = command.commandName;
    const handler = this.handlers.get(key);

    if (!handler) {
      throw new Error(`[CommandBus] No hay handler registrado para: "${key}"`);
    }

    // Componer pipeline: middlewares[] → handler
    const pipeline = this.middlewares.reduceRight<() => Promise<unknown>>(
      (next, mw) => () => mw(command, next),
      () => handler(command),
    );

    return pipeline() as Promise<R>;
  }

  /** Lista los comandos registrados (útil para debugging) */
  registeredCommands(): string[] {
    return [...this.handlers.keys()];
  }
}

export const commandBus = new CommandBus();
