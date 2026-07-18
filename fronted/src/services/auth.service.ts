/**
 * auth.service.ts - Servicio de autenticación del frontend
 */

import api from './api';
import type { LoginCredentials } from '../types/auth.types';
import type { UsuarioAuth, AuthTokens, PerfilUsuario } from '../types';

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: UsuarioAuth; tokens: AuthTokens }> {
    const res = await api.post('/auth/login', credentials);
    // El backend responde: { message, user, tokens }
    return { user: res.data.user, tokens: res.data.tokens };
  },

  async getProfile(): Promise<PerfilUsuario> {
    const res = await api.get('/auth/profile');
    return res.data.user;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const res = await api.post('/auth/refresh', { refreshToken });
    return res.data.tokens;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.put('/auth/change-password', { currentPassword, newPassword });
  },
};