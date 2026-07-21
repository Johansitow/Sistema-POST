import { z } from 'zod';
import { EstadoListaCompras } from '@prisma/client';

export const generarListaComprasSchema = z.object({
  notas:                  z.string().max(1000).optional(),
  id_proveedor_asignado:  z.number().int().positive().optional(),
});

export const cambiarEstadoListaSchema = z.object({
  estado:            z.nativeEnum(EstadoListaCompras),
  notas:             z.string().max(1000).optional(),
  fecha_envio:       z.string().datetime().optional(),
  fecha_recepcion:   z.string().datetime().optional(),
});

export const actualizarItemSchema = z.object({
  cantidad_recibida: z.number().min(0),
  observaciones:     z.string().max(500).optional(),
});

// Creación manual de lista: el usuario elige productos y cantidades a mano,
// sin depender del stock mínimo ni de la generación automática.
export const crearListaManualSchema = z.object({
  notas:                 z.string().max(1000).optional(),
  id_proveedor_asignado: z.number().int().positive().optional(),
  items: z.array(z.object({
    id_producto:           z.number().int().positive(),
    cantidad_sugerida:     z.number().positive(),
    id_proveedor_sugerido: z.number().int().positive().optional(),
    precio_estimado:       z.number().min(0).optional(),
    observaciones:         z.string().max(500).optional(),
  })).min(1, 'Agrega al menos un producto a la lista'),
});

export type GenerarListaComprasDTO = z.infer<typeof generarListaComprasSchema>;
export type CambiarEstadoListaDTO  = z.infer<typeof cambiarEstadoListaSchema>;
export type ActualizarItemDTO      = z.infer<typeof actualizarItemSchema>;
export type CrearListaManualDTO    = z.infer<typeof crearListaManualSchema>;
