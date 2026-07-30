/**
 * NominaService — API client del módulo de nómina.
 */

import api from './api';

export type EstadoPeriodo = 'borrador' | 'en_revision' | 'aprobada' | 'pagada' | 'anulada';

export type TipoNovedad =
  | 'hora_extra_diurna' | 'hora_extra_nocturna' | 'hora_extra_dominical'
  | 'recargo_nocturno' | 'dominical_festivo'
  | 'incapacidad_comun' | 'incapacidad_laboral' | 'licencia_no_remunerada' | 'vacaciones'
  | 'bonificacion' | 'comision'
  | 'prestamo' | 'anticipo' | 'descuento_otro';

export interface ParametrosNomina {
  id: number;
  anio: number;
  salario_minimo: string | number;
  auxilio_transporte: string | number;
  uvt: string | number;
  verificado: boolean;
  fecha_verificacion: string | null;
  notas: string | null;
  [k: string]: unknown;
}

export interface PeriodoNomina {
  id: number;
  nombre: string;
  tipo_periodo: string;
  fecha_inicio: string;
  fecha_fin: string;
  anio: number;
  estado: EstadoPeriodo;
  total_devengado: string | number;
  total_deducciones: string | number;
  total_neto: string | number;
  total_aportes_empleador: string | number;
  total_provisiones: string | number;
  empleados_liquidados: number;
  fecha_liquidacion: string | null;
  fecha_aprobacion: string | null;
  fecha_pago: string | null;
  liquidado_por: { id: number; nombre_completo: string } | null;
  aprobado_por:  { id: number; nombre_completo: string } | null;
  restaurante:   { id: number; nombre: string } | null;
  _count?: { detalles: number; novedades: number };
}

export interface ExcepcionPrenomina {
  id_empleado: number;
  empleado: string;
  severidad: 'bloqueante' | 'advertencia';
  mensaje: string;
}

export interface Prenomina {
  periodo: PeriodoNomina;
  parametros_verificados: boolean;
  anio_parametros: number;
  total_empleados: number;
  liquidables: number;
  bloqueados: number;
  excepciones: ExcepcionPrenomina[];
  puede_liquidar: boolean;
}

export interface NovedadNomina {
  id: number;
  id_empleado: number;
  tipo: TipoNovedad;
  cantidad: string | number;
  valor: string | number;
  observaciones: string | null;
  empleado: { id: number; nombre_completo: string; codigo_empleado: string | null };
}

export interface ConceptoDetalle {
  id: number;
  codigo: string;
  nombre: string;
  tipo: 'devengado' | 'deduccion' | 'aporte_empleador' | 'provision';
  cantidad: string | number;
  valor: string | number;
  orden: number;
}

export interface DetalleNomina {
  id: number;
  id_empleado: number;
  salario_base: string | number;
  dias_trabajados: string | number;
  ibc: string | number;
  total_devengado: string | number;
  total_deducciones: string | number;
  neto_pagar: string | number;
  aportes_empleador: string | number;
  provisiones: string | number;
  banco: string | null;
  numero_cuenta: string | null;
  empleado: {
    id: number; nombre_completo: string; codigo_empleado: string | null;
    cargo: string | null; documento_identidad: string | null;
  };
  conceptos: ConceptoDetalle[];
}

export interface CostoLaboral {
  ventas: number;
  costo_nomina: number;
  costo_total: number;
  /** null cuando no hubo ventas: un porcentaje sobre cero no dice nada. */
  porcentaje: number | null;
  empleados: number;
  venta_por_empleado: number;
}

export interface SimulacionCosto {
  salario_base: number;
  neto_empleado: number;
  total_devengado: number;
  aportes_empleador: number;
  provisiones: number;
  costo_total: number;
  factor_prestacional: number;
}

export const nominaService = {

  // Parámetros legales
  listarParametros: async (): Promise<ParametrosNomina[]> => {
    const { data } = await api.get('/nomina/parametros');
    return data.parametros;
  },

  guardarParametros: async (anio: number, dto: Record<string, unknown>): Promise<ParametrosNomina> => {
    const { data } = await api.put(`/nomina/parametros/${anio}`, dto);
    return data.parametros;
  },

  verificarParametros: async (anio: number): Promise<ParametrosNomina> => {
    const { data } = await api.patch(`/nomina/parametros/${anio}/verificar`);
    return data.parametros;
  },

  // Periodos
  listarPeriodos: async (anio?: number): Promise<PeriodoNomina[]> => {
    const { data } = await api.get('/nomina/periodos', { params: anio ? { anio } : undefined });
    return data.periodos;
  },

  obtenerPeriodo: async (id: number): Promise<PeriodoNomina> => {
    const { data } = await api.get(`/nomina/periodos/${id}`);
    return data.periodo;
  },

  crearPeriodo: async (dto: {
    nombre: string; tipo_periodo: string; fecha_inicio: string; fecha_fin: string;
    id_restaurante?: number | null; id_grupo?: number;
  }): Promise<PeriodoNomina> => {
    const { data } = await api.post('/nomina/periodos', dto);
    return data.periodo;
  },

  prenomina: async (id: number): Promise<Prenomina> => {
    const { data } = await api.get(`/nomina/periodos/${id}/prenomina`);
    return data;
  },

  liquidar:     async (id: number) => (await api.post(`/nomina/periodos/${id}/liquidar`)).data.periodo as PeriodoNomina,
  aprobar:      async (id: number) => (await api.post(`/nomina/periodos/${id}/aprobar`)).data.periodo as PeriodoNomina,
  marcarPagado: async (id: number) => (await api.post(`/nomina/periodos/${id}/pagar`)).data.periodo as PeriodoNomina,
  reabrir:      async (id: number) => (await api.post(`/nomina/periodos/${id}/reabrir`)).data.periodo as PeriodoNomina,

  // Novedades
  listarNovedades: async (id: number): Promise<NovedadNomina[]> => {
    const { data } = await api.get(`/nomina/periodos/${id}/novedades`);
    return data.novedades;
  },

  crearNovedad: async (id: number, dto: {
    id_empleado: number; tipo: TipoNovedad; cantidad?: number; valor?: number; observaciones?: string;
  }): Promise<NovedadNomina> => {
    const { data } = await api.post(`/nomina/periodos/${id}/novedades`, dto);
    return data.novedad;
  },

  eliminarNovedad: async (id: number, idNovedad: number): Promise<void> => {
    await api.delete(`/nomina/periodos/${id}/novedades/${idNovedad}`);
  },

  // Resultados
  listarDetalles: async (id: number): Promise<DetalleNomina[]> => {
    const { data } = await api.get(`/nomina/periodos/${id}/detalles`);
    return data.detalles;
  },

  costoLaboral: async (id: number): Promise<CostoLaboral> => {
    const { data } = await api.get(`/nomina/periodos/${id}/costo-laboral`);
    return data.costo;
  },

  simularCosto: async (salario: number, anio?: number, nivel_riesgo_arl?: string): Promise<SimulacionCosto> => {
    const { data } = await api.post('/nomina/simular-costo', { salario, anio, nivel_riesgo_arl });
    return data.simulacion;
  },
};

// ── Etiquetas de dominio ──────────────────────────────────────────────────────

export const ESTADO_PERIODO_LABEL: Record<EstadoPeriodo, string> = {
  borrador:    'Borrador',
  en_revision: 'En revisión',
  aprobada:    'Aprobada',
  pagada:      'Pagada',
  anulada:     'Anulada',
};

export const ESTADO_PERIODO_COLOR: Record<EstadoPeriodo, 'default' | 'info' | 'success' | 'primary' | 'error'> = {
  borrador:    'default',
  en_revision: 'info',
  aprobada:    'success',
  pagada:      'primary',
  anulada:     'error',
};

export const TIPO_NOVEDAD_LABEL: Record<TipoNovedad, string> = {
  hora_extra_diurna:      'Hora extra diurna',
  hora_extra_nocturna:    'Hora extra nocturna',
  hora_extra_dominical:   'Hora extra dominical',
  recargo_nocturno:       'Recargo nocturno',
  dominical_festivo:      'Dominical o festivo',
  incapacidad_comun:      'Incapacidad común',
  incapacidad_laboral:    'Incapacidad laboral',
  licencia_no_remunerada: 'Licencia no remunerada',
  vacaciones:             'Vacaciones',
  bonificacion:           'Bonificación',
  comision:               'Comisión',
  prestamo:               'Préstamo',
  anticipo:               'Anticipo',
  descuento_otro:         'Otro descuento',
};

/** Novedades que se miden en HORAS; el resto va por días o por valor fijo. */
export const NOVEDADES_POR_HORA: TipoNovedad[] = [
  'hora_extra_diurna', 'hora_extra_nocturna', 'hora_extra_dominical',
  'recargo_nocturno', 'dominical_festivo',
];

/** Novedades que se miden en DÍAS. */
export const NOVEDADES_POR_DIA: TipoNovedad[] = [
  'incapacidad_comun', 'incapacidad_laboral', 'licencia_no_remunerada', 'vacaciones',
];

/** Novedades que se registran con un VALOR en pesos. */
export const NOVEDADES_POR_VALOR: TipoNovedad[] = [
  'bonificacion', 'comision', 'prestamo', 'anticipo', 'descuento_otro',
];
