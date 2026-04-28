/**
 * UsuariosDTO - Validación de forma para datos de usuarios
 */

import { z } from 'zod';

// ── Campos de empleado compartidos entre create y update ──────────────────────
const empleadoFields = {
  documento_identidad:          z.string().max(20).optional(),
  fecha_nacimiento:              z.string().optional(),   // ISO string
  direccion:                     z.string().max(300).optional(),
  cargo:                         z.string().max(100).optional(),
  fecha_ingreso:                 z.string().optional(),
  turno:                         z.enum(['mañana', 'tarde', 'noche', 'mixto']).optional(),
  tipo_contrato:                 z.enum(['fijo', 'parcial', 'temporal']).optional(),
  contacto_emergencia_nombre:    z.string().max(200).optional(),
  contacto_emergencia_telefono:  z.string().max(20).optional(),
  notas:                         z.string().optional(),
};

export const createUsuarioSchema = z.object({
  nombre_completo: z.string().min(3, 'Mínimo 3 caracteres'),
  email:           z.string().email('Email inválido'),
  usuario:         z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guión bajo'),
  password:        z.string().min(8, 'Mínimo 8 caracteres'),
  telefono:        z.string().optional(),
  id_rol:          z.number().int().positive('Rol inválido'),
  ...empleadoFields,
});

export const updateUsuarioSchema = z.object({
  nombre_completo: z.string().min(3).optional(),
  email:           z.string().email().optional(),
  telefono:        z.string().optional(),
  id_rol:          z.number().int().positive().optional(),
  ...empleadoFields,
});

export const nominaSchema = z.object({
  salario_base:   z.number().min(0, 'El salario no puede ser negativo'),
  tipo_pago:      z.enum(['mensual', 'quincenal', 'semanal']),
  banco:          z.string().max(100).optional(),
  tipo_cuenta:    z.enum(['ahorros', 'corriente']).optional(),
  numero_cuenta:  z.string().max(30).optional(),
  observaciones:  z.string().optional(),
});

export const cambiarEstadoSchema = z.object({
  estado: z.enum(['activo', 'inactivo'], {
    errorMap: () => ({ message: 'Estado debe ser "activo" o "inactivo"' }),
  }),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
});

export const asignarRolSchema = z.object({
  id_rol: z.number().int().positive('Rol inválido'),
});

export type CreateUsuarioDTO   = z.infer<typeof createUsuarioSchema>;
export type UpdateUsuarioDTO   = z.infer<typeof updateUsuarioSchema>;
export type NominaDTO          = z.infer<typeof nominaSchema>;
export type CambiarEstadoDTO   = z.infer<typeof cambiarEstadoSchema>;
export type ResetPasswordDTO   = z.infer<typeof resetPasswordSchema>;
export type AsignarRolDTO      = z.infer<typeof asignarRolSchema>;