/**
 * Auditoría Routes
 *
 * GET /api/auditoria → historial completo con filtros
 *
 * Protegido por requireRole('auditoria.ver'):
 * Solo el superadmin tiene este permiso por defecto.
 * El superadmin puede delegarlo a otros usuarios desde el frontend.
 */

import { Router } from 'express';
import { auditoriaController } from '../controller/auditoria.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('auditoria.ver'));

router.get('/', auditoriaController.getAll);

export default router;
