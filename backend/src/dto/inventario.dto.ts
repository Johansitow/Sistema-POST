/**
 * InventarioDTO - Validación de forma para movimientos de inventario
 */

import { z } from 'zod';
import { TipoMovimiento } from '@prisma/client';

export const registrarMovimientoSchema = z.object({
  id_producto:              z.number().int().positive('ID de producto inválido'),
  tipo_movimiento:          z.nativeEnum(TipoMovimiento, {
    errorMap: () => ({ message: 'Tipo de movimiento inválido' }),
  }),
  cantidad:                 z.number().positive('La cantidad debe ser positiva'),
  motivo:                   z.string().min(1, 'El motivo es obligatorio').max(255),
  id_proveedor:             z.number().int().positive().optional(),
  // Vincula el movimiento (salida/merma) a un lote existente — no crea uno nuevo
  id_lote:                  z.number().int().positive().optional(),
  referencia:               z.string().max(100).optional(),
  // Registra explícitamente un lote nuevo junto con este movimiento (entrada/producción).
  // Sin este flag, el movimiento solo suma/resta cantidad y no toca el módulo de Lotes.
  generar_lote:             z.boolean().optional(),
  id_usuario_responsable:   z.number().int().positive().optional(),
  vida_util_dias:           z.number().int().positive().optional(),
  merma_cantidad:           z.number().min(0).optional(),
  merma_porcentaje:         z.number().min(0).max(100).optional(),
  costo_produccion:         z.number().min(0).optional(),
  fecha_vencimiento:        z.string().datetime().optional(),
  observaciones_lote:       z.string().max(500).optional(),
});

export const actualizarEstadoLoteSchema = z.object({
  estado_lote:       z.enum(['activo', 'vencido', 'agotado', 'en_produccion']).optional(),
  fecha_vencimiento: z.string().datetime().optional(),
  observaciones:     z.string().max(500).optional(),
  // Marca la actualización como reconteo (revisión física periódica).
  es_reconteo:       z.boolean().optional(),
});

export type ActualizarEstadoLoteDTO = z.infer<typeof actualizarEstadoLoteSchema>;

export const configurarFrecuenciaReconteoSchema = z.object({
  dias: z.number().int().min(1).max(90),
});
export type ConfigurarFrecuenciaReconteoDTO = z.infer<typeof configurarFrecuenciaReconteoSchema>;

export type RegistrarMovimientoDTO = z.infer<typeof registrarMovimientoSchema>;
