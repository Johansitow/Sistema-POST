/**
 * CategoriasPlugin — Plugin core para gestión de categorías de productos
 */

import type { IPlugin, PluginContext } from '../IPlugin';

export class CategoriasPlugin implements IPlugin {
  readonly name        = 'categorias';
  readonly version     = '1.0.0';
  readonly description = 'Gestión de categorías de productos con íconos y colores';

  readonly adminPages = [
    {
      label: 'Categorías',
      path:  '/admin/categorias',
      icon:  'Category',
      order: 30,
    },
  ];

  readonly permissions = [
    'categorias.ver',
    'categorias.crear',
    'categorias.editar',
    'categorias.eliminar',
    'categorias.reordenar',
  ];

  register(_context: PluginContext): void {
    // Las rutas de categorías están en /api/v1/categorias
  }
}

export const categoriasPlugin = new CategoriasPlugin();
