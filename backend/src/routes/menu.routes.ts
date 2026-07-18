/**
 * Menu Routes — subdivisiones editables del menú lateral (grupo + módulos)
 */

import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../middlewares/auth.middleware';
import { listar, guardar } from '../controller/grupoMenu.controller';

const router = Router();
router.use(authenticate);

// Lectura: cualquier usuario autenticado la necesita para renderizar su propio sidebar
router.get('/', listar);

// Escritura: solo superadmin, igual que /admin/apariencia en el frontend
router.put('/', requireSuperAdmin, guardar);

export default router;
