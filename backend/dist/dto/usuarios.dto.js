"use strict";
/**
 * UsuariosDTO - Validación de forma para datos de usuarios
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.asignarRolSchema = exports.resetPasswordSchema = exports.cambiarEstadoSchema = exports.updateUsuarioSchema = exports.createUsuarioSchema = void 0;
const zod_1 = require("zod");
exports.createUsuarioSchema = zod_1.z.object({
    nombre_completo: zod_1.z.string().min(3, 'Mínimo 3 caracteres'),
    email: zod_1.z.string().email('Email inválido'),
    usuario: zod_1.z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guión bajo'),
    password: zod_1.z.string().min(8, 'Mínimo 8 caracteres'),
    telefono: zod_1.z.string().optional(),
    id_rol: zod_1.z.number().int().positive('Rol inválido'),
});
exports.updateUsuarioSchema = zod_1.z.object({
    nombre_completo: zod_1.z.string().min(3).optional(),
    email: zod_1.z.string().email().optional(),
    telefono: zod_1.z.string().optional(),
    id_rol: zod_1.z.number().int().positive().optional(),
});
exports.cambiarEstadoSchema = zod_1.z.object({
    estado: zod_1.z.enum(['activo', 'inactivo'], {
        errorMap: () => ({ message: 'Estado debe ser "activo" o "inactivo"' }),
    }),
});
exports.resetPasswordSchema = zod_1.z.object({
    newPassword: zod_1.z.string().min(8, 'Mínimo 8 caracteres'),
});
exports.asignarRolSchema = zod_1.z.object({
    id_rol: zod_1.z.number().int().positive('Rol inválido'),
});
//# sourceMappingURL=usuarios.dto.js.map