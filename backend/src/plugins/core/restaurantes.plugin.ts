/**
 * RestaurantesPlugin — Plugin core para gestión de restaurantes (multi-tenant)
 *
 * Siempre activo, pero gateado por el feature flag `multi_restaurante`.
 * Si el flag está deshabilitado, el plugin (y su página admin) no aparece.
 */

import type { IPlugin, PluginContext } from '../IPlugin';

export class RestaurantesPlugin implements IPlugin {
  readonly name        = 'restaurantes';
  readonly version     = '1.0.0';
  readonly description = 'Gestión de restaurantes y asignación de usuarios (multi-tenant)';
  readonly featureFlag = 'multi_restaurante';

  readonly adminPages = [
    {
      label: 'Restaurantes',
      path:  '/admin/restaurantes',
      icon:  'Restaurant',
      order: 20,
    },
  ];

  readonly permissions = [
    'restaurantes.ver',
    'restaurantes.crear',
    'restaurantes.editar',
    'restaurantes.eliminar',
    'restaurantes.asignar_usuarios',
  ];

  register(_context: PluginContext): void {
    // Las rutas de restaurantes están en /api/v1/restaurantes
  }
}

export const restaurantesPlugin = new RestaurantesPlugin();
