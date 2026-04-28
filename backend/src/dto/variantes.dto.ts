/**
 * VariantesDTO - Validación de variantes de productos
 */

import { z } from 'zod';
import { EstadoGeneral } from '@prisma/client';

export const createVarianteSchema = z.object({
  nombre:     z.string().min(1, 'El nombre es obligatorio').max(100),
  precio:     z.number().positive('El precio debe ser mayor a 0'),
  sku:        z.string().max(50).optional(),
  atributos:  z.record(z.unknown()).optional(),
  orden:      z.number().int().default(0).optional(),
  estado:     z.nativeEnum(EstadoGeneral).default(EstadoGeneral.activo).optional(),
});

export const updateVarianteSchema = createVarianteSchema.partial();

export const reorderVariantesSchema = z.object({
  items: z.array(z.object({
    id:    z.number().int().positive(),
    orden: z.number().int().min(0),
  })).min(1),
});

export type CreateVarianteDTO = z.infer<typeof createVarianteSchema>;
export type UpdateVarianteDTO = z.infer<typeof updateVarianteSchema>;
export type ReorderVariantesDTO = z.infer<typeof reorderVariantesSchema>;
