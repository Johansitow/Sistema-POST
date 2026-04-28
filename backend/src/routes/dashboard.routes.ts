/**
 * Dashboard Routes
 */

import { Router } from 'express';
import { getStats, getResumenVentas, getAlertasInventario } from '../controller/dashboard.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';

const router = Router();

router.use(authenticate);
router.use(tenantContextOptional);
router.use(tenantIsolation);

router.get('/stats',    getStats);
router.get('/ventas',   getResumenVentas);
router.get('/alertas',  getAlertasInventario);

export default router;
