/**
 * Tipos de Alerta Routes — rutas de configuración de tipos
 */

import { Router } from 'express';
import { alertaController } from '../controller/alerta.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/',    alertaController.getTipos);
router.post('/',   requireSuperAdmin, alertaController.createTipo);
router.put('/:id', requireSuperAdmin, alertaController.updateTipo);

export default router;
