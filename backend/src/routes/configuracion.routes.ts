/**
 * Rutas de Configuración y Permisos
 */

import { Router, Request, Response, NextFunction } from 'express';
import { configuracionService } from '../services/configuracion.service';
import { authenticate }         from '../middlewares/auth.middleware';
import { requirePermission }    from '../middlewares/permission.middleware';
import { requireAdminAccess }   from '../middlewares/adminAccess.middleware';
import { tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { successResponse }      from '../lib/response';

const router = Router();

// Gestión de permisos por rol: superadmin o admin de grupo con permisos.gestionar.
// Un no-superadmin NO puede tocar roles de sistema/superadmin ni otorgar permisos
// del módulo 'administracion' (esas restricciones viven en configuracionService).
const permisosAdmin = [authenticate, tenantContextOptional, requireAdminAccess('permisos.gestionar')] as const;

// ── Configuración ─────────────────────────────────────────────────────────────

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoria = Array.isArray(req.query.categoria)
      ? String(req.query.categoria[0])
      : req.query.categoria as string | undefined;
    const data = await configuracionService.listar(categoria);
    res.json(successResponse(data));
  } catch (e) { next(e); }
});

router.get('/permisos', ...permisosAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await configuracionService.listarPermisos();
      res.json(successResponse(data));
    } catch (e) { next(e); }
  }
);

router.get('/permisos/rol/:id', ...permisosAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await configuracionService.listarPermisosRol(Number(req.params.id));
      res.json(successResponse(data));
    } catch (e) { next(e); }
  }
);

router.post('/permisos/rol/:id', ...permisosAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id_permiso } = req.body;
      if (!id_permiso) { res.status(400).json({ error: 'id_permiso requerido' }); return; }
      const data = await configuracionService.asignarPermiso(
        Number(req.params.id), Number(id_permiso), req.esSuperAdmin === true);
      res.status(201).json(successResponse(data, 'Permiso asignado'));
    } catch (e) { next(e); }
  }
);

router.put('/permisos/rol/:id/sync', ...permisosAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ids_permisos } = req.body;
      if (!Array.isArray(ids_permisos)) { res.status(400).json({ error: 'ids_permisos debe ser un array' }); return; }
      const data = await configuracionService.sincronizarPermisos(
        Number(req.params.id), ids_permisos, req.esSuperAdmin === true);
      res.json(successResponse(data, 'Permisos sincronizados'));
    } catch (e) { next(e); }
  }
);

router.delete('/permisos/rol/:id/:permiso', ...permisosAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await configuracionService.revocarPermiso(
        Number(req.params.id), Number(req.params.permiso), req.esSuperAdmin === true);
      res.json(successResponse(null, 'Permiso revocado'));
    } catch (e) { next(e); }
  }
);

router.get('/:clave', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clave = String(req.params.clave);
    const data  = await configuracionService.obtenerPorClave(clave);
    res.json(successResponse(data));
  } catch (e) { next(e); }
});

router.put('/:clave', authenticate, requirePermission('config.sistema'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clave = String(req.params.clave);
      const { valor } = req.body;
      if (valor === undefined) { res.status(400).json({ error: 'valor requerido' }); return; }
      const data = await configuracionService.actualizar(clave, String(valor));
      res.json(successResponse(data, 'Configuración actualizada'));
    } catch (e) { next(e); }
  }
);

router.patch('/', authenticate, requirePermission('config.sistema'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) { res.status(400).json({ error: 'items debe ser un array [{ clave, valor }]' }); return; }
      const data = await configuracionService.actualizarVarias(items);
      res.json(successResponse(data, 'Configuraciones actualizadas'));
    } catch (e) { next(e); }
  }
);

export default router;