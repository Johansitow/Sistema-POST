/**
 * auth.types.ts - Tipos de autenticación compartidos en el frontend
 */

export interface LoginCredentials {
  usuario: string;
  password: string;
}

export interface RolUsuario {
  id: number;
  nombre: string;
  descripcion?: string;
  color?: string;
  /** @deprecated Solo para display. NO usar para decisiones de acceso — usar UsuarioAuth.es_super_admin */
  es_super_admin: boolean;
}

export interface UsuarioAuth {
  id: number;
  uuid: string;
  nombre_completo: string;
  email: string;
  usuario: string;
  telefono?: string;
  estado: string;
  ultimo_acceso?: string;
  /**
   * Fuente de verdad para super admin — viene de Usuario.es_super_admin en DB (NO del rol).
   * SIEMPRE usar este campo para decisiones de acceso en el frontend.
   */
  es_super_admin: boolean;
  /** Permisos efectivos: rol (RolPermiso) ∪ directos (UsuarioPermiso) */
  permisos?: string[];
  /** Grupos donde el usuario es owner/admin — habilita el panel de administración de grupo */
  grupos_admin?: { id_grupo: number; rol_en_grupo: string }[];
  rol: RolUsuario;
  restaurantes: { id: number; nombre: string; es_default: boolean; id_grupo: number }[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResponse {
  message: string;
  user: UsuarioAuth;
  tokens: AuthTokens;
}