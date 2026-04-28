/**
 * Recibo Routes
 *
 * Todos los endpoints de generación de recibos.
 * No mutan estado — solo lectura.
 *
 * Middleware:
 *   authenticate    — JWT válido requerido
 *   tenantContext   — opcional (el recibo puede pertenecer a otro restaurante en el grupo)
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
router.get('/orden/:id',       requirePermission('ordenes.ver'), reciboController.porOrden);

// Recibo unificado de grupo (multi-restaurante)
router.get('/orden-grupo/:id', requirePermission('ordenes.ver'), reciboController.porOrdenGrupo);

// Punto de entrada inteligente — detecta si la orden es simple o grupal
router.get('/auto/:id',        requirePermission('ordenes.ver'), reciboController.auto);

export default router;
