/**
 * utils/validators.ts
 *
 * Funciones puras de validación para formularios del frontend.
 * Sin dependencias de React — retornan string con el error o null si es válido.
 *
 * Uso en formularios MUI:
 * <TextField error={!!emailError} helperText={emailError} />
 *
 * Regla: la validación del backend (Zod) es la fuente de verdad.
 * Estas funciones son una capa de UX para feedback inmediato,
 * no reemplazan la validación del servidor.
 */

import { VALIDATION } from './constants';

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Retorna string con el error o null si el campo es válido */
type ValidationResult = string | null;

// ─── Campos individuales ──────────────────────────────────────────────────────

/**
 * Valida que el campo no esté vacío
 * Ej: validateRequired('') → "Este campo es obligatorio"
 *     validateRequired('Juan') → null
 */
export const validateRequired = (
  value: string,
  fieldName = 'Este campo'
): ValidationResult => {
  if (!value || value.trim().length === 0) {
    return `${fieldName} es obligatorio`;
  }
  return null;
};

/**
 * Valida formato de email
 * Ej: validateEmail('no-es-email') → "El email no tiene un formato válido"
 *     validateEmail('user@mail.com') → null
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email) return 'El email es obligatorio';
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) return 'El email no tiene un formato válido';
  return null;
};

/**
 * Valida contraseña — mínimo 8 caracteres (coincide con backend)
 * Ej: validatePassword('1234') → "La contraseña debe tener al menos 8 caracteres"
 *     validatePassword('segura123') → null
 */
export const validatePassword = (password: string): ValidationResult => {
  if (!password) return 'La contraseña es obligatoria';
  if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${VALIDATION.PASSWORD_MIN_LENGTH} caracteres`;
  }
  return null;
};

/**
 * Valida nombre de usuario — sin espacios, mínimo 3 caracteres
 * Ej: validateUsuario('ab') → "El usuario debe tener al menos 3 caracteres"
 *     validateUsuario('juan ospina') → "El usuario no puede contener espacios"
 */
export const validateUsuario = (usuario: string): ValidationResult => {
  if (!usuario) return 'El usuario es obligatorio';
  if (usuario.includes(' ')) return 'El usuario no puede contener espacios';
  if (usuario.length < VALIDATION.USUARIO_MIN_LENGTH) {
    return `El usuario debe tener al menos ${VALIDATION.USUARIO_MIN_LENGTH} caracteres`;
  }
  return null;
};

/**
 * Valida nombre completo — mínimo 2 caracteres, acepta espacios
 */
export const validateNombre = (nombre: string): ValidationResult => {
  if (!nombre || nombre.trim().length === 0) return 'El nombre es obligatorio';
  if (nombre.trim().length < VALIDATION.NOMBRE_MIN_LENGTH) {
    return `El nombre debe tener al menos ${VALIDATION.NOMBRE_MIN_LENGTH} caracteres`;
  }
  return null;
};

/**
 * Valida teléfono — solo números, guiones y espacios (opcional)
 * Retorna null si está vacío (campo no obligatorio)
 */
export const validateTelefono = (telefono: string): ValidationResult => {
  if (!telefono) return null; // opcional
  const regex = /^[0-9\s\-\+\(\)]+$/;
  if (!regex.test(telefono)) return 'El teléfono solo puede contener números';
  if (telefono.length > VALIDATION.TELEFONO_MAX_LENGTH) {
    return `El teléfono no puede tener más de ${VALIDATION.TELEFONO_MAX_LENGTH} caracteres`;
  }
  return null;
};

/**
 * Valida SKU de producto — sin espacios, máx 50 caracteres
 */
export const validateSKU = (sku: string): ValidationResult => {
  if (!sku) return 'El SKU es obligatorio';
  if (sku.includes(' ')) return 'El SKU no puede contener espacios';
  if (sku.length > VALIDATION.SKU_MAX_LENGTH) {
    return `El SKU no puede tener más de ${VALIDATION.SKU_MAX_LENGTH} caracteres`;
  }
  return null;
};

/**
 * Valida número positivo (precio, stock, cantidad)
 * Ej: validatePositiveNumber(-5) → "El valor debe ser mayor a 0"
 *     validatePositiveNumber(0)  → "El valor debe ser mayor a 0"
 */
export const validatePositiveNumber = (
  value: number | string,
  fieldName = 'El valor'
): ValidationResult => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return `${fieldName} debe ser un número válido`;
  if (num <= 0)   return `${fieldName} debe ser mayor a 0`;
  return null;
};

/**
 * Valida número no negativo (stock mínimo puede ser 0)
 */
export const validateNonNegativeNumber = (
  value: number | string,
  fieldName = 'El valor'
): ValidationResult => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return `${fieldName} debe ser un número válido`;
  if (num < 0)    return `${fieldName} no puede ser negativo`;
  return null;
};

// ─── Validadores de formularios completos ────────────────────────────────────

/**
 * Valida el formulario de crear/editar usuario
 * Retorna un objeto con los errores por campo (vacío = sin errores)
 */
export const validateUsuarioForm = (form: {
  nombre_completo: string;
  email:           string;
  usuario:         string;
  password?:       string;
  id_rol:          number;
}): Record<string, string> => {
  const errors: Record<string, string> = {};

  const nombre   = validateNombre(form.nombre_completo);
  const email    = validateEmail(form.email);
  const usuario  = validateUsuario(form.usuario);

  if (nombre)  errors.nombre_completo = nombre;
  if (email)   errors.email           = email;
  if (usuario) errors.usuario         = usuario;

  // Password solo obligatorio al crear
  if (form.password !== undefined) {
    const password = validatePassword(form.password);
    if (password) errors.password = password;
  }

  if (!form.id_rol || form.id_rol === 0) {
    errors.id_rol = 'Debes seleccionar un rol';
  }

  return errors;
};

/**
 * Verifica si un objeto de errores tiene al menos un error
 * Uso: if (hasErrors(validateUsuarioForm(form))) return;
 */
export const hasErrors = (errors: Record<string, string>): boolean =>
  Object.keys(errors).length > 0;
