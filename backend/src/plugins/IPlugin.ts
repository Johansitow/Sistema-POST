/**
 * IPlugin — Interfaz base para todos los plugins del sistema POS
 *
 * Un plugin es un módulo autocontenido que puede:
 *   - Registrar rutas Express bajo /api/v1/plugins/:name/
 *   - Registrar Commands y Queries en los buses CQRS
 *   - Suscribirse a eventos del EventBus
 *   - Activarse/desactivarse mediante feature flags
 *   - Exponer páginas de administración al frontend via GET /api/v1/admin/modules
 *
 * Ejemplo de plugin:
 *   export class LoyaltyPlugin implements IPlugin {
 *     name        = 'loyalty';
 *     version     = '1.0.0';
 *     description = 'Sistema de puntos y fidelización de clientes';
 *     featureFlag = 'clientes_fidelizacion';
 *     adminPages  = [{ label: 'Fidelización', path: '/admin/loyalty', icon: 'Loyalty' }];
 *     permissions = ['loyalty.ver', 'loyalty.gestionar'];
 *
 *     async register(ctx: PluginContext): Promise<void> {
 *       ctx.router.get('/puntos/:clienteId', authenticate, handler);
 *       ctx.eventBus.on('OrdenCerrada', acumularPuntos);
 *     }
 *   }
 */

import type { Router } from 'express';
import type { commandBus } from '../application/commands/CommandBus';
import type { queryBus }   from '../application/queries/QueryBus';
import type { eventBus }   from '../events/eventBus';
import type logger         from '../config/logger';

/** Contexto que el PluginLoader inyecta a cada plugin al registrarlo */
export interface PluginContext {
  /** Router Express montado en /api/v1/plugins/:pluginName/ */
  router: Router;
  /** Bus de comandos (write side) */
  commandBus: typeof commandBus;
  /** Bus de queries (read side) */
  queryBus: typeof queryBus;
  /** EventBus para pub/sub de dominio */
  eventBus: typeof eventBus;
  /** Logger con el nombre del plugin como prefijo */
  logger: typeof logger;
}

/**
 * Descriptor de una página de administración expuesta por el plugin.
 * El frontend las usa para construir dinámicamente el sidebar de admin.
 */
export interface AdminPage {
  /** Etiqueta visible en el sidebar */
  label: string;
  /** Ruta frontend (ej: "/admin/usuarios") */
  path: string;
  /** Nombre del ícono MUI (ej: "People", "Category") */
  icon?: string;
  /** Orden en el sidebar (menor = más arriba) */
  order?: number;
  /** Feature flag requerido para mostrar la página (además del del plugin) */
  requiredFlag?: string;
}

/** Interfaz que todo plugin debe implementar */
export interface IPlugin {
  /** Identificador único del plugin (slug: letras, números, guiones) */
  readonly name: string;
  /** Versión semántica: "1.0.0" */
  readonly version: string;
  /** Descripción corta del plugin */
  readonly description: string;
  /**
   * Nombre del feature flag que controla si el plugin está activo.
   * Si no se define, el plugin siempre se carga.
   * Si se define y el flag está deshabilitado, el plugin se omite.
   */
  readonly featureFlag?: string;
  /**
   * Páginas de administración que el plugin expone al frontend.
   * Estas aparecen en GET /api/v1/admin/modules para que el frontend
   * construya dinámicamente el menú de administración.
   */
  readonly adminPages?: AdminPage[];
  /**
   * Permisos que el plugin requiere en el sistema RBAC.
   * Usados por el PluginLoader para documentar y validar permisos.
   */
  readonly permissions?: string[];
  /**
   * Método principal. El PluginLoader lo llama una sola vez al arrancar
   * (después de `registerHandlers`). Aquí el plugin registra sus rutas,
   * handlers de comandos/queries y listeners de eventos.
   */
  register(context: PluginContext): Promise<void> | void;
}
