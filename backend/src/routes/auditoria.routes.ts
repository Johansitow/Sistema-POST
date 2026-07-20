/**
 * Auditoría Routes
 *
 * GET /api/auditoria → historial con filtros
 *
 * Superadmin: historial completo del sistema.
 * Admin de grupo con permiso auditoria.ver: solo los registros de SU grupo.
 *
 * Nota: antes usaba requireRole('auditoria.ver'), que compara NOMBRES de rol —
 * como ningún rol se llama así, en la práctica solo pasaba el superadmin.
 * requireAdminAccess valida el permiso real (RolPermiso ∪ UsuarioPermiso).
 */

import { Router } from 'express';
import { auditoriaController } from '../controller/auditoria.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdminAccess } from '../middlewares/adminAccess.middleware';
import { tenantContextOptional } from '../middlewares/tenantContext.middleware';

const router = Router();

router.use(authenticate, tenantContextOptional, requireAdminAccess('auditoria.ver'));

router.get('/', auditoriaController.getAll);

export default router;
