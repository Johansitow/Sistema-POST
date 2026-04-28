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

export type GenerarListaComprasDTO = z.infer<typeof generarListaComprasSchema>;
export type CambiarEstadoListaDTO  = z.infer<typeof cambiarEstadoListaSchema>;
export type ActualizarItemDTO      = z.infer<typeof actualizarItemSchema>;
