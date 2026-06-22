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
import { authenticate } from '../middlewares/auth.middleware';
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

export default router;
