/**
 * Inventario Routes
 */

import { Router } from 'express';
import { getMovimientos, registrarMovimiento, getEstadisticas, getLotesVencimiento, getValorInventario, getLotes, getRentabilidadLote } from '../controller/inventario.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContext } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';

const router = Router();

router.use(authenticate, tenantContext, tenantIsolation);

router.get('/movimientos',         getMovimientos);
router.post('/movimientos',        registrarMovimiento);
router.get('/movimientos/stats',   getEstadisticas);
router.get('/lotes',                    getLotes);
router.get('/lotes/vencimiento',        getLotesVencimiento);
router.get('/lotes/:id/rentabilidad',   getRentabilidadLote);
router.get('/valor',               getValorInventario);

export default router;
