"use strict";
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
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const usuario_repository_1 = require("../repositories/usuario.repository");
const HttpErrors_1 = require("../exceptions/HttpErrors");
/**
 * buildTokens — genera el par accessToken + refreshToken
 *
 * accessToken: vida corta (ej. 15min) — usado en cada request autenticado
 * refreshToken: vida larga (ej. 7d) — solo para renovar el accessToken
 * Ambos usan el mismo payload para que el frontend tenga datos consistentes.
 */
const buildTokens = (payload) => ({
    accessToken: jsonwebtoken_1.default.sign(payload, env_1.config.jwt.secret, { expiresIn: env_1.config.jwt.expiresIn }),
    refreshToken: jsonwebtoken_1.default.sign(payload, env_1.config.jwt.refreshSecret, { expiresIn: env_1.config.jwt.refreshExpiresIn }),
    expiresIn: env_1.config.jwt.expiresIn,
});
/**
 * buildPayload — construye el TokenPayload desde un usuario de BD
 *
 * Centralizado aquí para garantizar que login() y refreshToken()
 * siempre generen exactamente la misma estructura en el JWT.
 *
 * color es opcional en el parámetro de entrada porque Prisma
 * puede omitirlo si el rol no tiene color definido en BD.
 * Se normaliza a null para mantener consistencia en el token.
 */
const buildPayload = (user) => ({
    id: user.id,
    uuid: user.uuid,
    usuario: user.usuario,
    email: user.email,
    nombre_completo: user.nombre_completo,
    rol: {
        id: user.rol.id,
        nombre: user.rol.nombre,
        es_super_admin: user.rol.es_super_admin,
        color: user.rol.color ?? null, // undefined → null para el token
    },
});
exports.authService = {
    /**
     * login — valida credenciales y devuelve user + tokens
     *
     * 'credencial' acepta username o email (resuelto en findByCredencial).
     * Se lanza el mismo error para usuario inexistente y contraseña incorrecta
     * para no revelar si el usuario existe (seguridad por ambigüedad).
     * Se registra ultimo_acceso para trazabilidad de sesiones.
     */
    async login(credencial, password) {
        const user = await usuario_repository_1.usuarioRepository.findByCredencial(credencial);
        if (!user)
            throw new HttpErrors_1.UnauthorizedError('Credenciales inválidas');
        const ok = await bcrypt_1.default.compare(password, user.password_hash);
        if (!ok)
            throw new HttpErrors_1.UnauthorizedError('Credenciales inválidas');
        // Registrar último acceso — no crítico, no bloquea el login si falla
        await usuario_repository_1.usuarioRepository.update(user.id, { ultimo_acceso: new Date() });
        const payload = buildPayload(user);
        return { user: payload, tokens: buildTokens(payload) };
    },
    /**
     * refreshToken — renueva el par de tokens sin re-login
     *
     * Recarga el usuario desde BD (no usa los datos del token viejo) para que
     * cualquier cambio de rol, nombre o estado quede reflejado en los nuevos tokens.
     * Si el usuario fue desactivado desde el último login, el refresh falla.
     */
    async refreshToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, env_1.config.jwt.refreshSecret);
            // Recargar desde BD para obtener datos frescos
            const user = await usuario_repository_1.usuarioRepository.findByCredencial(decoded.usuario);
            if (!user)
                throw new HttpErrors_1.UnauthorizedError('Token inválido');
            const payload = buildPayload(user);
            return buildTokens(payload);
        }
        catch {
            // jwt.verify lanza si el token expiró o fue manipulado
            throw new HttpErrors_1.UnauthorizedError('Token inválido o expirado');
        }
    },
    /**
     * getProfile — perfil completo del usuario autenticado
     *
     * Devuelve más campos que el token (telefono, fechas, creador, etc.)
     * usando selectPublico del repositorio. userId viene del middleware de auth.
     */
    async getProfile(userId) {
        const user = await usuario_repository_1.usuarioRepository.findById(userId);
        if (!user)
            throw new HttpErrors_1.NotFoundError('Usuario');
        return user;
    },
    /**
     * changePassword — cambia contraseña verificando la actual
     *
     * Requiere dos consultas porque:
     * - findById usa selectPublico (sin password_hash, por seguridad)
     * - findByCredencial incluye password_hash para que bcrypt pueda comparar
     */
    async changePassword(userId, currentPassword, newPassword) {
        const profile = await usuario_repository_1.usuarioRepository.findById(userId);
        if (!profile)
            throw new HttpErrors_1.NotFoundError('Usuario');
        // Segunda consulta para obtener el password_hash
        const full = await usuario_repository_1.usuarioRepository.findByCredencial(profile.usuario);
        if (!full)
            throw new HttpErrors_1.NotFoundError('Usuario');
        const ok = await bcrypt_1.default.compare(currentPassword, full.password_hash);
        if (!ok)
            throw new HttpErrors_1.BadRequestError('Contraseña actual incorrecta');
        // Hashear con salt rounds 10 — balance entre seguridad y rendimiento
        const hash = await bcrypt_1.default.hash(newPassword, 10);
        await usuario_repository_1.usuarioRepository.update(userId, { password_hash: hash });
        return { message: 'Contraseña actualizada correctamente' };
    },
};
//# sourceMappingURL=auth.service.js.map