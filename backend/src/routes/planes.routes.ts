/**
 * Planes Routes — catálogo público de planes + plan del grupo autenticado.
 */

import { Router } from 'express';
import { getPlanes, getMiPlan } from '../controller/planes.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContextOptional } from '../middlewares/tenantContext.middleware';

const router = Router();

// Público — alimenta la página de precios sin sesión.
router.get('/', getPlanes);

// Autenticado — plan y uso del grupo del usuario.
router.get('/mi-plan', authenticate, tenantContextOptional, getMiPlan);

export default router;
