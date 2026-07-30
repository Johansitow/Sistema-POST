/**
 * UsuariosDTO - Validación de forma para datos de usuarios
 */

import { z } from 'zod';

// ── Dominios del empleado ─────────────────────────────────────────────────────
// tipo_contrato y jornada son conceptos distintos: "medio tiempo" no es un tipo
// de contrato sino una jornada. Los valores siguen la legislación laboral
// colombiana.

export const TIPOS_CONTRATO = ['indefinido', 'fijo', 'obra_labor', 'aprendizaje'] as const;
export const JORNADAS       = ['completa', 'parcial', 'por_horas'] as const;
export const TURNOS         = ['mañana', 'tarde', 'noche', 'mixto'] as const;
export const NIVELES_RIESGO_ARL = ['I', 'II', 'III', 'IV', 'V'] as const;
export const ESTADOS_LABORALES = [
  'activo', 'periodo_prueba', 'vacaciones', 'incapacidad', 'licencia', 'suspendido', 'retirado',
] as const;

/**
 * Campo de texto opcional que además admite '' y null para LIMPIAR el valor.
 * Sin esto, borrar un dato desde el formulario era imposible: el string vacío
 * se descartaba y el campo conservaba el valor viejo.
 */
const textoOpcional = (max: number) =>
  z.string().max(max).nullable().optional().transform(v => (v === '' ? null : v));

const fechaOpcional = z.string().nullable().optional().transform(v => (v === '' ? null : v));

// ── Campos de empleado compartidos entre create y update ──────────────────────
const empleadoFields = {
  // Personales
  tipo_documento:                z.enum(['cc', 'ce', 'nit', 'pasaporte', 'sin_documento']).nullable().optional(),
  documento_identidad:           textoOpcional(20),
  fecha_nacimiento:              fechaOpcional,   // ISO string
  direccion:                     textoOpcional(300),
  foto_url:                      textoOpcional(500),
  // Laborales
  cargo:                         textoOpcional(100),
  fecha_ingreso:                 fechaOpcional,
  turno:                         z.enum(TURNOS).nullable().optional(),
  tipo_contrato:                 z.enum(TIPOS_CONTRATO).nullable().optional(),
  jornada:                       z.enum(JORNADAS).nullable().optional(),
  estado_laboral:                z.enum(ESTADOS_LABORALES).optional(),
  fecha_retiro:                  fechaOpcional,
  motivo_retiro:                 textoOpcional(300),
  id_restaurante_base:           z.number().int().positive().nullable().optional(),
  id_jefe_directo:               z.number().int().positive().nullable().optional(),
  // Seguridad social
  eps:                           textoOpcional(100),
  afp:                           textoOpcional(100),
  arl:                           textoOpcional(100),
  nivel_riesgo_arl:              z.enum(NIVELES_RIESGO_ARL).nullable().optional(),
  fondo_cesantias:               textoOpcional(100),
  caja_compensacion:             textoOpcional(100),
  // Contacto de emergencia
  contacto_emergencia_nombre:    textoOpcional(200),
  contacto_emergencia_telefono:  textoOpcional(20),
  // Notas internas
  notas:                         z.string().nullable().optional(),
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
  // Metadatos del cambio — alimentan HistorialSalario, no NominaEmpleado
  vigencia_desde: z.string().optional(),
  motivo:         z.string().max(300).optional(),
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