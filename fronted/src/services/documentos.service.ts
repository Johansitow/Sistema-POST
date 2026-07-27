/**
 * DocumentosService — documentos laborales.
 *
 * El HTML lo genera SIEMPRE el backend (ver documento.service.ts): un
 * certificado laboral tiene valor probatorio y su contenido no puede depender
 * de lo que arme el navegador. Aquí solo se pide y se muestra.
 */

import api from './api';

export type TipoDocumento =
  | 'documento_certificado_laboral'
  | 'documento_carta_terminacion'
  | 'documento_paz_y_salvo'
  | 'documento_acta_dotacion'
  | 'documento_desprendible_pago';

export interface TipoDocumentoMeta {
  tipo:        TipoDocumento;
  nombre:      string;
  descripcion: string;
  /** Solo emitible a empleados con estado laboral "retirado". */
  requiereRetiro: boolean;
}

export interface DocumentoEmitido {
  id:                  number;
  tipo:                TipoDocumento;
  consecutivo:         string;
  codigo_verificacion: string;
  fecha_emision:       string;
  vigencia_hasta:      string | null;
  anulado:             boolean;
  motivo_anulacion:    string | null;
  fecha_anulacion:     string | null;
  emisor:   { id: number; nombre_completo: string };
  empleado: { id: number; nombre_completo: string; codigo_empleado: string | null };
}

/** Respuesta de la verificación pública — sin datos sensibles. */
export interface VerificacionDocumento {
  valido:         boolean;
  estado:         'vigente' | 'vencido' | 'anulado';
  tipo:           TipoDocumento;
  tipo_nombre:    string;
  consecutivo:    string;
  codigo:         string;
  titular:        string;
  empresa:        string;
  empresa_nit:    string | null;
  fecha_emision:  string;
  vigencia_hasta: string | null;
  hash:           string;
}

export interface VariableDisponible {
  clave:   string;
  ejemplo: string;
}

/** Periodo de nómina liquidado del propio trabajador (para el desprendible). */
export interface PeriodoLiquidado {
  id_periodo:   number;
  nombre:       string;
  fecha_inicio: string;
  fecha_fin:    string;
  estado:       'aprobada' | 'pagada';
  neto_pagar:   number;
}

export const documentosService = {

  listarTipos: async (): Promise<TipoDocumentoMeta[]> => {
    const { data } = await api.get('/documentos/tipos');
    return data.tipos;
  },

  listarVariables: async (): Promise<VariableDisponible[]> => {
    const { data } = await api.get('/documentos/variables');
    return data.variables;
  },

  /** Renderiza sin persistir — mismo código que la emisión real. */
  previsualizar: async (
    tipo: TipoDocumento, id_empleado: number, observaciones?: string, incluirSalario?: boolean,
  ): Promise<{ html: string; nombre: string }> => {
    const { data } = await api.post('/documentos/previsualizar', { tipo, id_empleado, observaciones, incluirSalario });
    return data;
  },

  emitir: async (
    tipo: TipoDocumento, id_empleado: number, observaciones?: string, incluirSalario?: boolean,
  ): Promise<DocumentoEmitido> => {
    const { data } = await api.post('/documentos', { tipo, id_empleado, observaciones, incluirSalario });
    return data.documento;
  },

  listarPorEmpleado: async (idEmpleado: number): Promise<DocumentoEmitido[]> => {
    const { data } = await api.get(`/documentos/empleado/${idEmpleado}`);
    return data.documentos;
  },

  /** Devuelve el snapshot original, nunca un render nuevo. */
  obtenerContenido: async (id: number): Promise<{ contenido_html: string; consecutivo: string; anulado: boolean }> => {
    const { data } = await api.get(`/documentos/${id}/contenido`);
    return data.documento;
  },

  anular: async (id: number, motivo: string): Promise<DocumentoEmitido> => {
    const { data } = await api.patch(`/documentos/${id}/anular`, { motivo });
    return data.documento;
  },

  /** Consulta PÚBLICA — no requiere sesión. */
  verificar: async (codigo: string): Promise<VerificacionDocumento> => {
    const { data } = await api.get(`/documentos/verificar/${encodeURIComponent(codigo)}`);
    return data;
  },

  // ── Portal del trabajador — autoservicio ──────────────────────────────────
  // Rutas /auth/mi(s)-*: el backend toma el id del token, así que el empleado
  // solo alcanza lo suyo sin permiso de administración.

  /** Documentos propios ya emitidos (certificados y desprendibles). */
  misDocumentos: async (): Promise<DocumentoEmitido[]> => {
    const { data } = await api.get('/auth/mis-documentos');
    return data.documentos;
  },

  /** Snapshot de un documento propio. */
  miDocumentoContenido: async (id: number): Promise<{ contenido_html: string; consecutivo: string; anulado: boolean }> => {
    const { data } = await api.get(`/auth/mis-documentos/${id}/contenido`);
    return data.documento;
  },

  /** Periodos liquidados propios (para elegir el desprendible). */
  misPeriodosLiquidados: async (): Promise<PeriodoLiquidado[]> => {
    const { data } = await api.get('/auth/mis-periodos-liquidados');
    return data.periodos;
  },

  /** Genera (idempotente) el desprendible propio de un periodo. */
  miDesprendible: async (id_periodo: number): Promise<DocumentoEmitido> => {
    const { data } = await api.post('/auth/mi-desprendible', { id_periodo });
    return data.documento;
  },
};
