/**
 * Auth Routes
 */

import { Router } from 'express';
import { login, logout, getProfile, refreshToken, changePassword } from '../controller/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Públicas
router.post('/login',           login);
router.post('/refresh',         refreshToken);

// Protegidas
router.get('/profile',          authenticate, getProfile);
router.post('/logout',          authenticate, logout);
router.put('/change-password',  authenticate, changePassword);

export default router;
