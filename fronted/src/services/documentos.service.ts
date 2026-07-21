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
  | 'documento_acta_dotacion';

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
    tipo: TipoDocumento, id_empleado: number, observaciones?: string,
  ): Promise<{ html: string; nombre: string }> => {
    const { data } = await api.post('/documentos/previsualizar', { tipo, id_empleado, observaciones });
    return data;
  },

  emitir: async (
    tipo: TipoDocumento, id_empleado: number, observaciones?: string,
  ): Promise<DocumentoEmitido> => {
    const { data } = await api.post('/documentos', { tipo, id_empleado, observaciones });
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
};
