/**
 * admin.routes.ts — Endpoints de metadatos del sistema de administración
 *
 * GET /api/v1/admin/modules
 *   Devuelve las páginas de administración de todos los plugins activos.
 *   El frontend las usa para construir dinámicamente el sidebar de admin.
 *   Solo accesible por superadmin.
 *
 * GET /api/v1/admin/permissions
 *   Devuelve todos los permisos requeridos por los plugins activos.
 *   Útil para seed, documentación y validación de RBAC.
 *   Solo accesible por superadmin.
 *
 * GET /api/v1/admin/plugins
 *   Devuelve la lista de plugins activos con nombre, versión y descripción.
 *   Solo accesible por superadmin.
 */

import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../middlewares/auth.middleware';
import { pluginLoader } from '../plugins/PluginLoader';

const router = Router();

/** Páginas de admin de los plugins activos (para sidebar dinámico) */
router.get('/modules', authenticate, requireSuperAdmin, (_req, res) => {
  const modules = pluginLoader.getAdminModules();
  res.json({ success: true, data: modules });
});

/** Permisos requeridos por los plugins activos */
router.get('/permissions', authenticate, requireSuperAdmin, (_req, res) => {
  const permissions = pluginLoader.getRequiredPermissions();
  res.json({ success: true, data: permissions });
});

/** Lista de plugins activos */
router.get('/plugins', authenticate, requireSuperAdmin, (_req, res) => {
  const active = pluginLoader.listActive().map(name => {
    const plugin = pluginLoader.get(name);
    return {
      name:        plugin?.name,
      version:     plugin?.version,
      description: plugin?.description,
      featureFlag: plugin?.featureFlag ?? null,
      adminPages:  plugin?.adminPages?.length ?? 0,
      permissions: plugin?.permissions?.length ?? 0,
    };
  });
  res.json({ success: true, data: active });
});

export default router;
