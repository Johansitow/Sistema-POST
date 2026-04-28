import { z } from 'zod';
import { UnidadMedida, EstadoGeneral, TipoFormulaIngrediente } from '@prisma/client';

// ─── Ingrediente ─────────────────────────────────────────────────────────────

export const ingredienteSchema = z.object({
  id_producto:         z.number().int().positive('ID de producto inválido'),
  cantidad:            z.number().positive('La cantidad debe ser positiva'),
  unidad:              z.nativeEnum(UnidadMedida),
  es_opcional:         z.boolean().default(false),
  notas:               z.string().max(255).optional(),
  orden:               z.number().int().min(0).default(0),
  numero_fase:         z.number().int().positive().optional(),
  tipo_formula:        z.nativeEnum(TipoFormulaIngrediente).optional(),
  factor_formula:      z.number().positive().optional(),
  id_ingrediente_base: z.number().int().positive().optional(),
  formula_descripcion: z.string().max(500).optional(),
});

export type IngredienteDTO = z.infer<typeof ingredienteSchema>;

// ─── Fase ────────────────────────────────────────────────────────────────────

export const recetaFaseSchema = z.object({
  numero_fase:                z.number().int().positive(),
  nombre:                     z.string().min(1).max(150),
  descripcion:                z.string().min(1, 'La descripción de la fase es obligatoria'),
  duracion_minutos:           z.number().int().positive().optional(),
  merma_esperada_porcentaje:  z.number().min(0).max(100).optional(),
  estado:                     z.nativeEnum(EstadoGeneral).default('activo'),
});

export type RecetaFaseDTO = z.infer<typeof recetaFaseSchema>;

// ─── Receta ───────────────────────────────────────────────────────────────────

export const createRecetaSchema = z.object({
  id_producto_final:              z.number().int().positive('ID de producto final inválido'),
  nombre_receta:                  z.string().min(1).max(150),
  descripcion:                    z.string().optional(),
  cantidad_producida:             z.number().positive('La cantidad producida debe ser positiva'),
  unidad_produccion:              z.nativeEnum(UnidadMedida),
  tiempo_preparacion:             z.number().int().positive().optional(),
  instrucciones:                  z.string().optional(),
  instrucciones_almacenamiento:   z.string().optional(),
  notas:                          z.string().optional(),
  merma_esperada_porcentaje:      z.number().min(0).max(100).optional(),
  merma_maxima_porcentaje:        z.number().min(0).max(100).optional(),
  medio_refrigeracion:            z.string().max(200).optional(),
  ingredientes:                   z.array(ingredienteSchema).min(1, 'La receta debe tener al menos un ingrediente'),
  fases:                          z.array(recetaFaseSchema).optional(),
});

export const updateRecetaSchema = createRecetaSchema.partial().omit({ id_producto_final: true });

export type CreateRecetaDTO = z.infer<typeof createRecetaSchema>;
export type UpdateRecetaDTO = z.infer<typeof updateRecetaSchema>;
