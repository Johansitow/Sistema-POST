/**
 * AuthDTO - Validación de forma para autenticación
 */

import { z } from 'zod';

export const loginSchema = z.object({
  usuario:  z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword:     z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
});

/**
 * miPerfilSchema — autogestión del trabajador sobre SUS datos de contacto.
 *
 * La lista es corta a propósito: el trabajador corrige cómo contactarlo, no su
 * cargo, salario, estado laboral, sede ni fechas de contrato. Cualquier campo
 * fuera de esta whitelist se ignora (Zod hace strip por defecto), así que
 * enviar { cargo: 'Gerente' } no escala privilegios.
 */
export const miPerfilSchema = z.object({
  telefono:                     z.string().max(20).nullable().optional(),
  direccion:                    z.string().max(300).nullable().optional(),
  contacto_emergencia_nombre:   z.string().max(200).nullable().optional(),
  contacto_emergencia_telefono: z.string().max(20).nullable().optional(),
}).transform(d => {
  // '' significa "borrar el dato", no "dejarlo como estaba"
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(d)) {
    if (v !== undefined) out[k] = v === '' ? null : v;
  }
  return out;
});

export type LoginDTO          = z.infer<typeof loginSchema>;
export type MiPerfilDTO       = z.infer<typeof miPerfilSchema>;
export type RefreshTokenDTO   = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;
