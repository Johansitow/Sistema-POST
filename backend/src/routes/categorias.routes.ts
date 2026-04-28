/**
 * Categorias Routes
 */

import { Router } from 'express';
import { getAll, getById, create, update, remove, reorder } from '../controller/categorias.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContext } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';

const router = Router();

router.use(authenticate, tenantContext, tenantIsolation);

router.get('/',          getAll);
router.get('/:id',       getById);
router.post('/',         create);
router.put('/:id',       update);
router.delete('/:id',    remove);
router.patch('/reorder', reorder);

export default router;
