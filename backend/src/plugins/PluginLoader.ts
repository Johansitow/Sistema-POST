/**
 * PluginLoader — Registra y activa plugins del sistema
 *
 * Flujo al arrancar:
 *   1. `pluginLoader.add(new MiPlugin())` — registrar plugins
 *   2. `await pluginLoader.loadAll(app)` — activar todos (respetando feature flags)
 *
 * El loader monta automáticamente un Router bajo /api/v1/plugins/:pluginName/
 * para cada plugin, de modo que los plugins no necesitan conocer el prefijo base.
 *
 * Feature flag gating:
 *   Si el plugin define `featureFlag`, el loader consulta la DB antes de activarlo.
 *   Si el flag está deshabilitado, el plugin se omite sin error.
 *
 * Admin modules:
 *   `getAdminModules()` devuelve las adminPages de todos los plugins activos.
 *   Usado por GET /api/v1/admin/modules para construir el sidebar dinámico.
 */

import { Router, type Express } from 'express';
import { commandBus }  from '../application/commands/CommandBus';
import { queryBus }    from '../application/queries/QueryBus';
import { eventBus }    from '../events/eventBus';
import logger          from '../config/logger';
import type { IPlugin, PluginContext, AdminPage } from './IPlugin';

// Importación lazy para no crear dependencia circular con el resto del sistema
let featureFlagService: { isEnabled: (nombre: string) => Promise<boolean> } | null = null;

async function getFeatureFlagService() {
  if (!featureFlagService) {
    const mod = await import('../services/feature-flag.service');
    featureFlagService = mod.featureFlagService;
  }
  return featureFlagService;
}

/** Información de un plugin activo en runtime */
interface ActivePlugin {
  plugin: IPlugin;
  loadedAt: Date;
}

class PluginLoader {
  private readonly plugins:       Map<string, IPlugin>      = new Map();
  private readonly activePlugins: Map<string, ActivePlugin> = new Map();
  private loaded = false;

  /** Registra un plugin. No lo activa hasta llamar a `loadAll`. */
  add(plugin: IPlugin): this {
    if (this.plugins.has(plugin.name)) {
      logger.warn(`[PluginLoader] Plugin "${plugin.name}" ya registrado — se sobreescribe`);
    }
    this.plugins.set(plugin.name, plugin);
    return this;
  }

  /**
   * Activa todos los plugins registrados.
   * Debe llamarse una sola vez desde server.ts, después de registerHandlers().
   * Omite plugins cuyo featureFlag esté deshabilitado.
   */
  async loadAll(app: Express): Promise<void> {
    if (this.loaded) {
      logger.warn('[PluginLoader] loadAll() llamado más de una vez — ignorado');
      return;
    }
    this.loaded = true;

    if (this.plugins.size === 0) {
      logger.info('[PluginLoader] Sin plugins registrados');
      return;
    }

    const ffService = await getFeatureFlagService().catch(() => null);

    for (const plugin of this.plugins.values()) {
      // Verificar feature flag si aplica
      if (plugin.featureFlag && ffService) {
        const enabled = await ffService.isEnabled(plugin.featureFlag).catch(() => false);
        if (!enabled) {
          logger.info(`[PluginLoader] Plugin "${plugin.name}" omitido — flag "${plugin.featureFlag}" deshabilitado`);
          continue;
        }
      }

      try {
        // Crear router aislado para el plugin
        const router = Router();

        const context: PluginContext = {
          router,
          commandBus,
          queryBus,
          eventBus,
          logger,
        };

        await plugin.register(context);

        // Montar el router del plugin bajo /api/v1/plugins/:pluginName/
        app.use(`/api/v1/plugins/${plugin.name}`, router);
        app.use(`/api/plugins/${plugin.name}`, router);   // alias sin versión

        // Registrar como activo
        this.activePlugins.set(plugin.name, { plugin, loadedAt: new Date() });

        logger.info(
          `[PluginLoader] ✅ Plugin "${plugin.name}" v${plugin.version} cargado` +
          (plugin.adminPages?.length ? ` (${plugin.adminPages.length} páginas admin)` : '')
        );
      } catch (err) {
        // Un plugin que falla no debe derribar el sistema
        logger.error(`[PluginLoader] Error cargando plugin "${plugin.name}":`, err);
      }
    }

    logger.info(`[PluginLoader] ${this.activePlugins.size} / ${this.plugins.size} plugins activos`);
  }

  /**
   * Devuelve las páginas de administración de todos los plugins activos.
   * Usado por GET /api/v1/admin/modules para alimentar el sidebar dinámico del frontend.
   */
  getAdminModules(): AdminPage[] {
    const pages: AdminPage[] = [];
    for (const { plugin } of this.activePlugins.values()) {
      if (plugin.adminPages?.length) {
        pages.push(...plugin.adminPages);
      }
    }
    // Ordenar por `order` ascendente (sin order → al final)
    return pages.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }

  /**
   * Devuelve todos los permisos requeridos por los plugins activos.
   * Útil para documentación, seed de permisos, o validaciones RBAC.
   */
  getRequiredPermissions(): string[] {
    const perms = new Set<string>();
    for (const { plugin } of this.activePlugins.values()) {
      plugin.permissions?.forEach(p => perms.add(p));
    }
    return [...perms].sort();
  }

  /** Devuelve un plugin por nombre (útil para testing o inspección en runtime) */
  get(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  /** Lista los nombres de plugins registrados */
  list(): string[] {
    return [...this.plugins.keys()];
  }

  /** Lista los nombres de plugins activos (cargados exitosamente) */
  listActive(): string[] {
    return [...this.activePlugins.keys()];
  }
}

/** Singleton — importar desde cualquier parte del sistema */
export const pluginLoader = new PluginLoader();
