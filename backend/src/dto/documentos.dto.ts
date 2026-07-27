/**
 * DocumentosDTO — validación de forma para documentos laborales.
 */

import { z } from 'zod';
import { TIPOS_DOCUMENTO } from '../lib/documentos/catalogo';

export const emitirDocumentoSchema = z.object({
  tipo:        z.enum(TIPOS_DOCUMENTO),
  id_empleado: z.number().int().positive('Empleado inválido'),
  /** Texto libre que la plantilla inserta en {{documento.observaciones}}. */
  observaciones: z.string().max(2000).optional(),
  /** Solo para el desprendible de pago: el periodo liquidado del que sale. */
  id_periodo:    z.number().int().positive().optional(),
  /**
   * Certificado laboral: si es false, se omite el párrafo del salario.
   * Por defecto true = se muestra (comportamiento histórico). No-op en los
   * tipos que no llevan línea de salario.
   */
  incluirSalario: z.boolean().optional().default(true),
});

export const anularDocumentoSchema = z.object({
  motivo: z.string().min(5, 'Explica el motivo de la anulación').max(300),
});

/** Autoservicio del trabajador: su desprendible de un periodo liquidado. */
export const miDesprendibleSchema = z.object({
  id_periodo: z.number().int().positive('Periodo inválido'),
});

export type EmitirDocumentoDTO = z.infer<typeof emitirDocumentoSchema>;
export type AnularDocumentoDTO = z.infer<typeof anularDocumentoSchema>;
export type MiDesprendibleDTO = z.infer<typeof miDesprendibleSchema>;
