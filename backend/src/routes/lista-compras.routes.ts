/**
 * Rutas de Lista de Compras
 */

import { Router } from 'express';
import { listaComprasController } from '../controller/lista-compras.controller';
import { authenticate }           from '../middlewares/auth.middleware';
import { tenantContext, tenantContextOptional } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';

const router = Router();

router.use(authenticate);

router.get('/',              tenantContextOptional, tenantIsolation, listaComprasController.listar);
router.get('/:id',                                                   listaComprasController.obtener);
router.post('/generar',      tenantContext,          tenantIsolation, listaComprasController.generar);
router.patch('/:id/estado',                        listaComprasController.cambiarEstado);
router.put('/:id/items/:id_item',                  listaComprasController.actualizarItem);

export default router;
