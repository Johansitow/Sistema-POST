/**
 * DTOs y Validaciones de Órdenes
 *
 * Incluye schemas para:
 * - Nueva arquitectura: createOrdenV2Schema (con sedes[])
 * - Legado: createOrdenSchema (con detalles[])
 * - Pago global: pagarOrdenGlobalSchema
 * - OrdenSede: avanzarSedeSchema, agregarItemSedeSchema, cancelarSedeSchema
 */

import { z } from 'zod';
import { TipoOrden } from '@prisma/client';

// ============================================================================
// SCHEMAS DE VALIDACIÓN
// ============================================================================

const ordenDetalleSchema = z.object({
  id_producto: z.number()
    .int('El ID del producto debe ser un número entero')
    .positive('El ID del producto debe ser positivo'),
  
  cantidad: z.number()
    .positive('La cantidad debe ser un número positivo'),
  
  precio_unitario: z.number()
    .positive('El precio unitario debe ser positivo'),
  
  descuento: z.number()
    .nonnegative('El descuento no puede ser negativo')
    .default(0)
    .optional(),
  
  notas: z.string()
    .max(255, 'Las notas no pueden exceder 255 caracteres')
    .optional(),
});

export const createOrdenSchema = z.object({
  tipo_orden: z.nativeEnum(TipoOrden, {
    errorMap: () => ({ message: 'El tipo de orden debe ser "local" o "domicilio"' }),
  }),
  
  id_estado: z.number()
    .int('El ID del estado debe ser un número entero')
    .positive('El ID del estado debe ser positivo'),
  
  id_usuario: z.number()
    .int('El ID del usuario debe ser un número entero')
    .positive('El ID del usuario debe ser positivo'),

  id_cliente: z.number({ required_error: 'Debes seleccionar o crear un cliente para la orden' })
    .int('El ID del cliente debe ser un número entero')
    .positive('Debes seleccionar o crear un cliente para la orden'),

  id_restaurante: z.number()
    .int()
    .positive()
    .optional(),

  // Campos para domicilio
  direccion_entrega: z.string()
    .max(255, 'La dirección no puede exceder 255 caracteres')
    .optional(),
  
  telefono_contacto: z.string()
    .max(20, 'El teléfono no puede exceder 20 caracteres')
    .optional(),
  
  nombre_contacto: z.string()
    .max(100, 'El nombre de contacto no puede exceder 100 caracteres')
    .optional(),
  
  notas_entrega: z.string()
    .max(1000, 'Las notas de entrega no pueden exceder 1000 caracteres')
    .optional(),
  
  costo_domicilio: z.number()
    .nonnegative('El costo de domicilio no puede ser negativo')
    .optional(),
  
  plataforma_delivery: z.string()
    .max(50, 'El nombre de la plataforma no puede exceder 50 caracteres')
    .optional(),
  
  // Totales
  descuento: z.number()
    .nonnegative('El descuento no puede ser negativo')
    .default(0)
    .optional(),
  
  propina: z.number()
    .nonnegative('La propina no puede ser negativa')
    .default(0)
    .optional(),
  
  observaciones: z.string()
    .max(1000, 'Las observaciones no pueden exceder 1000 caracteres')
    .optional(),
  
  // Detalles de la orden
  detalles: z.array(ordenDetalleSchema)
    .min(1, 'Debe incluir al menos un producto en la orden'),
});

export const updateOrdenSchema = z.object({
  id_estado: z.number().int().positive().optional(),
  direccion_entrega: z.string().max(255).optional(),
  telefono_contacto: z.string().max(20).optional(),
  nombre_contacto: z.string().max(100).optional(),
  notas_entrega: z.string().max(1000).optional(),
  costo_domicilio: z.number().nonnegative().optional(),
  plataforma_delivery: z.string().max(50).optional(),
  descuento: z.number().nonnegative().optional(),
  propina: z.number().nonnegative().optional(),
  observaciones: z.string().max(1000).optional(),
});

export const updateEstadoSchema = z.object({
  id_estado: z.number()
    .int('El ID del estado debe ser un número entero')
    .positive('El ID del estado debe ser positivo'),

  motivo: z.string()
    .max(1000, 'El motivo no puede exceder 1000 caracteres')
    .optional(),

  pagos: z.array(z.object({
    id_metodo_pago: z.number().int().positive(),
    monto:          z.number().positive(),
    referencia:     z.string().max(100).optional(),
    notas:          z.string().max(1000).optional(),
  })).optional(),
});

export const addDetalleSchema = z.object({
  id_producto: z.number()
    .int('El ID del producto debe ser un número entero')
    .positive('El ID del producto debe ser positivo'),
  
  cantidad: z.number()
    .positive('La cantidad debe ser un número positivo'),
  
  precio_unitario: z.number()
    .positive('El precio unitario debe ser positivo'),
  
  descuento: z.number()
    .nonnegative('El descuento no puede ser negativo')
    .default(0)
    .optional(),
  
  notas: z.string()
    .max(255, 'Las notas no pueden exceder 255 caracteres')
    .optional(),
});

export const updateDetalleSchema = z.object({
  cantidad: z.number()
    .positive('La cantidad debe ser un número positivo')
    .optional(),
  
  precio_unitario: z.number()
    .positive('El precio unitario debe ser positivo')
    .optional(),
  
  descuento: z.number()
    .nonnegative('El descuento no puede ser negativo')
    .optional(),
  
  notas: z.string()
    .max(255, 'Las notas no pueden exceder 255 caracteres')
    .optional(),
});

export const pagarOrdenSchema = z.object({
  id_metodo_pago: z.number()
    .int('El ID del método de pago debe ser un número entero')
    .positive('El ID del método de pago debe ser positivo'),
  
  monto: z.number()
    .positive('El monto debe ser un número positivo'),
  
  referencia: z.string()
    .max(100, 'La referencia no puede exceder 100 caracteres')
    .optional(),
  
  notas: z.string()
    .max(1000, 'Las notas no pueden exceder 1000 caracteres')
    .optional(),
});

// ============================================================================
// TYPES (inferidos de los schemas)
// ============================================================================

export type CreateOrdenDTO = z.infer<typeof createOrdenSchema>;
export type UpdateOrdenDTO = z.infer<typeof updateOrdenSchema>;
export type UpdateEstadoDTO = z.infer<typeof updateEstadoSchema>;
export type AddDetalleDTO = z.infer<typeof addDetalleSchema>;
export type UpdateDetalleDTO = z.infer<typeof updateDetalleSchema>;
export type PagarOrdenDTO = z.infer<typeof pagarOrdenSchema>;

// ============================================================================
// NUEVA ARQUITECTURA — schemas con sedes
// ============================================================================

const sedeItemSchema = z.object({
  id_producto:     z.number().int().positive(),
  id_variante:     z.number().int().positive().optional(),
  cantidad:        z.number().positive(),
  precio_unitario: z.number().positive(),
  descuento:       z.number().nonnegative().default(0).optional(),
  notas:           z.string().max(500).optional(),
});

const sedeSchema = z.object({
  id_restaurante: z.number().int().positive(),
  items: z.array(sedeItemSchema).min(1, 'Cada sede debe tener al menos un producto'),
});

/** Schema principal para nueva arquitectura: una sola llamada crea Orden + N sedes */
export const createOrdenV2Schema = z.object({
  id_grupo:    z.number().int().positive(),
  tipo_orden:  z.nativeEnum(TipoOrden),
  id_cliente:  z.number({ required_error: 'Debes seleccionar o crear un cliente para la orden' })
    .int().positive('Debes seleccionar o crear un cliente para la orden'),

  // Delivery
  direccion_entrega:   z.string().max(300).optional(),
  telefono_contacto:   z.string().max(20).optional(),
  nombre_contacto:     z.string().max(200).optional(),
  notas_entrega:       z.string().max(1000).optional(),
  costo_domicilio:     z.number().nonnegative().optional(),
  plataforma_delivery: z.string().max(50).optional(),
  propina:             z.number().nonnegative().default(0).optional(),
  descuento:           z.number().nonnegative().default(0).optional(),
  observaciones:       z.string().max(1000).optional(),

  sedes: z.array(sedeSchema).min(1, 'Debe haber al menos una sede'),
});

/** Pago global de la Orden — multi-método */
export const pagarOrdenGlobalSchema = z.object({
  pagos: z.array(z.object({
    id_metodo_pago: z.number().int().positive(),
    monto:          z.number().positive(),
    referencia:     z.string().max(100).optional(),
    notas:          z.string().max(300).optional(),
  })).min(1, 'Se requiere al menos un método de pago'),
});

/** Cancelar orden con motivo */
export const cancelarOrdenSchema = z.object({
  motivo: z.string().max(300).optional(),
});

/** Avanzar estado de OrdenSede (sin body — el siguiente estado es automático) */
export const avanzarSedeSchema = z.object({}).optional();

/** Agregar ítem a OrdenSede */
export const agregarItemSedeSchema = z.object({
  id_producto:     z.number().int().positive(),
  id_variante:     z.number().int().positive().optional(),
  cantidad:        z.number().positive(),
  precio_unitario: z.number().positive(),
  descuento:       z.number().nonnegative().default(0).optional(),
  notas:           z.string().max(500).optional(),
});

/** Actualizar ítem de OrdenSede */
export const actualizarItemSedeSchema = z.object({
  cantidad: z.number().positive().optional(),
  notas:    z.string().max(500).optional(),
});

/** Cancelar OrdenSede */
export const cancelarSedeSchema = z.object({
  motivo: z.string().max(300).min(1, 'El motivo es obligatorio'),
});

export type CreateOrdenV2DTO         = z.infer<typeof createOrdenV2Schema>;
export type PagarOrdenGlobalDTO      = z.infer<typeof pagarOrdenGlobalSchema>;
export type CancelarOrdenDTO         = z.infer<typeof cancelarOrdenSchema>;
export type AgregarItemSedeDTO       = z.infer<typeof agregarItemSedeSchema>;
export type ActualizarItemSedeDTO    = z.infer<typeof actualizarItemSedeSchema>;
export type CancelarSedeDTO          = z.infer<typeof cancelarSedeSchema>;
