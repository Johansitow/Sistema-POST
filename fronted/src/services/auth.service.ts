/**
 * auth.service.ts - Servicio de autenticación del frontend
 */

import api from './api';
import type { LoginCredentials } from '../types/auth.types';
import type {
  UsuarioAuth, AuthTokens, PerfilUsuario, NominaEmpleado, HistorialSalario, MiPerfilDto,
} from '../types';

/** Datos del alta self-serve (embudo gratis). */
export interface RegistroData {
  nombre_negocio: string;
  nombre_completo: string;
  email: string;
  usuario: string;
  password: string;
  acepta_habeas_data: boolean;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: UsuarioAuth; tokens: AuthTokens }> {
    const res = await api.post('/auth/login', credentials);
    // El backend responde: { message, user, tokens }
    return { user: res.data.user, tokens: res.data.tokens };
  },

  /** Registro público: crea el negocio en plan Gratis y devuelve sesión iniciada. */
  async registrar(data: RegistroData): Promise<{ user: UsuarioAuth; tokens: AuthTokens }> {
    const res = await api.post('/auth/registro', data);
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

  // ── Portal del trabajador ───────────────────────────────────────────────────
  // El backend toma el id del token: estas rutas nunca pueden apuntar a otra
  // persona, por eso no exigen permisos de administración.

  /** Salario vigente e historial del propio usuario autenticado. */
  async getMiNomina(): Promise<{ nomina: NominaEmpleado | null; historial: HistorialSalario[] }> {
    const res = await api.get('/auth/mi-nomina');
    return { nomina: res.data.nomina ?? null, historial: res.data.historial ?? [] };
  },

  /** Autogestión de datos de contacto (whitelist corta en el backend). */
  async actualizarMiPerfil(data: MiPerfilDto): Promise<PerfilUsuario> {
    const res = await api.patch('/auth/mi-perfil', data);
    return res.data.user;
  },
};