/**
 * Auth Routes
 */

import { Router } from 'express';
import {
  login, registro, logout, getProfile, refreshToken, changePassword,
  getMiNomina, actualizarMiPerfil, marcarMiTutorial,
  verificarEmail, reenviarVerificacion, solicitarReset, confirmarReset,
} from '../controller/auth.controller';
import {
  misDocumentos, miDocumentoContenido, misPeriodosLiquidados, miDesprendible,
} from '../controller/documentos.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authRateLimit } from '../middlewares/authRateLimit.middleware';
import { verificarCaptcha } from '../middlewares/captcha.middleware';

const router = Router();

// Públicas
router.post('/login',           login);
// Alta self-serve (embudo gratis) — con captcha y límite dedicado anti-bots.
router.post('/registro',        authRateLimit(), verificarCaptcha, registro);
router.post('/refresh',         refreshToken);

// ── Verificación de correo y recuperación de contraseña ───────────────────────
router.post('/verificar-email',       authRateLimit(),                    verificarEmail);
router.post('/solicitar-reset',       authRateLimit(), verificarCaptcha,  solicitarReset);
router.post('/confirmar-reset',       authRateLimit(),                    confirmarReset);
router.post('/reenviar-verificacion', authenticate,    authRateLimit(3),  reenviarVerificacion);

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
router.patch('/mi-tutorial',    authenticate, marcarMiTutorial);

// Documentos propios (certificado emitido por el admin + desprendible autoservicio).
router.get('/mis-documentos',             authenticate, misDocumentos);
router.get('/mis-documentos/:id/contenido', authenticate, miDocumentoContenido);
router.get('/mis-periodos-liquidados',    authenticate, misPeriodosLiquidados);
router.post('/mi-desprendible',           authenticate, miDesprendible);

export default router;
