/**
 * tipos.ts — contratos del motor de nómina.
 *
 * El motor es una función PURA: recibe salario, días, novedades y parámetros
 * legales, y devuelve las líneas del desprendible. No toca base de datos ni
 * conoce Prisma, para que se pueda probar exhaustivamente sin infraestructura.
 */

import type { TipoNovedadNomina } from '@prisma/client';

/** Parámetros legales del año — vienen de la tabla ParametroNomina. */
export interface ParametrosLegales {
  anio:                   number;
  salario_minimo:         number;
  auxilio_transporte:     number;
  tope_auxilio_smmlv:     number;
  uvt:                    number;

  porc_salud_empleado:    number;
  porc_pension_empleado:  number;

  porc_salud_empleador:   number;
  porc_pension_empleador: number;
  porc_caja_compensacion: number;
  porc_icbf:              number;
  porc_sena:              number;

  porc_recargo_nocturno:       number;
  porc_extra_diurna:           number;
  porc_extra_nocturna:         number;
  porc_dominical:              number;
  porc_extra_dominical_diurna: number;

  horas_mensuales:        number;

  porc_cesantias:         number;
  porc_interes_cesantias: number;
  porc_prima:             number;
  porc_vacaciones:        number;
}

export interface NovedadCalculo {
  tipo:     TipoNovedadNomina;
  /** Horas o días, según el tipo. */
  cantidad: number;
  /** Valor fijo para bonificaciones, comisiones, préstamos y descuentos. */
  valor:    number;
}

export interface EntradaLiquidacion {
  salario_base:    number;
  /** Días del mes comercial de 30 sobre los que se liquida. */
  dias_trabajados: number;
  novedades:       NovedadCalculo[];
  /** Nivel de riesgo ARL (I–V) para el aporte del empleador. */
  nivel_riesgo_arl?: string | null;
  /**
   * Exoneración del art. 114-1 ET: las empresas exoneradas no pagan salud,
   * ICBF ni SENA por los empleados que ganan menos de 10 SMMLV.
   */
  empresa_exonerada_aportes?: boolean;
}

export type TipoConcepto = 'devengado' | 'deduccion' | 'aporte_empleador' | 'provision';

export interface LineaConcepto {
  codigo:   string;
  nombre:   string;
  tipo:     TipoConcepto;
  cantidad: number;
  valor:    number;
  orden:    number;
}

export interface ResultadoLiquidacion {
  conceptos:         LineaConcepto[];
  /** Ingreso base de cotización: base de salud y pensión. */
  ibc:               number;
  dias_liquidados:   number;
  total_devengado:   number;
  total_deducciones: number;
  neto_pagar:        number;
  aportes_empleador: number;
  provisiones:       number;
}
