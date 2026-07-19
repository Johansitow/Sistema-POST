/**
 * Ordenes Routes — nueva arquitectura + compatibilidad legado
 *
 * Nueva arquitectura:
 *   POST /ordenes          → crea Orden + N sedes (createOrdenV2Schema)
 *   POST /ordenes/:id/pagar → pago global multi-método
 *   POST /ordenes/:id/cancelar → cancela Orden + todas las sedes
 *
 * Legado (órdenes sin sedes — backwards compatible):
 *   PATCH /ordenes/:id/estado → transición por id_estado (tabla estados_orden)
 *   POST  /ordenes/:id/detalles → agregar detalle (OrdenDetalle)
 *   PUT   /ordenes/:id/detalles/:detalleId
 *   DELETE /ordenes/detalles/:detalleId
 *
 * Permisos:
 *   ordenes.ver      → Cajero, Cocina, Admin
 *   ordenes.crear    → Cajero, Admin
 *   ordenes.cancelar → Cajero, Admin
 */

import { Router } from 'express';
import {
  getAll,
  getEstadisticas,
  getById,
  create,
  pagar,
  cancelar,
  update,
  updateEstado,
  remove,
  addDetalle,
  updateDetalle,
  removeDetalle,
} from '../controller/ordenes.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { tenantContext, tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';

const router = Router();
router.use(authenticate);

// ── Lectura ─────────────────────────────────────────────────────────────────
router.get('/',              tenantContextOptional, requirePermission('ordenes.ver'), getAll);
router.get('/estadisticas',  tenantContextOptional, requirePermission('ordenes.ver'), getEstadisticas);
router.get('/:id',           requirePermission('ordenes.ver'), getById);

// ── Nueva arquitectura ───────────────────────────────────────────────────────
router.post('/',             tenantContext, tenantIsolation, requirePermission('ordenes.crear'),    create);
router.post('/:id/pagar',    tenantContext,                  requirePermission('ordenes.crear'),    pagar);
router.post('/:id/cancelar', tenantContext, tenantIsolation, requirePermission('ordenes.cancelar'), cancelar);

// ── Legado ───────────────────────────────────────────────────────────────────
router.put('/:id',           tenantContext, tenantIsolation, requirePermission('ordenes.crear'),    update);
router.patch('/:id/estado',  tenantContext,                  requirePermission('ordenes.crear'),    updateEstado);
router.delete('/:id',        tenantContext, tenantIsolation, requirePermission('ordenes.cancelar'), remove);

// ── Legado: detalles ─────────────────────────────────────────────────────────
router.post('/:id/detalles',             tenantContext, tenantIsolation, requirePermission('ordenes.crear'),    addDetalle);
router.put('/:id/detalles/:detalleId',   tenantContext,                  requirePermission('ordenes.crear'),    updateDetalle);
router.delete('/detalles/:detalleId',    tenantContext,                  requirePermission('ordenes.cancelar'), removeDetalle);

export default router;
