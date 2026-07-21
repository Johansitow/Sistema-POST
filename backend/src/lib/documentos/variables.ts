/**
 * variables.ts — resolución de {{marcadores}} en las plantillas de documentos.
 *
 * Las plantillas son texto libre que el administrador puede editar, así que
 * necesitan marcadores para los datos del empleado y de la empresa. Este módulo
 * construye el diccionario y hace la sustitución.
 *
 * Dos reglas de seguridad:
 *   1. Los valores se escapan como HTML. La plantilla la escribe el
 *      administrador, pero los VALORES vienen de datos de usuario (nombre,
 *      cargo, motivo de retiro): sin escapar, un nombre con `<script>` se
 *      ejecutaría en el documento y en la página pública de verificación.
 *   2. Un marcador desconocido no se deja crudo en el papel: se sustituye por
 *      una marca visible para que el administrador note que se equivocó al
 *      escribir la plantilla, en vez de imprimir "{{empleado.nomber}}".
 */

import { pesosEnLetras } from './numeroALetras';

// ─── Escapado ─────────────────────────────────────────────────────────────────

const ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export const escaparHtml = (v: string): string => v.replace(/[&<>"']/g, c => ESCAPES[c]);

// ─── Formato de fechas y textos ───────────────────────────────────────────────

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Fecha en el formato de los documentos legales: "21 de julio de 2026".
 *
 * Se leen los componentes UTC porque las fechas de ingreso y retiro son fechas
 * de CALENDARIO guardadas como DateTime a medianoche UTC; leerlas en hora local
 * (Colombia, UTC-5) las correría al día anterior.
 */
export function fechaEnLetras(fecha: Date | null | undefined): string {
  if (!fecha) return '';
  return `${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]} de ${fecha.getUTCFullYear()}`;
}

/** Fecha de emisión: se usa la fecha local, porque el documento se emite hoy. */
export function fechaHoyEnLetras(fecha = new Date()): string {
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

export const formatearPesos = (v: number): string =>
  '$ ' + Math.round(v).toLocaleString('es-CO');

/** Antigüedad en años y meses, contando meses de calendario. */
export function antiguedadEnTexto(desde: Date | null | undefined, hasta?: Date | null): string {
  if (!desde) return '';
  const fin = hasta ?? new Date();

  let meses = (fin.getUTCFullYear() - desde.getUTCFullYear()) * 12
            + (fin.getUTCMonth() - desde.getUTCMonth());
  if (fin.getUTCDate() < desde.getUTCDate()) meses--;
  if (meses < 0) return '';

  const anios = Math.floor(meses / 12);
  const resto = meses % 12;

  const partes: string[] = [];
  if (anios > 0) partes.push(`${anios} ${anios === 1 ? 'año' : 'años'}`);
  if (resto > 0) partes.push(`${resto} ${resto === 1 ? 'mes' : 'meses'}`);
  return partes.length ? partes.join(' y ') : 'menos de un mes';
}

// ─── Etiquetas de dominio ─────────────────────────────────────────────────────

const TIPO_DOCUMENTO_LABEL: Record<string, string> = {
  cc: 'cédula de ciudadanía', ce: 'cédula de extranjería',
  nit: 'NIT', pasaporte: 'pasaporte', sin_documento: 'documento',
};

const TIPO_CONTRATO_LABEL: Record<string, string> = {
  indefinido: 'término indefinido', fijo: 'término fijo',
  obra_labor: 'obra o labor', aprendizaje: 'aprendizaje',
};

const JORNADA_LABEL: Record<string, string> = {
  completa: 'tiempo completo', parcial: 'medio tiempo', por_horas: 'por horas',
};

const FRECUENCIA_LABEL: Record<string, string> = {
  mensual: 'mensual', quincenal: 'quincenal', semanal: 'semanal',
};

// ─── Construcción del diccionario ─────────────────────────────────────────────

export interface DatosEmpleado {
  nombre_completo:     string;
  tipo_documento:      string | null;
  documento_identidad: string | null;
  cargo:               string | null;
  fecha_ingreso:       Date | null;
  fecha_retiro:        Date | null;
  motivo_retiro:       string | null;
  tipo_contrato:       string | null;
  jornada:             string | null;
  codigo_empleado:     string | null;
  email:               string | null;
  telefono:            string | null;
}

export interface DatosEmpresa {
  nombre: string;
  nit:    string | null;
  ciudad: string | null;
  direccion: string | null;
  telefono:  string | null;
}

export interface DatosNomina {
  salario_base: number;
  tipo_pago:    string;
}

export interface ContextoDocumento {
  empleado:       DatosEmpleado;
  empresa:        DatosEmpresa;
  nomina:         DatosNomina | null;
  firma:          { nombre: string; cargo: string };
  consecutivo:    string;
  codigo:         string;
  observaciones?: string;
  fechaEmision:   Date;
}

/**
 * construirVariables — diccionario plano de marcador → valor SIN escapar.
 * El escapado se aplica al sustituir, no aquí, para que los datos crudos
 * puedan guardarse tal cual en el snapshot `datos` del documento emitido.
 */
export function construirVariables(ctx: ContextoDocumento): Record<string, string> {
  const { empleado: e, empresa: em, nomina: n } = ctx;

  const salario = n ? formatearPesos(Number(n.salario_base)) : 'no registrado';
  const letras  = n ? pesosEnLetras(Number(n.salario_base)) : '';

  return {
    // Empleado
    'empleado.nombre':              e.nombre_completo,
    'empleado.documento':           e.documento_identidad ?? '',
    'empleado.tipo_documento':      TIPO_DOCUMENTO_LABEL[e.tipo_documento ?? ''] ?? 'documento de identidad',
    'empleado.codigo':              e.codigo_empleado ?? '',
    'empleado.cargo':               e.cargo ?? 'sin cargo asignado',
    'empleado.email':               e.email ?? '',
    'empleado.telefono':            e.telefono ?? '',
    'empleado.fecha_ingreso_texto': fechaEnLetras(e.fecha_ingreso),
    'empleado.fecha_retiro_texto':  fechaEnLetras(e.fecha_retiro),
    'empleado.motivo_retiro':       e.motivo_retiro ?? 'no especificado',
    'empleado.tipo_contrato':       TIPO_CONTRATO_LABEL[e.tipo_contrato ?? ''] ?? 'término indefinido',
    'empleado.jornada':             JORNADA_LABEL[e.jornada ?? ''] ?? 'tiempo completo',
    'empleado.antiguedad':          antiguedadEnTexto(e.fecha_ingreso, e.fecha_retiro),
    'empleado.salario':             salario,
    'empleado.salario_letras':      letras,
    'empleado.frecuencia_pago':     FRECUENCIA_LABEL[n?.tipo_pago ?? ''] ?? 'mensual',

    // Empresa
    'empresa.nombre':    em.nombre,
    'empresa.nit':       em.nit ?? 'N/A',
    'empresa.ciudad':    em.ciudad ?? '',
    'empresa.direccion': em.direccion ?? '',
    'empresa.telefono':  em.telefono ?? '',

    // Documento
    'documento.consecutivo':   ctx.consecutivo,
    'documento.codigo':        ctx.codigo,
    'documento.fecha_texto':   fechaHoyEnLetras(ctx.fechaEmision),
    'documento.observaciones': ctx.observaciones ?? '',

    // Firma
    'firma.nombre': ctx.firma.nombre,
    'firma.cargo':  ctx.firma.cargo,
  };
}

/** Marcador desconocido: visible en el papel para que se corrija la plantilla. */
const MARCA_DESCONOCIDA = (clave: string) =>
  `<span style="background:#ffe0e0;color:#b00;">[variable desconocida: ${escaparHtml(clave)}]</span>`;

/**
 * sustituir — reemplaza {{clave}} por su valor escapado.
 * Admite espacios dentro de las llaves: {{ empleado.nombre }}.
 */
export function sustituir(texto: string, variables: Record<string, string>): string {
  return texto.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, clave: string) => {
    const valor = variables[clave];
    if (valor === undefined) return MARCA_DESCONOCIDA(clave);
    return escaparHtml(valor);
  });
}

/** Lista de marcadores disponibles, para mostrarla en el editor de plantillas. */
export function listarVariablesDisponibles(): { clave: string; ejemplo: string }[] {
  const ejemplo = construirVariables({
    empleado: {
      nombre_completo: 'María Rodríguez Gómez',
      tipo_documento: 'cc', documento_identidad: '1.020.304.050',
      cargo: 'Chef Principal',
      fecha_ingreso: new Date(Date.UTC(2024, 2, 15)),
      fecha_retiro: null, motivo_retiro: null,
      tipo_contrato: 'indefinido', jornada: 'completa',
      codigo_empleado: 'EMP-0042',
      email: 'maria@empresa.com', telefono: '3001234567',
    },
    empresa: {
      nombre: 'Restaurante Ejemplo S.A.S.', nit: '900.123.456-7',
      ciudad: 'Bogotá D.C.', direccion: 'Calle 100 # 15-20', telefono: '6011234567',
    },
    nomina: { salario_base: 1_800_000, tipo_pago: 'mensual' },
    firma: { nombre: 'Juan Pérez', cargo: 'Representante Legal' },
    consecutivo: 'CL-2026-0001',
    codigo: 'A1B2C3D4',
    observaciones: '2 camisas, 1 pantalón, 1 par de calzado antideslizante',
    fechaEmision: new Date(),
  });

  return Object.entries(ejemplo).map(([clave, valor]) => ({ clave, ejemplo: valor }));
}
