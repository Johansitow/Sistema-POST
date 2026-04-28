/**
 * UsuariosDTO - Validación de forma para datos de usuarios
 */
import { z } from 'zod';
export declare const createUsuarioSchema: z.ZodObject<{
    nombre_completo: z.ZodString;
    email: z.ZodString;
    usuario: z.ZodString;
    password: z.ZodString;
    telefono: z.ZodOptional<z.ZodString>;
    id_rol: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    usuario: string;
    nombre_completo: string;
    email: string;
    id_rol: number;
    password: string;
    telefono?: string | undefined;
}, {
    usuario: string;
    nombre_completo: string;
    email: string;
    id_rol: number;
    password: string;
    telefono?: string | undefined;
}>;
export declare const updateUsuarioSchema: z.ZodObject<{
    nombre_completo: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    telefono: z.ZodOptional<z.ZodString>;
    id_rol: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    nombre_completo?: string | undefined;
    email?: string | undefined;
    telefono?: string | undefined;
    id_rol?: number | undefined;
}, {
    nombre_completo?: string | undefined;
    email?: string | undefined;
    telefono?: string | undefined;
    id_rol?: number | undefined;
}>;
export declare const cambiarEstadoSchema: z.ZodObject<{
    estado: z.ZodEnum<["activo", "inactivo"]>;
}, "strip", z.ZodTypeAny, {
    estado: "activo" | "inactivo";
}, {
    estado: "activo" | "inactivo";
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    newPassword: string;
}, {
    newPassword: string;
}>;
export declare const asignarRolSchema: z.ZodObject<{
    id_rol: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id_rol: number;
}, {
    id_rol: number;
}>;
export type CreateUsuarioDTO = z.infer<typeof createUsuarioSchema>;
export type UpdateUsuarioDTO = z.infer<typeof updateUsuarioSchema>;
export type CambiarEstadoDTO = z.infer<typeof cambiarEstadoSchema>;
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>;
export type AsignarRolDTO = z.infer<typeof asignarRolSchema>;
//# sourceMappingURL=usuarios.dto.d.ts.map