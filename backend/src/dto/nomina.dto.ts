/**
 * NominaDTO — validación de forma del módulo de nómina.
 */

import { z } from 'zod';

const porcentaje = z.number().min(0).max(100);

export const parametrosNominaSchema = z.object({
  salario_minimo:     z.number().positive('El salario mínimo debe ser mayor que cero'),
  auxilio_transporte: z.number().min(0),
  tope_auxilio_smmlv: z.number().int().min(1).max(10).optional(),
  uvt:                z.number().positive('La UVT debe ser mayor que cero'),

  porc_salud_empleado:    porcentaje.optional(),
  porc_pension_empleado:  porcentaje.optional(),
  porc_salud_empleador:   porcentaje.optional(),
  porc_pension_empleador: porcentaje.optional(),
  porc_caja_compensacion: porcentaje.optional(),
  porc_icbf:              porcentaje.optional(),
  porc_sena:              porcentaje.optional(),

  porc_recargo_nocturno:       porcentaje.optional(),
  porc_extra_diurna:           porcentaje.optional(),
  porc_extra_nocturna:         porcentaje.optional(),
  porc_dominical:              porcentaje.optional(),
  porc_extra_dominical_diurna: porcentaje.optional(),

  horas_mensuales: z.number().int().min(1).max(400).optional(),

  porc_cesantias:         porcentaje.optional(),
  porc_interes_cesantias: porcentaje.optional(),
  porc_prima:             porcentaje.optional(),
  porc_vacaciones:        porcentaje.optional(),

  notas: z.string().max(1000).optional(),
});

export const crearPeriodoSchema = z.object({
  nombre:       z.string().min(3, 'Ponle un nombre reconocible al periodo').max(100),
  tipo_periodo: z.enum(['mensual', 'quincenal', 'semanal']),
  fecha_inicio: z.string().min(1, 'Fecha de inicio requerida'),
  fecha_fin:    z.string().min(1, 'Fecha final requerida'),
  id_restaurante: z.number().int().positive().nullable().optional(),
});

export const crearNovedadSchema = z.object({
  id_empleado: z.number().int().positive('Empleado inválido'),
  tipo: z.enum([
    'hora_extra_diurna', 'hora_extra_nocturna', 'hora_extra_dominical',
    'recargo_nocturno', 'dominical_festivo',
    'incapacidad_comun', 'incapacidad_laboral', 'licencia_no_remunerada', 'vacaciones',
    'bonificacion', 'comision',
    'prestamo', 'anticipo', 'descuento_otro',
  ]),
  cantidad:      z.number().min(0).max(744).optional(),   // 744 = horas de un mes
  valor:         z.number().min(0).optional(),
  observaciones: z.string().max(500).optional(),
}).refine(d => (d.cantidad ?? 0) > 0 || (d.valor ?? 0) > 0, {
  message: 'La novedad necesita una cantidad o un valor mayor que cero',
});

export const simularCostoSchema = z.object({
  salario: z.number().positive('El salario debe ser mayor que cero'),
  anio:    z.number().int().min(2020).max(2100).optional(),
  nivel_riesgo_arl: z.enum(['I', 'II', 'III', 'IV', 'V']).optional(),
});

export type ParametrosNominaDTO = z.infer<typeof parametrosNominaSchema>;
export type CrearPeriodoDTO     = z.infer<typeof crearPeriodoSchema>;
export type CrearNovedadDTO     = z.infer<typeof crearNovedadSchema>;
