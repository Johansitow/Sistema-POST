/**
 * AuthController - Recibe request, valida con DTO, delega al service
 */

import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { loginSchema, refreshTokenSchema, changePasswordSchema } from '../dto/auth.dto';
import { registrarAuditoria } from '../repositories/auditoria.repository';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { usuario, password } = loginSchema.parse(req.body);
  const result = await authService.login(usuario, password);

  registrarAuditoria({
    id_usuario:  result.user.id,
    accion:      'LOGIN',
    modulo:      'auth',
    ip_address:  req.auditContext?.ip,
    user_agent:  req.auditContext?.userAgent,
  });

  res.json({ message: 'Login exitoso', user: result.user, tokens: result.tokens });
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshTokenSchema.parse(req.body);
  const tokens = await authService.refreshToken(refreshToken);
  res.json({ tokens });
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getProfile((req as any).user!.id);
  res.json({ user });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const result = await authService.changePassword((req as any).user!.id, currentPassword, newPassword);

  registrarAuditoria({
    id_usuario:  (req as any).user!.id,
    accion:      'CAMBIAR_PASSWORD',
    modulo:      'auth',
    ip_address:  req.auditContext?.ip,
    user_agent:  req.auditContext?.userAgent,
  });

  res.json(result);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  registrarAuditoria({
    id_usuario:  (req as any).user?.id,
    accion:      'LOGOUT',
    modulo:      'auth',
    ip_address:  req.auditContext?.ip,
    user_agent:  req.auditContext?.userAgent,
  });

  res.json({ message: 'Sesión cerrada correctamente' });
});
