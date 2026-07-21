/**
 * utils/empleado.ts
 *
 * Etiquetas y cálculos del dominio de empleado, compartidos por la ficha del
 * administrador (/admin/personal/:id) y el portal del trabajador (/perfil).
 *
 * Regla: los códigos que viajan por la API son en snake_case (`obra_labor`);
 * su texto legible vive SOLO aquí. Si se repite un `switch` de etiquetas en un
 * componente, va en este archivo.
 */

import type {
  EstadoLaboral, TipoContrato, Jornada, Turno, TipoDocumento, NivelRiesgoARL,
} from '../types';

// ─── Etiquetas ────────────────────────────────────────────────────────────────

export const ESTADO_LABORAL_LABEL: Record<EstadoLaboral, string> = {
  activo:         'Activo',
  periodo_prueba: 'Periodo de prueba',
  vacaciones:     'En vacaciones',
  incapacidad:    'Incapacidad',
  licencia:       'Licencia',
  suspendido:     'Suspendido',
  retirado:       'Retirado',
};

/** Color MUI por estado laboral — mismo criterio en ficha y portal. */
export const ESTADO_LABORAL_COLOR: Record<EstadoLaboral, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  activo:         'success',
  periodo_prueba: 'info',
  vacaciones:     'info',
  incapacidad:    'warning',
  licencia:       'warning',
  suspendido:     'error',
  retirado:       'default',
};

export const TIPO_CONTRATO_LABEL: Record<TipoContrato, string> = {
  indefinido:  'Término indefinido',
  fijo:        'Término fijo',
  obra_labor:  'Obra o labor',
  aprendizaje: 'Aprendizaje',
};

export const JORNADA_LABEL: Record<Jornada, string> = {
  completa:  'Tiempo completo',
  parcial:   'Medio tiempo',
  por_horas: 'Por horas',
};

export const TURNO_LABEL: Record<Turno, string> = {
  'mañana': 'Mañana',
  tarde:    'Tarde',
  noche:    'Noche',
  mixto:    'Mixto',
};

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumento, string> = {
  cc:            'Cédula de ciudadanía',
  ce:            'Cédula de extranjería',
  nit:           'NIT',
  pasaporte:     'Pasaporte',
  sin_documento: 'Sin documento',
};

export const NIVEL_RIESGO_ARL_LABEL: Record<NivelRiesgoARL, string> = {
  I:   'I — Riesgo mínimo',
  II:  'II — Riesgo bajo',
  III: 'III — Riesgo medio',
  IV:  'IV — Riesgo alto',
  V:   'V — Riesgo máximo',
};

/** Traduce un código a su etiqueta; devuelve null si el valor no vino. */
export function etiqueta<K extends string>(
  mapa: Record<K, string>,
  valor: K | null | undefined,
): string | null {
  return valor ? (mapa[valor] ?? valor) : null;
}

// ─── Fechas de calendario ─────────────────────────────────────────────────────

/**
 * parseFechaCalendario — convierte una fecha del backend en un Date LOCAL.
 *
 * Las fechas de nacimiento, ingreso y retiro son fechas de CALENDARIO, no
 * instantes: "nací el 21 de julio" no depende de la zona horaria. Prisma las
 * devuelve como DateTime a medianoche UTC ("1990-07-21T00:00:00.000Z"), y
 * `new Date(...)` las interpretaría en hora local — en Colombia (UTC-5) eso
 * las corre al día ANTERIOR y el cumpleaños caía un día antes.
 *
 * Por eso se leen los componentes del texto (los 10 primeros caracteres, que
 * cubren tanto "1990-07-21" como el ISO completo) y se construye la fecha en
 * hora local, sin conversión de zona.
 */
export function parseFechaCalendario(v: string | null | undefined): Date | null {
  if (!v) return null;

  const m = v.substring(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  // Formato inesperado: se intenta el parseo estándar antes de rendirse
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Antigüedad ───────────────────────────────────────────────────────────────

/**
 * calcularAntiguedad — tiempo transcurrido desde el ingreso.
 *
 * Cuenta meses de calendario (no días/30) para que "ingresó el 15 de enero"
 * cumpla un mes exacto el 15 de febrero, sin importar la duración del mes.
 * `hasta` permite congelar el cálculo en la fecha de retiro de un ex-empleado.
 */
export function calcularAntiguedad(
  fechaIngreso: string | null | undefined,
  hasta?: string | null,
): { anios: number; meses: number; texto: string } | null {
  const inicio = parseFechaCalendario(fechaIngreso);
  const fin    = hasta ? parseFechaCalendario(hasta) : new Date();
  if (!inicio || !fin || fin < inicio) return null;

  let meses = (fin.getFullYear() - inicio.getFullYear()) * 12
            + (fin.getMonth() - inicio.getMonth());
  // Aún no se cumple el mes si no llegó el día del mes de ingreso
  if (fin.getDate() < inicio.getDate()) meses--;
  if (meses < 0) meses = 0;

  const anios       = Math.floor(meses / 12);
  const mesesResto  = meses % 12;

  const partes: string[] = [];
  if (anios > 0)      partes.push(`${anios} ${anios === 1 ? 'año' : 'años'}`);
  if (mesesResto > 0) partes.push(`${mesesResto} ${mesesResto === 1 ? 'mes' : 'meses'}`);

  return {
    anios,
    meses: mesesResto,
    texto: partes.length ? partes.join(' y ') : 'Menos de un mes',
  };
}

// ─── Cumpleaños ───────────────────────────────────────────────────────────────

/**
 * diasParaCumpleanos — días que faltan para el próximo cumpleaños (0 = hoy).
 * Devuelve null si no hay fecha de nacimiento registrada.
 */
export function diasParaCumpleanos(fechaNacimiento: string | null | undefined): number | null {
  const nacimiento = parseFechaCalendario(fechaNacimiento);
  if (!nacimiento) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const proximo = new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
  if (proximo < hoy) proximo.setFullYear(hoy.getFullYear() + 1);

  return Math.round((proximo.getTime() - hoy.getTime()) / 86_400_000);
}

// ─── Alertas de la ficha ──────────────────────────────────────────────────────

export interface AlertaEmpleado {
  severidad: 'warning' | 'info' | 'error';
  mensaje:   string;
}

/**
 * construirAlertas — avisos proactivos derivados de los datos de la ficha.
 *
 * Solo se generan alertas comprobables con lo que hay en base. No se inventan
 * vencimientos (dotación, certificados de manipulación de alimentos) porque
 * todavía no existe el modelo que guarde esas fechas.
 */
export function construirAlertas(e: {
  estado_laboral?:      EstadoLaboral;
  tipo_contrato?:       TipoContrato | null;
  fecha_ingreso?:       string | null;
  fecha_nacimiento?:    string | null;
  fecha_retiro?:        string | null;
  documento_identidad?: string | null;
  eps?:                 string | null;
  afp?:                 string | null;
  arl?:                 string | null;
}): AlertaEmpleado[] {
  const alertas: AlertaEmpleado[] = [];
  const retirado = e.estado_laboral === 'retirado';

  if (!retirado) {
    const faltantes = [
      !e.documento_identidad && 'documento de identidad',
      !e.eps && 'EPS',
      !e.afp && 'fondo de pensiones',
      !e.arl && 'ARL',
    ].filter(Boolean) as string[];

    if (faltantes.length) {
      alertas.push({
        severidad: 'warning',
        mensaje: `Faltan datos obligatorios para nómina: ${faltantes.join(', ')}.`,
      });
    }

    // El contrato a término fijo se prorroga automáticamente si no se avisa
    // con 30 días de antelación: por eso el aviso, aunque la fecha de fin no
    // esté modelada todavía y solo podamos recordar la condición.
    if (e.tipo_contrato === 'fijo' && !e.fecha_ingreso) {
      alertas.push({
        severidad: 'info',
        mensaje: 'Contrato a término fijo sin fecha de ingreso registrada: no se puede calcular el preaviso de renovación.',
      });
    }

    const dias = diasParaCumpleanos(e.fecha_nacimiento);
    if (dias !== null && dias <= 7) {
      alertas.push({
        severidad: 'info',
        mensaje: dias === 0 ? '🎂 Hoy es su cumpleaños.' : `🎂 Cumple años en ${dias} ${dias === 1 ? 'día' : 'días'}.`,
      });
    }
  }

  return alertas;
}
