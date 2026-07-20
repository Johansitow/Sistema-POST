/**
 * requireAdminAccess — guard de los módulos del panel de administración.
 *
 * Jerarquía de acceso:
 *   1. Superadmin → acceso total (bypass).
 *   2. Admin de Grupo (UsuarioGrupo.rol_en_grupo ∈ {owner, admin}) → necesita
 *      además el permiso del módulo (otorgado por el SA vía UsuarioPermiso o
 *      heredado del rol). El scope queda en req.grupoAdminId: los services
 *      DEBEN acotar toda lectura/escritura a ese grupo cuando !req.esSuperAdmin.
 *   3. Cualquier otro usuario → 403.
 *
 * Compone los guards existentes (no duplica lógica):
 *   requireGrupoAdmin  → valida owner/admin y resuelve req.grupoAdminId
 *   requirePermission  → valida el código de permiso (RolPermiso ∪ UsuarioPermiso)
 *
 * Montar SIEMPRE después de authenticate y tenantContextOptional:
 *   router.post('/x', authenticate, tenantContextOptional, requireAdminAccess('sedes.gestionar'), ...)
 */

import { Request, Response, NextFunction } from 'express';
import { requireGrupoAdmin } from './grupoAdmin.middleware';
import { requirePermission } from './permission.middleware';

export const requireAdminAccess = (codigoPermiso: string) => {
  const checkPermission = requirePermission(codigoPermiso);

  return (req: Request, res: Response, next: NextFunction): void => {
    // Superadmin: bypass total, sin exigir contexto de grupo
    if (req.esSuperAdmin) return next();

    // Admin de grupo: primero membresía owner/admin, luego el permiso del módulo
    void requireGrupoAdmin(req, res, (err?: unknown) => {
      if (err) return next(err);
      void checkPermission(req, res, next);
    });
  };
};
