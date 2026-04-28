/**
 * Proveedores Routes
 *
 * GET    /api/proveedores                              → listar paginado
 * GET    /api/proveedores/:id                          → detalle con productos
 * POST   /api/proveedores                              → crear
 * PUT    /api/proveedores/:id                          → editar
 * PATCH  /api/proveedores/:id/estado                   → activar/desactivar
 * GET    /api/proveedores/:id/productos                → productos del proveedor
 * POST   /api/proveedores/:id/productos                → asociar producto
 * PUT    /api/proveedores/:id/productos/:productoId    → actualizar precio/condiciones
 * DELETE /api/proveedores/:id/productos/:productoId    → desasociar
 */

import { Router } from 'express';
import { proveedorController } from '../controller/proveedor.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContext } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';

const router = Router();

router.use(authenticate, tenantContext, tenantIsolation);

router.get('/',    proveedorController.getAll);
router.get('/:id', proveedorController.getById);
router.post('/',   proveedorController.create);
router.put('/:id', proveedorController.update);
router.patch('/:id/estado', proveedorController.cambiarEstado);

// Productos del proveedor
router.get('/:id/productos',                      proveedorController.getProductos);
router.post('/:id/productos',                     proveedorController.asociarProducto);
router.put('/:id/productos/:productoId',          proveedorController.actualizarRelacion);
router.delete('/:id/productos/:productoId',       proveedorController.desasociarProducto);

export default router;
