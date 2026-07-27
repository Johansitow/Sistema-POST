/**
 * Onboarding Routes
 *
 * POST /api/v1/onboarding/apply
 *   ?preview=true  → previsualiza el perfil sin persistir
 *   (sin query)    → aplica y persiste transaccionalmente
 *
 * Requiere: authenticate + tenantContext (restauranteId + grupoId del JWT)
 * Permiso:  onboarding.aplicar (asignado al rol Administrador en el seed)
 */

import { Router } from 'express';
import { apply } from '../controller/onboarding.controller';
import {
  crearSandbox,
  listarSandboxes,
  entrarSandbox,
  eliminarSandbox,
} from '../controller/sandboxOnboarding.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth.middleware';
import { tenantContext } from '../middlewares/tenantContext.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.post(
  '/apply',
  authenticate,
  tenantContext,
  requirePermission('onboarding.aplicar'),
  apply,
);

// ── Sandboxes de "Probar configuración" (solo superadmin) ──────────────────────
// Cada prueba es un GrupoNegocio desechable (es_sandbox) con 1+ sedes. Se puede
// crear, entrar (sesión fresca) y borrar por completo sin tocar datos reales.
router.use('/sandbox', authenticate, requireSuperAdmin);
router.post('/sandbox',                 crearSandbox);
router.get('/sandbox',                  listarSandboxes);
router.post('/sandbox/:idGrupo/entrar', entrarSandbox);
router.delete('/sandbox/:idGrupo',      eliminarSandbox);

export default router;
