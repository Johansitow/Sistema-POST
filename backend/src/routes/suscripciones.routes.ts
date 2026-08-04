/**
 * Suscripciones Routes — bajo /suscripciones.
 * Solo owner/admin del grupo (requireGrupoAdmin resuelve req.grupoAdminId).
 */

import { Router } from 'express';
import { checkout, cancelar, estado } from '../controller/suscripcion.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { requireGrupoAdmin } from '../middlewares/grupoAdmin.middleware';

const router = Router();

router.use(authenticate, tenantContextOptional, requireGrupoAdmin);

router.get('/estado',   estado);
router.post('/checkout', checkout);
router.post('/cancelar', cancelar);

export default router;
