/**
 * Facturación electrónica DIAN — emisión a solicitud, consulta y config por tenant.
 *
 * Config: solo owner/admin del grupo (requireGrupoAdmin → req.grupoAdminId).
 * Emisión/consulta: usuario con contexto de sede y permiso de facturas.
 */

import { Router } from 'express';
import { emitir, obtener, listar, getConfig, guardarConfig } from '../controller/facturacion.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContext, tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { requireGrupoAdmin } from '../middlewares/grupoAdmin.middleware';

const router = Router();

router.use(authenticate);

// ── Config DIAN (owner/admin del grupo) ── antes de /:id para no colisionar ──
router.get('/config', tenantContextOptional, requireGrupoAdmin, getConfig);
router.put('/config', tenantContextOptional, requireGrupoAdmin, guardarConfig);

// ── Emisión a solicitud + consulta (contexto de sede + permiso) ──
router.post('/ordenes/:idOrden/emitir', tenantContext, requirePermission('facturas.ver'), emitir);
router.get('/', tenantContextOptional, requirePermission('facturas.ver'), listar);
router.get('/:id', tenantContextOptional, requirePermission('facturas.ver'), obtener);

export default router;
