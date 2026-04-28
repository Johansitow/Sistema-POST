/**
 * CategoriasDTO - Validación de forma para categorías
 */

import { z } from 'zod';
import { EstadoGeneral } from '@prisma/client';

export const createCategoriaSchema = z.object({
  nombre:          z.string().min(1, 'El nombre es obligatorio').max(100),
  descripcion:     z.string().max(1000).optional(),
  categoria_padre: z.number().int().positive().optional(),
  imagen_url:      z.string().url('URL inválida').max(255).optional().or(z.literal('')),
  estado:          z.nativeEnum(EstadoGeneral).default(EstadoGeneral.activo).optional(),
  orden:           z.number().int().default(0).optional(),
  icono:           z.string().max(50).optional(),   // emoji o nombre de icono
  color:           z.string().max(20).optional(),   // color hex, ej: #e53935
});

export const updateCategoriaSchema = createCategoriaSchema.partial();

export type CreateCategoriaDTO = z.infer<typeof createCategoriaSchema>;
export type UpdateCategoriaDTO = z.infer<typeof updateCategoriaSchema>;
