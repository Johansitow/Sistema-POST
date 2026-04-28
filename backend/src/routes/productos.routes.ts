/**
 * Productos Routes
 *
 * Permisos aplicados (ver seed.ts para la asignación por rol):
 * - productos.ver      → Cajero, Cocina, Admin
 * - productos.crear    → Admin
 * - productos.editar   → Admin
 * - productos.eliminar → Admin
 */

import { Router } from 'express';
import { getAll, getById, getBySKU, create, update, patch, remove, updateStock, getStockBajo } from '../controller/productos.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { tenantContext } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';

const router = Router();

router.use(authenticate, tenantContext, tenantIsolation);

// Lectura — requiere ver productos
router.get('/',            requirePermission('productos.ver'), getAll);
router.get('/stock/bajo',  requirePermission('productos.ver'), getStockBajo);
router.get('/sku/:sku',    requirePermission('productos.ver'), getBySKU);
router.get('/:id',         requirePermission('productos.ver'), getById);

// Escritura — requiere permisos específicos
router.post('/',           requirePermission('productos.crear'),    create);
router.put('/:id',         requirePermission('productos.editar'),   update);
router.patch('/:id',       requirePermission('productos.editar'),   patch);
router.delete('/:id',      requirePermission('productos.eliminar'), remove);
router.post('/:id/stock',  requirePermission('productos.editar'),   updateStock);

export default router;
