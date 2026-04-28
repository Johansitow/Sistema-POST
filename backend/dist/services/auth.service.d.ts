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
/**
 * Estructura del payload codificado en el JWT.
 * Debe coincidir con la interfaz UsuarioAuth del frontend (types/index.ts).
 * No incluir datos sensibles aquí — el JWT es decodificable sin la clave.
 */
export interface TokenPayload {
    id: number;
    uuid: string;
    usuario: string;
    email: string;
    nombre_completo: string;
    rol: {
        id: number;
        nombre: string;
        es_super_admin: boolean;
        color: string | null;
    };
}
export declare const authService: {
    /**
     * login — valida credenciales y devuelve user + tokens
     *
     * 'credencial' acepta username o email (resuelto en findByCredencial).
     * Se lanza el mismo error para usuario inexistente y contraseña incorrecta
     * para no revelar si el usuario existe (seguridad por ambigüedad).
     * Se registra ultimo_acceso para trazabilidad de sesiones.
     */
    login(credencial: string, password: string): Promise<{
        user: TokenPayload;
        tokens: {
            accessToken: string;
            refreshToken: string;
            expiresIn: string;
        };
    }>;
    /**
     * refreshToken — renueva el par de tokens sin re-login
     *
     * Recarga el usuario desde BD (no usa los datos del token viejo) para que
     * cualquier cambio de rol, nombre o estado quede reflejado en los nuevos tokens.
     * Si el usuario fue desactivado desde el último login, el refresh falla.
     */
    refreshToken(token: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: string;
    }>;
    /**
     * getProfile — perfil completo del usuario autenticado
     *
     * Devuelve más campos que el token (telefono, fechas, creador, etc.)
     * usando selectPublico del repositorio. userId viene del middleware de auth.
     */
    getProfile(userId: number): Promise<{
        rol: {
            id: number;
            nombre: string;
            descripcion: string | null;
            es_super_admin: boolean;
            color: string | null;
        };
        usuario: string;
        id: number;
        uuid: string;
        nombre_completo: string;
        email: string;
        telefono: string | null;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        ultimo_acceso: Date | null;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        creador: {
            usuario: string;
            id: number;
            nombre_completo: string;
        } | null;
    }>;
    /**
     * changePassword — cambia contraseña verificando la actual
     *
     * Requiere dos consultas porque:
     * - findById usa selectPublico (sin password_hash, por seguridad)
     * - findByCredencial incluye password_hash para que bcrypt pueda comparar
     */
    changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{
        message: string;
    }>;
};
//# sourceMappingURL=auth.service.d.ts.map