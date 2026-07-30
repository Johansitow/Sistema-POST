/**
 * Documentos Routes — documentos laborales.
 *
 * Ojo con el orden: /verificar/:codigo es PÚBLICA y va ANTES del
 * router.use(authenticate). Es el destino del QR impreso: un banco o una
 * embajada deben poder comprobar un certificado sin tener cuenta.
 * Solo expone lo justo para confirmar autenticidad (nunca el salario).
 */

import { Router } from 'express';
import {
  listarTipos, listarVariables, previsualizar, emitir,
  listarPorEmpleado, obtenerContenido, anular, verificar,
} from '../controller/documentos.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdminAccess } from '../middlewares/adminAccess.middleware';
import { tenantContextOptional } from '../middlewares/tenantContext.middleware';

const router = Router();

// ── Pública ───────────────────────────────────────────────────────────────────
router.get('/verificar/:codigo', verificar);

// ── Protegidas ────────────────────────────────────────────────────────────────
// Mismo permiso que la gestión de personal: quien administra empleados es quien
// emite sus documentos.
router.use(authenticate, tenantContextOptional, requireAdminAccess('usuarios.gestionar'));

router.get('/tipos',     listarTipos);
router.get('/variables', listarVariables);

router.post('/previsualizar', previsualizar);
router.post('/',              emitir);

router.get('/empleado/:idEmpleado', listarPorEmpleado);
router.get('/:id/contenido',        obtenerContenido);
router.patch('/:id/anular',         anular);

export default router;
