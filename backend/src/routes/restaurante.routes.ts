/**
 * Restaurante Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireSuperAdmin } from '../middlewares/auth.middleware';
import { requireAdminAccess } from '../middlewares/adminAccess.middleware';
import { tenantContext, tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';
import {
  listar,
  obtener,
  obtenerDefault,
  crear,
  actualizar,
  toggleActivo,
  listarUsuarios,
  asignarUsuario,
  removerUsuario,
} from '../controller/restaurante.controller';
import { restauranteService } from '../services/restaurante.service';

const router = Router();
router.use(authenticate);

router.get('/',              listar);           // ?todos=true → incluye inactivos (scoped por grupo si no es superadmin)
router.get('/default',       obtenerDefault);   // Restaurante marcado como default

// Mutaciones: superadmin (global) o admin de grupo con sedes.gestionar (scoped a su grupo).
// Absorbe el antiguo módulo "Mi Grupo": whitelist de campos, límite de plan y
// anti-IDOR viven en restauranteService (grupoScope del controller).
const sedesAdmin = [tenantContextOptional, requireAdminAccess('sedes.gestionar')] as const;

router.get('/:id',           obtener);
router.post('/',             ...sedesAdmin, crear);
router.put('/:id',           ...sedesAdmin, actualizar);
router.patch('/:id/toggle',  ...sedesAdmin, toggleActivo);

// ── Gestión de usuarios por restaurante ───────────────────────────────────────
router.get('/:id/usuarios',              ...sedesAdmin, listarUsuarios);
router.post('/:id/usuarios',             ...sedesAdmin, asignarUsuario);
router.delete('/:id/usuarios/:userId',   ...sedesAdmin, removerUsuario);

// ── Configuración por restaurante ─────────────────────────────────────────────
// Accesible por el propio tenant (tenantContext) o por superadmin

router.get('/:id/config', tenantContextOptional, tenantIsolation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await restauranteService.listarConfig(Number(req.params.id));
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }
);

router.put('/:id/config/:clave', tenantContext, tenantIsolation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { valor } = req.body;
      if (valor === undefined) { res.status(400).json({ error: 'valor es requerido' }); return; }
      const clave = Array.isArray(req.params.clave) ? req.params.clave[0] : req.params.clave;
      const data = await restauranteService.setConfig(Number(req.params.id), clave, String(valor));
      res.json({ success: true, data, message: 'Configuración guardada' });
    } catch (e) { next(e); }
  }
);

router.patch('/:id/config', tenantContext, tenantIsolation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) { res.status(400).json({ error: 'items debe ser un array [{ clave, valor }]' }); return; }
      const data = await restauranteService.setConfigBulk(Number(req.params.id), items);
      res.json({ success: true, data, message: 'Configuración actualizada' });
    } catch (e) { next(e); }
  }
);

router.delete('/:id/config/:clave', requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clave = Array.isArray(req.params.clave) ? req.params.clave[0] : req.params.clave;
      await restauranteService.deleteConfig(Number(req.params.id), clave);
      res.json({ success: true, message: 'Configuración eliminada' });
    } catch (e) { next(e); }
  }
);

export default router;
