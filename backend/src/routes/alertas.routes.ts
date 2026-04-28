/**
 * alerta.routes.ts
 *
 * PROBLEMA: /alertas/no-leidas/count devolvía 404 porque la ruta
 * no estaba registrada, aunque el controller ya tenía getCountNoLeidas.
 *
 * IMPORTANTE: la ruta /no-leidas/count DEBE ir ANTES de /:id,
 * de lo contrario Express interpreta "no-leidas" como un id numérico
 * y la petición nunca llega al handler correcto.
 */

import { Router } from 'express';
import { alertaController } from '../controller/alerta.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContext } from '../middlewares/tenantContext.middleware';
import { tenantIsolation } from '../middlewares/tenantIsolation.middleware';

const router = Router();

router.use(authenticate, tenantContext, tenantIsolation);

// ─── Tipos de alerta ────────────────────────────────────────────────────────

router.get   ('/tipos-alerta',      alertaController.getTipos);
router.post  ('/tipos-alerta',      alertaController.createTipo);
router.put   ('/tipos-alerta/:id',  alertaController.updateTipo);

// ─── Alertas ─────────────────────────────────────────────────────────────────

// ⚠️ RUTAS ESPECÍFICAS PRIMERO — antes de /:id
router.get   ('/no-leidas/count', alertaController.getCountNoLeidas);  // badge del Layout
router.patch ('/leer-todas',      alertaController.marcarTodasLeidas);
router.post  ('/sincronizar',     alertaController.sincronizar);

// Rutas generales
router.get   ('',      alertaController.getAll);
router.patch ('/:id/leer', alertaController.marcarLeida);

export default router;