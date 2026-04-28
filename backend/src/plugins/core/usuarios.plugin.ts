/**
 * UsuariosPlugin — Plugin core para gestión de usuarios
 *
 * Este es un "core plugin": siempre activo (sin featureFlag), registra
 * las páginas de administración de usuarios en el sidebar dinámico.
 *
 * Al ser un plugin core, no registra rutas propias (las rutas de usuarios
 * ya están en /api/v1/usuarios). Su función principal es declarar
 * adminPages y permissions para el sistema de administración.
 */

import type { IPlugin, PluginContext } from '../IPlugin';

export class UsuariosPlugin implements IPlugin {
  readonly name        = 'usuarios';
  readonly version     = '1.0.0';
  readonly description = 'Gestión de usuarios, roles y permisos del sistema';

  readonly adminPages = [
    {
      label: 'Usuarios',
      path:  '/admin/usuarios',
      icon:  'People',
      order: 10,
    },
  ];

  readonly permissions = [
    'usuarios.ver',
    'usuarios.crear',
    'usuarios.editar',
    'usuarios.eliminar',
    'usuarios.cambiar_rol',
  ];

  register(_context: PluginContext): void {
    // Las rutas de usuarios están en /api/v1/usuarios (routes/usuarios.routes.ts)
    // Este plugin solo declara metadata para el sistema de administración.
  }
}

export const usuariosPlugin = new UsuariosPlugin();
