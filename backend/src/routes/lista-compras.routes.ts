/**
 * Rutas de Lista de Compras
 *
 * Todas las rutas que operan sobre una lista concreta llevan contexto de tenant
 * (tenantContext + tenantIsolation) para que el service pueda verificar que la
 * lista pertenece a la sede activa y así cerrar el IDOR.
 */

import { Router } from 'express';
import { listaComprasController } from '../controller/lista-compras.controller';
import { authenticate }           from '../middlewares/auth.middleware';
import { tenantContext, tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';

const router = Router();

router.use(authenticate);

router.get('/',              tenantContextOptional, tenantIsolation, listaComprasController.listar);
router.get('/:id',           tenantContext,          tenantIsolation, listaComprasController.obtener);
router.post('/',             tenantContext,          tenantIsolation, listaComprasController.crearManual);
router.post('/generar',      tenantContext,          tenantIsolation, listaComprasController.generar);
router.patch('/:id/estado',  tenantContext,          tenantIsolation, listaComprasController.cambiarEstado);
router.put('/:id/items/:id_item', tenantContext,     tenantIsolation, listaComprasController.actualizarItem);

export default router;
