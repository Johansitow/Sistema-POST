/**
 * LoyaltyPlugin — Plugin de ejemplo: puntos de fidelización
 *
 * Este archivo sirve como referencia para crear nuevos plugins.
 * Actívalo agregando en server.ts:
 *   pluginLoader.add(new LoyaltyPlugin());
 *
 * Requiere el feature flag 'clientes_fidelizacion' habilitado.
 */

import type { IPlugin, PluginContext } from '../IPlugin';

export class LoyaltyPlugin implements IPlugin {
  readonly name        = 'loyalty';
  readonly version     = '1.0.0';
  readonly description = 'Sistema de puntos y fidelización de clientes';
  readonly featureFlag = 'clientes_fidelizacion';

  register(ctx: PluginContext): void {
    ctx.logger.info('[LoyaltyPlugin] Registrando rutas...');

    // GET /api/v1/plugins/loyalty/status
    ctx.router.get('/status', (_req, res) => {
      res.json({ success: true, data: { plugin: this.name, version: this.version } });
    });

    // Ejemplo: suscribirse a eventos de dominio
    // ctx.eventBus.on('OrdenCerrada', async (payload) => {
    //   await acumularPuntos(payload.clienteId, payload.total);
    // });

    ctx.logger.info('[LoyaltyPlugin] Plugin listo');
  }
}
