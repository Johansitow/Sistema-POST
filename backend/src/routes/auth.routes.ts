/**
 * Auth Routes
 */

import { Router } from 'express';
import { login, logout, getProfile, refreshToken, changePassword, getMiNomina, actualizarMiPerfil } from '../controller/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Públicas
router.post('/login',           login);
router.post('/refresh',         refreshToken);

// Protegidas
router.get('/profile',          authenticate, getProfile);
router.post('/logout',          authenticate, logout);
router.put('/change-password',  authenticate, changePassword);

// ── Portal del trabajador ─────────────────────────────────────────────────────
// Rutas sobre los datos PROPIOS: el id sale siempre del token, nunca de la URL,
// así que no requieren permiso de administración ni pueden apuntar a otro
// usuario. Es lo que permite que un mesero vea su salario sin darle acceso al
// módulo de usuarios.
router.get('/mi-nomina',        authenticate, getMiNomina);
router.patch('/mi-perfil',      authenticate, actualizarMiPerfil);

export default router;
