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

/**
 * registroSchema — alta self-serve de un negocio nuevo desde la web pública.
 * `acepta_habeas_data` DEBE ser true (literal): sin consentimiento no hay alta,
 * porque es la base legal para el tratamiento de datos (Ley 1581).
 */
export const registroSchema = z.object({
  nombre_negocio:  z.string().min(2, 'El nombre del negocio es requerido').max(200),
  nombre_completo: z.string().min(2, 'Tu nombre es requerido').max(200),
  email:           z.string().email('Correo inválido').max(150),
  usuario:         z.string()
                    .min(3, 'El usuario debe tener al menos 3 caracteres').max(50)
                    .regex(/^[a-zA-Z0-9._-]+$/, 'Solo letras, números, punto, guion y guion bajo'),
  password:        z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(100),
  acepta_habeas_data: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar el tratamiento de datos para continuar' }),
  }),
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

/**
 * miTutorialSchema — el usuario marca su progreso del modo tutorial.
 * completado=true al finalizarlo u omitirlo; false para volver a mostrarlo.
 */
export const miTutorialSchema = z.object({
  completado: z.boolean(),
});

export type LoginDTO          = z.infer<typeof loginSchema>;
export type RegistroDTO       = z.infer<typeof registroSchema>;
export type MiTutorialDTO     = z.infer<typeof miTutorialSchema>;
export type MiPerfilDTO       = z.infer<typeof miPerfilSchema>;
export type RefreshTokenDTO   = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;
