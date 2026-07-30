/**
 * calculadora.ts — motor de liquidación de nómina (Colombia).
 *
 * Función pura: mismas entradas, mismas salidas, sin base de datos. Todo lo
 * que puede cambiar por ley (salario mínimo, porcentajes, recargos) llega en
 * `ParametrosLegales`, que sale de la tabla versionada por año.
 *
 * Convenciones colombianas que implementa:
 *   • Mes comercial de 30 días: el salario diario es el mensual / 30.
 *   • El auxilio de transporte NO es base de salud ni pensión, pero SÍ es base
 *     de prestaciones sociales (prima y cesantías).
 *   • El IBC tiene piso de 1 SMMLV y techo de 25 SMMLV.
 *   • Las horas extra y los recargos SÍ son salariales: entran al IBC.
 *   • Las bonificaciones ocasionales NO son salariales: no entran al IBC.
 *
 * Lo que deliberadamente NO modela, para no fingir precisión:
 *   • El reparto empleador/EPS de las incapacidades (los dos primeros días los
 *     asume el empleador y el resto lo recobra a la EPS). Eso es un flujo de
 *     recobro, no una línea del desprendible del trabajador.
 *   • Retención en la fuente por procedimiento 2 (requiere histórico de 12
 *     meses). Se aplica el procedimiento 1, que es el habitual.
 */

import type {
  EntradaLiquidacion, LineaConcepto, ParametrosLegales, ResultadoLiquidacion,
} from './tipos';

/** Redondeo a peso entero: en Colombia la nómina no maneja centavos. */
const pesos = (v: number): number => Math.round(v);

/** Días del mes comercial. Fijo por costumbre contable, no es un parámetro legal. */
export const DIAS_MES_COMERCIAL = 30;

/**
 * Tarifas de ARL por nivel de riesgo (Decreto 1772 de 1994).
 *
 * Van aquí y no en ParametrosNomina porque son ESTRUCTURALES: dependen de la
 * actividad económica, no del año. El salario mínimo cambia cada enero; estas
 * tarifas llevan décadas iguales.
 */
export const TARIFAS_ARL: Record<string, number> = {
  I: 0.522, II: 1.044, III: 2.436, IV: 4.35, V: 6.96,
};

/**
 * Tabla de retención en la fuente sobre rentas de trabajo (art. 383 ET).
 * Cada tramo: desde (en UVT), tarifa marginal y UVT sumadas de tramos previos.
 */
const TABLA_RETENCION = [
  { desde: 0,    tarifa: 0,    adicional: 0 },
  { desde: 95,   tarifa: 0.19, adicional: 0 },
  { desde: 150,  tarifa: 0.28, adicional: 10 },
  { desde: 360,  tarifa: 0.33, adicional: 69 },
  { desde: 640,  tarifa: 0.35, adicional: 162 },
  { desde: 945,  tarifa: 0.37, adicional: 268 },
  { desde: 2300, tarifa: 0.39, adicional: 770 },
];

/**
 * Fondo de Solidaridad Pensional: aporte adicional escalonado para quienes
 * devengan 4 SMMLV o más (Ley 100, art. 27).
 */
function porcentajeFSP(ibc: number, smmlv: number): number {
  const enSmmlv = ibc / smmlv;
  if (enSmmlv < 4)  return 0;
  if (enSmmlv < 16) return 1;
  if (enSmmlv < 17) return 1.2;
  if (enSmmlv < 18) return 1.4;
  if (enSmmlv < 19) return 1.6;
  if (enSmmlv < 20) return 1.8;
  return 2;
}

/**
 * retencionEnLaFuente — procedimiento 1 sobre la depuración del mes.
 *
 * Depuración: ingresos laborales − aportes obligatorios − renta exenta del 25 %
 * (art. 206 num. 10 ET, con tope de 790 UVT anuales ≈ 65,83 UVT mensuales).
 */
export function retencionEnLaFuente(
  ingresosLaborales: number,
  aportesObligatorios: number,
  uvt: number,
): number {
  const subtotal = ingresosLaborales - aportesObligatorios;
  if (subtotal <= 0) return 0;

  const topeExentaMensual = (790 / 12) * uvt;
  const rentaExenta = Math.min(subtotal * 0.25, topeExentaMensual);

  const baseUvt = (subtotal - rentaExenta) / uvt;

  // Se recorre de mayor a menor para quedarse con el tramo aplicable
  for (let i = TABLA_RETENCION.length - 1; i >= 0; i--) {
    const tramo = TABLA_RETENCION[i];
    if (baseUvt > tramo.desde) {
      const retencionUvt = (baseUvt - tramo.desde) * tramo.tarifa + tramo.adicional;
      return pesos(retencionUvt * uvt);
    }
  }
  return 0;
}

// ─── Motor ────────────────────────────────────────────────────────────────────

export function liquidar(
  entrada: EntradaLiquidacion,
  p: ParametrosLegales,
): ResultadoLiquidacion {
  const conceptos: LineaConcepto[] = [];
  const add = (
    codigo: string, nombre: string, tipo: LineaConcepto['tipo'],
    cantidad: number, valor: number, orden: number,
  ) => {
    if (valor !== 0) conceptos.push({ codigo, nombre, tipo, cantidad, valor: pesos(valor), orden });
  };

  const salarioBase  = entrada.salario_base;
  const salarioDiario = salarioBase / DIAS_MES_COMERCIAL;
  const valorHora     = salarioBase / p.horas_mensuales;

  // ── Días efectivos ─────────────────────────────────────────────────────────
  // Las licencias no remuneradas y las incapacidades restan días de salario;
  // las vacaciones se pagan aparte pero también salen del salario ordinario.
  const dias = (tipo: string) =>
    entrada.novedades.filter(n => n.tipo === tipo).reduce((s, n) => s + n.cantidad, 0);

  const diasLicencia    = dias('licencia_no_remunerada');
  const diasIncapComun  = dias('incapacidad_comun');
  const diasIncapLaboral = dias('incapacidad_laboral');
  const diasVacaciones  = dias('vacaciones');

  const diasNoLaborados = diasLicencia + diasIncapComun + diasIncapLaboral + diasVacaciones;
  const diasSalario = Math.max(0, entrada.dias_trabajados - diasNoLaborados);

  // ── Devengados salariales ──────────────────────────────────────────────────
  const salarioDevengado = salarioDiario * diasSalario;
  add('salario', 'Salario básico', 'devengado', diasSalario, salarioDevengado, 1);

  // Horas extra y recargos: el porcentaje del parámetro es el ADICIONAL sobre
  // la hora ordinaria; las extra pagan hora + recargo, los recargos solo el
  // recargo (la hora ya está dentro del salario básico).
  const horas = (tipo: string) =>
    entrada.novedades.filter(n => n.tipo === tipo).reduce((s, n) => s + n.cantidad, 0);

  const hExtraDiurna    = horas('hora_extra_diurna');
  const hExtraNocturna  = horas('hora_extra_nocturna');
  const hExtraDominical = horas('hora_extra_dominical');
  const hRecargoNoct    = horas('recargo_nocturno');
  const hDominical      = horas('dominical_festivo');

  const vExtraDiurna    = hExtraDiurna    * valorHora * (1 + p.porc_extra_diurna / 100);
  const vExtraNocturna  = hExtraNocturna  * valorHora * (1 + p.porc_extra_nocturna / 100);
  const vExtraDominical = hExtraDominical * valorHora * (1 + p.porc_extra_dominical_diurna / 100);
  const vRecargoNoct    = hRecargoNoct    * valorHora * (p.porc_recargo_nocturno / 100);
  const vDominical      = hDominical      * valorHora * (p.porc_dominical / 100);

  add('extra_diurna',    'Horas extra diurnas',      'devengado', hExtraDiurna,    vExtraDiurna,    2);
  add('extra_nocturna',  'Horas extra nocturnas',    'devengado', hExtraNocturna,  vExtraNocturna,  3);
  add('extra_dominical', 'Horas extra dominicales',  'devengado', hExtraDominical, vExtraDominical, 4);
  add('recargo_nocturno','Recargo nocturno',         'devengado', hRecargoNoct,    vRecargoNoct,    5);
  add('dominical',       'Recargo dominical/festivo','devengado', hDominical,      vDominical,      6);

  // Vacaciones: se pagan al 100 % del salario y son salariales
  const vVacaciones = salarioDiario * diasVacaciones;
  add('vacaciones', 'Vacaciones', 'devengado', diasVacaciones, vVacaciones, 7);

  // Incapacidades: la común se paga al 66,67 %; la de origen laboral al 100 %.
  // Ambas tienen piso en el salario mínimo diario.
  const salarioMinDiario = p.salario_minimo / DIAS_MES_COMERCIAL;
  const baseIncapDiaria  = Math.max(salarioDiario, salarioMinDiario);
  const vIncapComun   = baseIncapDiaria * diasIncapComun * (2 / 3);
  const vIncapLaboral = baseIncapDiaria * diasIncapLaboral;
  add('incapacidad_comun',   'Incapacidad común (66,67 %)', 'devengado', diasIncapComun,   vIncapComun,   8);
  add('incapacidad_laboral', 'Incapacidad laboral',         'devengado', diasIncapLaboral, vIncapLaboral, 9);

  // Comisiones: salariales. Bonificaciones: no salariales.
  const vComisiones = entrada.novedades.filter(n => n.tipo === 'comision')
    .reduce((s, n) => s + n.valor, 0);
  const vBonificaciones = entrada.novedades.filter(n => n.tipo === 'bonificacion')
    .reduce((s, n) => s + n.valor, 0);

  add('comision',     'Comisiones',      'devengado', 0, vComisiones,     10);
  add('bonificacion', 'Bonificaciones',  'devengado', 0, vBonificaciones, 11);

  // ── IBC ────────────────────────────────────────────────────────────────────
  // Entra lo salarial. Quedan fuera el auxilio de transporte (por ley) y las
  // bonificaciones ocasionales (no constitutivas de salario).
  const devengadoSalarial = salarioDevengado + vExtraDiurna + vExtraNocturna
    + vExtraDominical + vRecargoNoct + vDominical + vVacaciones
    + vIncapComun + vIncapLaboral + vComisiones;

  // Piso: 1 SMMLV proporcional a los días liquidados. Techo: 25 SMMLV.
  const proporcion = Math.min(entrada.dias_trabajados, DIAS_MES_COMERCIAL) / DIAS_MES_COMERCIAL;
  const ibcMinimo  = p.salario_minimo * proporcion;
  const ibcMaximo  = p.salario_minimo * 25;
  const ibc = pesos(Math.min(Math.max(devengadoSalarial, ibcMinimo), ibcMaximo));

  // ── Auxilio de transporte ──────────────────────────────────────────────────
  // Solo para quienes ganan hasta 2 SMMLV, proporcional a los días.
  const aplicaAuxilio = salarioBase <= p.salario_minimo * p.tope_auxilio_smmlv;
  const vAuxilio = aplicaAuxilio
    ? (p.auxilio_transporte / DIAS_MES_COMERCIAL) * (diasSalario + diasVacaciones)
    : 0;
  add('auxilio_transporte', 'Auxilio de transporte', 'devengado', 0, vAuxilio, 12);

  // ── Deducciones del trabajador ─────────────────────────────────────────────
  const vSalud   = ibc * (p.porc_salud_empleado / 100);
  const vPension = ibc * (p.porc_pension_empleado / 100);
  const porcFsp  = porcentajeFSP(ibc, p.salario_minimo);
  const vFsp     = ibc * (porcFsp / 100);

  add('salud',   `Salud (${p.porc_salud_empleado} %)`,     'deduccion', 0, vSalud,   20);
  add('pension', `Pensión (${p.porc_pension_empleado} %)`, 'deduccion', 0, vPension, 21);
  add('fsp',     `Fondo de solidaridad pensional (${porcFsp} %)`, 'deduccion', 0, vFsp, 22);

  const aportesObligatorios = vSalud + vPension + vFsp;

  const vRetencion = retencionEnLaFuente(devengadoSalarial, aportesObligatorios, p.uvt);
  add('retencion_fuente', 'Retención en la fuente', 'deduccion', 0, vRetencion, 23);

  const vPrestamos = entrada.novedades.filter(n => n.tipo === 'prestamo')
    .reduce((s, n) => s + n.valor, 0);
  const vAnticipos = entrada.novedades.filter(n => n.tipo === 'anticipo')
    .reduce((s, n) => s + n.valor, 0);
  const vOtros = entrada.novedades.filter(n => n.tipo === 'descuento_otro')
    .reduce((s, n) => s + n.valor, 0);

  add('prestamo',       'Préstamos',       'deduccion', 0, vPrestamos, 24);
  add('anticipo',       'Anticipos',       'deduccion', 0, vAnticipos, 25);
  add('descuento_otro', 'Otros descuentos','deduccion', 0, vOtros,     26);

  // ── Aportes del empleador ──────────────────────────────────────────────────
  // Exoneración del art. 114-1 ET: quien está exonerado no paga salud, ICBF ni
  // SENA por empleados que ganan menos de 10 SMMLV.
  const exonerado = !!entrada.empresa_exonerada_aportes && ibc < p.salario_minimo * 10;

  const eSalud   = exonerado ? 0 : ibc * (p.porc_salud_empleador / 100);
  const ePension = ibc * (p.porc_pension_empleador / 100);
  const eCaja    = ibc * (p.porc_caja_compensacion / 100);
  const eIcbf    = exonerado ? 0 : ibc * (p.porc_icbf / 100);
  const eSena    = exonerado ? 0 : ibc * (p.porc_sena / 100);
  const tarifaArl = TARIFAS_ARL[entrada.nivel_riesgo_arl ?? 'I'] ?? TARIFAS_ARL.I;
  const eArl     = ibc * (tarifaArl / 100);

  add('emp_salud',   'Salud (empleador)',            'aporte_empleador', 0, eSalud,   30);
  add('emp_pension', 'Pensión (empleador)',          'aporte_empleador', 0, ePension, 31);
  add('emp_arl',     `ARL nivel ${entrada.nivel_riesgo_arl ?? 'I'}`, 'aporte_empleador', 0, eArl, 32);
  add('emp_caja',    'Caja de compensación',         'aporte_empleador', 0, eCaja,    33);
  add('emp_icbf',    'ICBF',                         'aporte_empleador', 0, eIcbf,    34);
  add('emp_sena',    'SENA',                         'aporte_empleador', 0, eSena,    35);

  // ── Provisiones de prestaciones sociales ───────────────────────────────────
  // Base: salario + auxilio de transporte (el auxilio SÍ cuenta para prima y
  // cesantías, aunque no cotice a seguridad social).
  const basePrestacional = devengadoSalarial + vAuxilio;

  const prCesantias  = basePrestacional * (p.porc_cesantias / 100);
  const prIntereses  = basePrestacional * (p.porc_interes_cesantias / 100);
  const prPrima      = basePrestacional * (p.porc_prima / 100);
  const prVacaciones = devengadoSalarial * (p.porc_vacaciones / 100); // sin auxilio

  add('prov_cesantias',  'Provisión cesantías',            'provision', 0, prCesantias,  40);
  add('prov_intereses',  'Provisión intereses cesantías',  'provision', 0, prIntereses,  41);
  add('prov_prima',      'Provisión prima de servicios',   'provision', 0, prPrima,      42);
  add('prov_vacaciones', 'Provisión vacaciones',           'provision', 0, prVacaciones, 43);

  // ── Totales ────────────────────────────────────────────────────────────────
  const suma = (tipo: string) => conceptos
    .filter(c => c.tipo === tipo)
    .reduce((s, c) => s + c.valor, 0);

  const totalDevengado   = suma('devengado');
  const totalDeducciones = suma('deduccion');

  return {
    conceptos: conceptos.sort((a, b) => a.orden - b.orden),
    ibc,
    dias_liquidados:   diasSalario,
    total_devengado:   totalDevengado,
    total_deducciones: totalDeducciones,
    neto_pagar:        totalDevengado - totalDeducciones,
    aportes_empleador: suma('aporte_empleador'),
    provisiones:       suma('provision'),
  };
}

/**
 * costoTotalEmpleador — lo que de verdad cuesta un empleado.
 *
 * Es la cifra del "simulador": subir a alguien de 2 a 2,5 millones no cuesta
 * 500 mil, cuesta ese medio millón multiplicado por el factor prestacional.
 */
export function costoTotalEmpleador(r: ResultadoLiquidacion): number {
  return r.total_devengado + r.aportes_empleador + r.provisiones;
}
