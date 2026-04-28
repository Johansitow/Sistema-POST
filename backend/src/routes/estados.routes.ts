/**
 * Estados de Orden Routes
 *
 * GET  /api/estados-orden                          → listar todos
 * GET  /api/estados-orden/:id                      → detalle con transiciones
 * PUT  /api/estados-orden/:id                      → editar visual (superadmin)
 * GET  /api/estados-orden/:id/transiciones         → transiciones desde ese estado
 * POST /api/estados-orden/:id/transiciones         → agregar transición
 * DELETE /api/estados-orden/:id/transiciones/:transicionId → eliminar transición
 */

import { Router } from 'express';
import { estadoController } from '../controller/estado.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/',    estadoController.getAll);
router.get('/:id', estadoController.getById);

// Solo superadmin puede modificar estados y transiciones
router.put('/:id',                                    requireSuperAdmin, estadoController.update);
router.get('/:id/transiciones',                       estadoController.getTransiciones);
router.post('/:id/transiciones',                      requireSuperAdmin, estadoController.addTransicion);
router.delete('/:id/transiciones/:transicionId',      requireSuperAdmin, estadoController.deleteTransicion);

export default router;
