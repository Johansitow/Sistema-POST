"use strict";
/**
 * AuthDTO - Validación de forma para autenticación
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordSchema = exports.refreshTokenSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    usuario: zod_1.z.string().min(1, 'Usuario requerido'),
    password: zod_1.z.string().min(1, 'Contraseña requerida'),
});
exports.refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token requerido'),
});
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Contraseña actual requerida'),
    newPassword: zod_1.z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
});
//# sourceMappingURL=auth.dto.js.map