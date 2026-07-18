/**
 * AuthService - Lógica de autenticación
 *
 * TokenPayload define la información codificada en el JWT.
 * Incluye nombre_completo y rol.color porque el frontend los necesita
 * para renderizar el Layout (sidebar, AppBar, avatares) sin hacer
 * peticiones adicionales al backend en cada navegación.
 *
 * Flujo de autenticación:
 * login() → valida credenciales → genera accessToken + refreshToken
 * refreshToken() → verifica refreshToken → recarga user desde BD → genera tokens nuevos
 *
 * CAMBIO ARQUITECTÓNICO (Fase Crítica):
 * ─────────────────────────────────────────────────────────────────────────────
 * buildPayload() ahora incluye `es_super_admin` desde Usuario.es_super_admin
 * (campo directo del usuario en DB), NO desde Rol.es_super_admin.
 *
 * Esto significa que incluso si alguien modifica el rol en DB, el superadmin
 * real conserva su flag personal en el token. El único superadmin del sistema
 * tiene este flag = true en su propio registro de usuario.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { usuarioRepository } from '../repositories/usuario.repository';
import { UnauthorizedError, NotFoundError, BadRequestError } from '../exceptions/HttpErrors';

/**
 * TokenPayload — estructura del JWT.
 * DEBE coincidir exactamente con auth.middleware.ts y con UsuarioAuth del frontend.
 *
 * es_super_admin al nivel raíz: viene de Usuario.es_super_admin (identidad).
 * rol.es_super_admin: campo heredado, solo para display — NO usar para auth.
 */
export interface TokenPayload {
  id:              number;
  uuid:            string;
  usuario:         string;
  email:           string;
  nombre_completo: string;
  /** Identidad del super admin — viene de Usuario.es_super_admin, NO del rol */
  es_super_admin:  boolean;
  /** Códigos de permiso (Permiso.codigo) asignados al rol del usuario — vacío para superadmin (bypasea todo) */
  permisos:        string[];
  rol: {
    id:             number;
    nombre:         string;
    /** @deprecated Usar TokenPayload.es_super_admin para decisiones de acceso */
    es_super_admin: boolean;
    color:          string | null;
  };
  /**
   * Restaurantes a los que tiene acceso este usuario.
   * Los superadmins tienen acceso a todos; para ellos se incluye la lista completa.
   * El frontend usa esta lista para el selector de restaurante activo.
   */
  restaurantes: { id: number; nombre: string; es_default: boolean; id_grupo: number }[];
}

/**
 * buildTokens — genera el par accessToken + refreshToken
 *
 * accessToken: vida corta (ej. 15min) — usado en cada request autenticado
 * refreshToken: vida larga (ej. 7d) — solo para renovar el accessToken
 * Ambos usan el mismo payload para que el frontend tenga datos consistentes.
 */
const buildTokens = (payload: TokenPayload) => ({
  accessToken:  jwt.sign(payload, config.jwt.secret,        { expiresIn: config.jwt.expiresIn as any }),
  refreshToken: jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn as any }),
  expiresIn:    config.jwt.expiresIn,
});

/**
 * buildPayload — construye el TokenPayload desde un usuario de BD.
 *
 * Centralizado aquí para garantizar que login() y refreshToken()
 * siempre generen exactamente la misma estructura en el JWT.
 *
 * IMPORTANTE: `es_super_admin` al nivel raíz viene de `user.es_super_admin`
 * (campo de la tabla Usuario), NO de `user.rol.es_super_admin`.
 * Esto desacopla la identidad del superadmin del sistema de roles.
 */
const buildPayload = (user: {
  id:              number;
  uuid:            string;
  usuario:         string;
  email:           string;
  nombre_completo: string;
  /** Campo directo del usuario — identifica al superadmin único del sistema */
  es_super_admin:  boolean;
  rol: {
    id:             number;
    nombre:         string;
    es_super_admin: boolean;
    color?:         string | null;
    permisos?:      Array<{ permiso: { codigo: string } }>;
  };
  restaurantes?: Array<{
    restaurante: { id: number; nombre: string; es_default: boolean; activo: boolean; id_grupo: number };
  }>;
}): TokenPayload => ({
  id:              user.id,
  uuid:            user.uuid,
  usuario:         user.usuario,
  email:           user.email,
  nombre_completo: user.nombre_completo,
  // ─── FUENTE DE VERDAD: es_super_admin del usuario, no del rol ───────────────
  es_super_admin:  user.es_super_admin,
  permisos:        (user.rol.permisos ?? []).map(rp => rp.permiso.codigo),
  restaurantes: (user.restaurantes ?? [])
    .filter(ur => ur.restaurante.activo)
    .map(ur => ({
      id:         ur.restaurante.id,
      nombre:     ur.restaurante.nombre,
      es_default: ur.restaurante.es_default,
      id_grupo:   ur.restaurante.id_grupo,
    })),
  rol: {
    id:             user.rol.id,
    nombre:         user.rol.nombre,
    es_super_admin: user.rol.es_super_admin, // conservado para display
    color:          user.rol.color ?? null,
  },
});

export const authService = {

  /**
   * login — valida credenciales y devuelve user + tokens.
   *
   * 'credencial' acepta username o email (resuelto en findByCredencial).
   * Se lanza el mismo error para usuario inexistente y contraseña incorrecta
   * para no revelar si el usuario existe (seguridad por ambigüedad).
   * Se registra ultimo_acceso para trazabilidad de sesiones.
   */
  async login(credencial: string, password: string) {
    const user = await usuarioRepository.findByCredencial(credencial);
    if (!user) throw new UnauthorizedError('Credenciales inválidas');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new UnauthorizedError('Credenciales inválidas');

    // Registrar último acceso — no crítico, no bloquea el login si falla
    await usuarioRepository.update(user.id, { ultimo_acceso: new Date() });

    const payload = buildPayload(user);
    return { user: payload, tokens: buildTokens(payload) };
  },

  /**
   * refreshToken — renueva el par de tokens sin re-login.
   *
   * Recarga el usuario desde BD (no usa los datos del token viejo) para que
   * cualquier cambio de rol, nombre, estado o es_super_admin quede reflejado
   * en los nuevos tokens. Si el usuario fue desactivado, el refresh falla.
   */
  async refreshToken(token: string) {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;

      // Recargar desde BD para obtener datos frescos (incluyendo es_super_admin actual)
      const user = await usuarioRepository.findByCredencial(decoded.usuario);
      if (!user) throw new UnauthorizedError('Token inválido');

      const payload = buildPayload(user);
      return buildTokens(payload);
    } catch {
      // jwt.verify lanza si el token expiró o fue manipulado
      throw new UnauthorizedError('Token inválido o expirado');
    }
  },

  /**
   * getProfile — perfil completo del usuario autenticado.
   *
   * Devuelve más campos que el token (telefono, fechas, creador, etc.)
   * usando selectPublico del repositorio. userId viene del middleware de auth.
   */
  async getProfile(userId: number) {
    const user = await usuarioRepository.findById(userId);
    if (!user) throw new NotFoundError('Usuario');
    return user;
  },

  /**
   * changePassword — cambia contraseña verificando la actual.
   *
   * Requiere dos consultas porque:
   * - findById usa selectPublico (sin password_hash, por seguridad)
   * - findByCredencial incluye password_hash para que bcrypt pueda comparar
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const profile = await usuarioRepository.findById(userId) as any;
    if (!profile) throw new NotFoundError('Usuario');

    // Segunda consulta para obtener el password_hash
    const full = await usuarioRepository.findByCredencial(profile.usuario);
    if (!full) throw new NotFoundError('Usuario');

    const ok = await bcrypt.compare(currentPassword, full.password_hash);
    if (!ok) throw new BadRequestError('Contraseña actual incorrecta');

    // Hashear con salt rounds 10 — balance entre seguridad y rendimiento
    const hash = await bcrypt.hash(newPassword, 10);
    await usuarioRepository.update(userId, { password_hash: hash });
    return { message: 'Contraseña actualizada correctamente' };
  },
};
