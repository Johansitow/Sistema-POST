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
import { tokenAuthService } from './tokenAuth.service';
import { emailService, plantillaVerificacion, plantillaReset } from './email.service';
import { cacheDel } from '../config/redis';
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
  /**
   * ¿El usuario ya verificó su correo? El frontend lo usa para mostrar/ocultar el
   * banner de verificación sin una petición extra (como tutorial_completado).
   */
  email_verificado: boolean;
  /**
   * Progreso del modo tutorial (product tour), POR USUARIO. El frontend lo usa
   * para decidir si auto-dispara el tour de bienvenida sin peticiones extra.
   */
  tutorial_completado: boolean;
  /**
   * Códigos de permiso (Permiso.codigo) efectivos del usuario:
   * permisos del rol (RolPermiso) ∪ permisos directos (UsuarioPermiso).
   * Vacío para superadmin (bypasea todo).
   */
  permisos:        string[];
  /**
   * Grupos donde el usuario es owner/admin (UsuarioGrupo activo).
   * El frontend lo usa para decidir si mostrar el panel de administración
   * sin hacer peticiones adicionales.
   */
  grupos_admin:    { id_grupo: number; rol_en_grupo: string }[];
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
  /** ¿Correo verificado? */
  email_verificado: boolean;
  /** Progreso del modo tutorial, por usuario */
  tutorial_completado: boolean;
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
  permisos_directos?: Array<{ permiso: { codigo: string } }>;
  grupos?: Array<{ id_grupo: number; rol_en_grupo: string }>;
}): TokenPayload => ({
  id:              user.id,
  uuid:            user.uuid,
  usuario:         user.usuario,
  email:           user.email,
  nombre_completo: user.nombre_completo,
  // ─── FUENTE DE VERDAD: es_super_admin del usuario, no del rol ───────────────
  es_super_admin:  user.es_super_admin,
  email_verificado: user.email_verificado,
  tutorial_completado: user.tutorial_completado,
  // Permisos efectivos = rol ∪ directos (sin duplicados)
  permisos: [...new Set([
    ...(user.rol.permisos ?? []).map(rp => rp.permiso.codigo),
    ...(user.permisos_directos ?? []).map(up => up.permiso.codigo),
  ])],
  grupos_admin: (user.grupos ?? []).map(g => ({
    id_grupo:     g.id_grupo,
    rol_en_grupo: g.rol_en_grupo,
  })),
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
   * emitirSesion — re-emite user + tokens frescos para un usuario ya autenticado,
   * sin pedir credenciales. Recarga desde BD (misma fuente que login/refresh) para
   * que la lista `restaurantes` refleje asignaciones recién creadas.
   *
   * Se usa al crear/entrar a un sandbox de onboarding: tras asignar al superadmin
   * como UsuarioRestaurante de la sede de prueba, el frontend necesita un token
   * que ya incluya esa sede para que tenantContext la resuelva. `credencial` es el
   * username del usuario autenticado (req.user.usuario).
   */
  async emitirSesion(credencial: string) {
    const user = await usuarioRepository.findByCredencial(credencial);
    if (!user) throw new UnauthorizedError('Usuario no encontrado');

    const payload = buildPayload(user);
    return { user: payload, tokens: buildTokens(payload) };
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
   * getMiNomina — el trabajador consulta SU PROPIO salario e historial.
   *
   * Existe aparte de GET /usuarios/:id/nomina porque esa ruta exige el permiso
   * usuarios.gestionar: un mesero no puede entrar por ahí, pero sí tiene
   * derecho a ver lo suyo. El id sale del token, nunca de la URL, así que no
   * hay forma de pedir la nómina de otra persona.
   */
  async getMiNomina(userId: number) {
    const [nomina, historial] = await Promise.all([
      usuarioRepository.findNomina(userId),
      usuarioRepository.findHistorialSalarios(userId),
    ]);
    return { nomina, historial };
  },

  /**
   * actualizarMiPerfil — autogestión de datos de contacto.
   *
   * Whitelist deliberadamente corta: el trabajador corrige cómo contactarlo,
   * NO su cargo, salario, estado laboral, sede ni fechas del contrato. Esos
   * son datos del vínculo laboral y solo los cambia administración.
   */
  async actualizarMiPerfil(userId: number, data: {
    telefono?:                     string | null;
    direccion?:                    string | null;
    contacto_emergencia_nombre?:   string | null;
    contacto_emergencia_telefono?: string | null;
  }) {
    const existe = await usuarioRepository.findById(userId);
    if (!existe) throw new NotFoundError('Usuario');
    return usuarioRepository.update(userId, data);
  },

  /**
   * marcarTutorial — registra si el usuario completó u omitió el modo tutorial.
   *
   * Es progreso PERSONAL (por usuario), no por sede: por eso vive en Usuario y no
   * en un feature flag con contexto como onboarding_completado. El id sale del
   * token (nunca de la URL), así que nadie puede marcar el tutorial de otro.
   * `tutorial_completado_en` guarda cuándo, para medir activación; se limpia a
   * null si se resetea (completado = false), útil para volver a mostrar el tour.
   */
  async marcarTutorial(userId: number, completado: boolean) {
    const existe = await usuarioRepository.findById(userId);
    if (!existe) throw new NotFoundError('Usuario');

    await usuarioRepository.update(userId, {
      tutorial_completado:    completado,
      tutorial_completado_en: completado ? new Date() : null,
    });
    return { tutorial_completado: completado };
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

  /**
   * verificarEmail — consume el token del enlace y marca el correo como verificado.
   * Invalida la cache del guard requireEmailVerificado para que aplique de inmediato.
   */
  async verificarEmail(token: string) {
    const userId = await tokenAuthService.consumir(token, 'verificacion_email');
    await usuarioRepository.update(userId, {
      email_verificado:    true,
      email_verificado_en: new Date(),
    });
    await cacheDel(`auth:email_verificado:${userId}`);
    return { message: 'Correo verificado correctamente', id_usuario: userId };
  },

  /**
   * reenviarVerificacion — reenvía el enlace de verificación al propio usuario.
   * Idempotente: si ya está verificado, no envía nada. El id sale del token.
   */
  async reenviarVerificacion(userId: number) {
    const user = await usuarioRepository.findById(userId) as { email: string; nombre_completo: string; email_verificado: boolean } | null;
    if (!user) throw new NotFoundError('Usuario');
    if (user.email_verificado) return { message: 'Tu correo ya está verificado', enviado: false };

    const token = await tokenAuthService.emitir(userId, 'verificacion_email');
    await emailService.enviarEmail({
      to:      user.email,
      subject: 'Confirma tu correo',
      html:    plantillaVerificacion(user.nombre_completo, `${config.appUrl}/verificar-email?token=${token}`),
      text:    `Verifica tu correo: ${config.appUrl}/verificar-email?token=${token}`,
    });
    return { message: 'Te enviamos un nuevo enlace de verificación', enviado: true };
  },

  /**
   * solicitarReset — envía el correo de restablecimiento SI el email existe.
   * No revela si el correo está registrado (respuesta idéntica en ambos casos)
   * para no permitir enumeración de cuentas.
   */
  async solicitarReset(email: string) {
    const user = await usuarioRepository.findByEmail(email);
    if (user) {
      const token = await tokenAuthService.emitir(user.id, 'reset_password');
      await emailService.enviarEmail({
        to:      user.email,
        subject: 'Restablece tu contraseña',
        html:    plantillaReset(user.nombre_completo, `${config.appUrl}/restablecer-password?token=${token}`),
        text:    `Restablece tu contraseña: ${config.appUrl}/restablecer-password?token=${token}`,
      });
    }
    return { message: 'Si el correo está registrado, te enviamos las instrucciones para restablecer tu contraseña.' };
  },

  /**
   * confirmarReset — consume el token del correo y cambia la contraseña.
   * (No invalida los JWT ya emitidos: el sistema es stateless; la ventana del
   * access token es de 15m. Ver plan/riesgos para la invalidación total futura.)
   */
  async confirmarReset(token: string, password: string) {
    const userId = await tokenAuthService.consumir(token, 'reset_password');
    const hash = await bcrypt.hash(password, 10);
    await usuarioRepository.update(userId, { password_hash: hash });
    return { message: 'Contraseña actualizada. Ya puedes iniciar sesión.', id_usuario: userId };
  },
};
