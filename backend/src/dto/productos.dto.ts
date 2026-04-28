/**
 * DTOs y Validaciones de Productos
 * Adaptado al schema real de Prisma
 */

import { z } from 'zod';
import { TipoMateria, UnidadMedida, EstadoGeneral } from '@prisma/client';

// ============================================================================
// SCHEMAS DE VALIDACIÓN
// ============================================================================

export const createProductoSchema = z.object({
  codigo_barras: z.string()
    .max(50, 'El código de barras no puede exceder 50 caracteres')
    .optional(),
  
  sku: z.string()
    .min(1, 'El SKU es obligatorio')
    .max(50, 'El SKU no puede exceder 50 caracteres')
    .regex(/^[A-Z0-9-]+$/, 'El SKU solo puede contener letras mayúsculas, números y guiones'),
  
  nombre: z.string()
    .min(1, 'El nombre es obligatorio')
    .max(150, 'El nombre no puede exceder 150 caracteres'),
  
  descripcion: z.string()
    .max(1000, 'La descripción no puede exceder 1000 caracteres')
    .optional(),
  
  id_categoria: z.number()
    .int('La categoría debe ser un número entero')
    .positive('La categoría debe ser un número positivo')
    .optional(),
  
  tipo_materia: z.nativeEnum(TipoMateria, {
    errorMap: () => ({ message: 'El tipo de materia debe ser "prima" o "procesada"' }),
  }),
  
  unidad_medida: z.nativeEnum(UnidadMedida, {
    errorMap: () => ({ 
      message: 'La unidad de medida debe ser: unidad, gramo, kilogramo, litro, mililitro o porcion' 
    }),
  }),
  
  precio_unitario: z.number()
    .nonnegative('El precio unitario no puede ser negativo')
    .max(999999999.99, 'El precio unitario es demasiado alto'),
  
  precio_venta: z.number()
    .nonnegative('El precio de venta no puede ser negativo')
    .max(999999999.99, 'El precio de venta es demasiado alto')
    .optional(),
  
  stock_actual: z.number()
    .nonnegative('El stock actual no puede ser negativo')
    .default(0)
    .optional(),
  
  stock_minimo: z.number()
    .nonnegative('El stock mínimo no puede ser negativo')
    .default(0)
    .optional(),
  
  stock_maximo: z.number()
    .nonnegative('El stock máximo no puede ser negativo')
    .optional(),
  
  punto_reorden: z.number()
    .nonnegative('El punto de reorden no puede ser negativo')
    .optional(),
  
  dias_vida_util: z.number()
    .int('Los días de vida útil deben ser un número entero')
    .positive('Los días de vida útil deben ser positivos')
    .optional(),
  
  requiere_refrigeracion: z.boolean()
    .default(false)
    .optional(),
  
  imagen_url: z.string()
    .url('La URL de la imagen no es válida')
    .max(255, 'La URL de la imagen no puede exceder 255 caracteres')
    .optional(),
  
  es_vendible: z.boolean()
    .default(false)
    .optional(),
  
  estado: z.nativeEnum(EstadoGeneral)
    .default(EstadoGeneral.activo)
    .optional(),
});

export const updateProductoSchema = z.object({
  codigo_barras: z.string().max(50).optional(),
  sku: z.string().min(1).max(50).regex(/^[A-Z0-9-]+$/).optional(),
  nombre: z.string().min(1).max(150).optional(),
  descripcion: z.string().max(1000).optional(),
  id_categoria: z.number().int().positive().optional(),
  tipo_materia: z.nativeEnum(TipoMateria).optional(),
  unidad_medida: z.nativeEnum(UnidadMedida).optional(),
  precio_unitario: z.number().nonnegative().optional(),
  precio_venta: z.number().nonnegative().optional(),
  stock_actual: z.number().nonnegative().optional(),
  stock_minimo: z.number().nonnegative().optional(),
  stock_maximo: z.number().nonnegative().optional(),
  punto_reorden: z.number().nonnegative().optional(),
  dias_vida_util: z.number().int().positive().optional(),
  requiere_refrigeracion: z.boolean().optional(),
  imagen_url: z.string().url().max(255).optional(),
  es_vendible: z.boolean().optional(),
  estado: z.nativeEnum(EstadoGeneral).optional(),
});

export const updateStockSchema = z.object({
  cantidad: z.number()
    .positive('La cantidad debe ser un número positivo'),
  
  tipo: z.enum(['entrada', 'salida'], {
    errorMap: () => ({ message: 'El tipo debe ser "entrada" o "salida"' }),
  }),
  
  motivo: z.string()
    .min(1, 'El motivo es obligatorio')
    .max(255, 'El motivo no puede exceder 255 caracteres')
    .optional(),
});

// ============================================================================
// TYPES (inferidos de los schemas)
// ============================================================================

export type CreateProductoDTO = z.infer<typeof createProductoSchema>;
export type UpdateProductoDTO = z.infer<typeof updateProductoSchema>;
export type UpdateStockDTO = z.infer<typeof updateStockSchema>;
