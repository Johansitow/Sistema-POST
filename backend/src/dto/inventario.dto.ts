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
  id_lote:                  z.number().int().positive().optional(),
  referencia:               z.string().max(100).optional(),
  id_usuario_responsable:   z.number().int().positive().optional(),
  vida_util_dias:           z.number().int().positive().optional(),
  merma_cantidad:           z.number().min(0).optional(),
  merma_porcentaje:         z.number().min(0).max(100).optional(),
  costo_produccion:         z.number().min(0).optional(),
  fecha_vencimiento:        z.string().datetime().optional(),
  observaciones_lote:       z.string().max(500).optional(),
});

export type RegistrarMovimientoDTO = z.infer<typeof registrarMovimientoSchema>;
