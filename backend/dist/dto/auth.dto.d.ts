/**
 * AuthDTO - Validación de forma para autenticación
 */
import { z } from 'zod';
export declare const loginSchema: z.ZodObject<{
    usuario: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    usuario: string;
    password: string;
}, {
    usuario: string;
    password: string;
}>;
export declare const refreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export declare const changePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
}>;
export type LoginDTO = z.infer<typeof loginSchema>;
export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;
//# sourceMappingURL=auth.dto.d.ts.map