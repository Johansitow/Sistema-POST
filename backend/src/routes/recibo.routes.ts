/**
 * Recibo Routes
 *
 * Todos los endpoints de generación de recibos.
 * No mutan estado — solo lectura.
 *
 * Middleware:
 *   authenticate    — JWT válido requerido
 *   tenantContext   — opcional
 *   requirePermission('ordenes.ver') — permiso mínimo para acceder al recibo
 */

import { Router } from 'express';
import { reciboController } from '../controller/recibo.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.use(authenticate, tenantContextOptional);

// Recibo de orden individual
router.get('/orden/:id', requirePermission('ordenes.ver'), reciboController.porOrden);

export default router;
