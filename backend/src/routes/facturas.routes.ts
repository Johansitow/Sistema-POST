/**
 * Facturas Routes
 *
 * GET /api/facturas              → listar con filtros
 * GET /api/facturas/:id          → detalle de factura
 * GET /api/ordenes/:id/factura   → factura de una orden (en ordenes.routes.ts)
 */

import { Router } from 'express';
import { facturaController } from '../controller/factura.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';

const router = Router();

router.use(authenticate);

router.get('/',    tenantContextOptional, tenantIsolation, facturaController.getAll);
router.get('/:id', facturaController.getById);

export default router;
