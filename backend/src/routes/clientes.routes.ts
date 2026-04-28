/**
 * Clientes Routes
 *
 * GET    /api/clientes                              → listar paginado con filtros
 * GET    /api/clientes/estadisticas                 → stats (total, activos, frecuentes, vip)
 * GET    /api/clientes/:id                          → detalle con direcciones
 * POST   /api/clientes                              → crear cliente
 * PUT    /api/clientes/:id                          → actualizar datos
 * PATCH  /api/clientes/:id/estado                   → activar/desactivar
 * GET    /api/clientes/:id/ordenes                  → historial de órdenes
 * GET    /api/clientes/:id/direcciones              → direcciones guardadas
 * POST   /api/clientes/:id/direcciones              → agregar dirección
 * PUT    /api/clientes/:id/direcciones/:id_dir      → actualizar dirección
 * DELETE /api/clientes/:id/direcciones/:id_dir      → desactivar dirección
 * GET    /api/clientes/:id/puntos                   → historial de puntos
 * POST   /api/clientes/:id/puntos/canjear           → canjear puntos
 */

import { Router } from 'express';
import { clienteController } from '../controller/cliente.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { tenantContext } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';

const router = Router();

router.use(authenticate, tenantContext, tenantIsolation);

// Rutas sin parámetro :id primero — evita que "estadisticas" se resuelva como un ID
router.get('/estadisticas', requirePermission('clientes.ver'),       clienteController.getEstadisticas);
router.get('/',             requirePermission('clientes.ver'),       clienteController.getAll);
router.post('/',            requirePermission('clientes.gestionar'), clienteController.create);

// Rutas con :id
router.get('/:id',          requirePermission('clientes.ver'),       clienteController.getById);
router.put('/:id',          requirePermission('clientes.gestionar'), clienteController.update);
router.patch('/:id/estado', requirePermission('clientes.gestionar'), clienteController.cambiarEstado);

// Sub-recursos
router.get('/:id/ordenes', requirePermission('clientes.ver'), clienteController.getOrdenes);

router.get('/:id/direcciones',            requirePermission('clientes.ver'),       clienteController.getDirecciones);
router.post('/:id/direcciones',           requirePermission('clientes.gestionar'), clienteController.addDireccion);
router.put('/:id/direcciones/:id_dir',    requirePermission('clientes.gestionar'), clienteController.updateDireccion);
router.delete('/:id/direcciones/:id_dir', requirePermission('clientes.gestionar'), clienteController.deleteDireccion);

router.get('/:id/puntos',          requirePermission('clientes.ver'),       clienteController.getPuntos);
router.post('/:id/puntos/canjear', requirePermission('clientes.gestionar'), clienteController.canjearPuntos);

export default router;
