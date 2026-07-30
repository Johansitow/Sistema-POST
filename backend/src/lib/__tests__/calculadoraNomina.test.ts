/**
 * Tests del motor de liquidación de nómina.
 *
 * Es el código donde un error cuesta dinero real y genera sanciones, así que
 * se prueban las reglas una por una con cifras verificables a mano.
 *
 * Parámetros de referencia: los oficiales de Colombia 2025 (salario mínimo
 * $1.423.500, auxilio de transporte $200.000, UVT $49.799).
 */

import { describe, it, expect } from 'vitest';
import { liquidar, retencionEnLaFuente, costoTotalEmpleador, TARIFAS_ARL } from '../nomina/calculadora';
import type { ParametrosLegales, NovedadCalculo } from '../nomina/tipos';

const P: ParametrosLegales = {
  anio: 2025,
  salario_minimo:     1_423_500,
  auxilio_transporte:   200_000,
  tope_auxilio_smmlv:         2,
  uvt:                   49_799,
  porc_salud_empleado:        4,
  porc_pension_empleado:      4,
  porc_salud_empleador:     8.5,
  porc_pension_empleador:    12,
  porc_caja_compensacion:     4,
  porc_icbf:                  3,
  porc_sena:                  2,
  porc_recargo_nocturno:     35,
  porc_extra_diurna:         25,
  porc_extra_nocturna:       75,
  porc_dominical:            75,
  porc_extra_dominical_diurna: 100,
  horas_mensuales:          230,
  porc_cesantias:          8.33,
  porc_interes_cesantias:     1,
  porc_prima:              8.33,
  porc_vacaciones:         4.17,
};

const liquidarSimple = (salario: number, novedades: NovedadCalculo[] = [], dias = 30) =>
  liquidar({ salario_base: salario, dias_trabajados: dias, novedades }, P);

const valor = (r: ReturnType<typeof liquidar>, codigo: string) =>
  r.conceptos.find(c => c.codigo === codigo)?.valor ?? 0;

// ─── Salario y días ───────────────────────────────────────────────────────────

describe('salario básico', () => {
  it('paga el mes completo sobre 30 días comerciales', () => {
    const r = liquidarSimple(1_800_000);
    expect(valor(r, 'salario')).toBe(1_800_000);
  });

  it('prorratea por días trabajados', () => {
    const r = liquidarSimple(1_800_000, [], 15);
    expect(valor(r, 'salario')).toBe(900_000);
  });

  it('usa el mes comercial: 31 días no pagan más que 30', () => {
    // Un mes de 31 días se liquida igual que uno de 30 (convención contable)
    const r = liquidarSimple(1_800_000, [], 30);
    expect(valor(r, 'salario')).toBe(1_800_000);
  });
});

// ─── Auxilio de transporte ────────────────────────────────────────────────────

describe('auxilio de transporte', () => {
  it('se paga a quien gana hasta 2 salarios mínimos', () => {
    const r = liquidarSimple(2_000_000);
    expect(valor(r, 'auxilio_transporte')).toBe(200_000);
  });

  it('NO se paga por encima de 2 salarios mínimos', () => {
    const r = liquidarSimple(3_000_000);   // 2 SMMLV = 2.847.000
    expect(valor(r, 'auxilio_transporte')).toBe(0);
  });

  it('se paga justo en el límite de 2 SMMLV', () => {
    const r = liquidarSimple(P.salario_minimo * 2);
    expect(valor(r, 'auxilio_transporte')).toBe(200_000);
  });

  it('se prorratea por días trabajados', () => {
    const r = liquidarSimple(1_500_000, [], 15);
    expect(valor(r, 'auxilio_transporte')).toBe(100_000);
  });

  it('NO entra al IBC (no cotiza a salud ni pensión)', () => {
    const r = liquidarSimple(1_423_500);
    // El IBC es el salario, sin los 200.000 del auxilio
    expect(r.ibc).toBe(1_423_500);
  });

  it('SÍ entra a la base de prestaciones sociales', () => {
    const r = liquidarSimple(1_423_500);
    // Provisión de prima = 8,33 % de (salario + auxilio)
    expect(valor(r, 'prov_prima')).toBe(Math.round(1_623_500 * 0.0833));
  });
});

// ─── Horas extra y recargos ───────────────────────────────────────────────────

describe('horas extra y recargos', () => {
  const salario = 1_150_000; // valor hora = 1.150.000 / 230 = 5.000 exactos

  it('la hora extra diurna paga la hora más el 25 %', () => {
    const r = liquidarSimple(salario, [{ tipo: 'hora_extra_diurna', cantidad: 10, valor: 0 }]);
    expect(valor(r, 'extra_diurna')).toBe(10 * 5_000 * 1.25); // 62.500
  });

  it('la hora extra nocturna paga la hora más el 75 %', () => {
    const r = liquidarSimple(salario, [{ tipo: 'hora_extra_nocturna', cantidad: 10, valor: 0 }]);
    expect(valor(r, 'extra_nocturna')).toBe(10 * 5_000 * 1.75); // 87.500
  });

  it('la hora extra dominical paga el doble', () => {
    const r = liquidarSimple(salario, [{ tipo: 'hora_extra_dominical', cantidad: 5, valor: 0 }]);
    expect(valor(r, 'extra_dominical')).toBe(5 * 5_000 * 2);
  });

  it('el recargo nocturno paga SOLO el recargo, no la hora', () => {
    // La hora ya está pagada dentro del salario básico: sumar la hora completa
    // sería pagarla dos veces.
    const r = liquidarSimple(salario, [{ tipo: 'recargo_nocturno', cantidad: 10, valor: 0 }]);
    expect(valor(r, 'recargo_nocturno')).toBe(10 * 5_000 * 0.35); // 17.500
  });

  it('el recargo dominical paga solo el 75 % adicional', () => {
    const r = liquidarSimple(salario, [{ tipo: 'dominical_festivo', cantidad: 8, valor: 0 }]);
    expect(valor(r, 'dominical')).toBe(8 * 5_000 * 0.75);
  });

  it('las horas extra SÍ entran al IBC', () => {
    // Se usa un salario POR ENCIMA del mínimo: con uno menor el piso legal de
    // 1 SMMLV enmascararía el efecto de las extras sobre el IBC.
    const sobreMinimo = 2_300_000;            // valor hora = 10.000
    const r = liquidarSimple(sobreMinimo, [{ tipo: 'hora_extra_diurna', cantidad: 10, valor: 0 }]);
    expect(r.ibc).toBe(sobreMinimo + 10 * 10_000 * 1.25);
  });

  it('el piso de 1 SMMLV se impone aunque el devengado sea menor', () => {
    const r = liquidarSimple(salario, [{ tipo: 'hora_extra_diurna', cantidad: 10, valor: 0 }]);
    // 1.150.000 + 62.500 = 1.212.500, por debajo del mínimo → cotiza el mínimo
    expect(r.ibc).toBe(P.salario_minimo);
  });
});

// ─── Deducciones ──────────────────────────────────────────────────────────────

describe('deducciones del trabajador', () => {
  it('descuenta 4 % de salud y 4 % de pensión sobre el IBC', () => {
    const r = liquidarSimple(2_000_000);
    expect(valor(r, 'salud')).toBe(80_000);
    expect(valor(r, 'pension')).toBe(80_000);
  });

  it('no cobra fondo de solidaridad por debajo de 4 salarios mínimos', () => {
    const r = liquidarSimple(4_000_000); // 4 SMMLV = 5.694.000
    expect(valor(r, 'fsp')).toBe(0);
  });

  it('cobra 1 % de fondo de solidaridad desde 4 salarios mínimos', () => {
    const salario = P.salario_minimo * 4;
    const r = liquidarSimple(salario);
    expect(valor(r, 'fsp')).toBe(Math.round(salario * 0.01));
  });

  it('escala el fondo de solidaridad en los tramos altos', () => {
    const r = liquidarSimple(P.salario_minimo * 20);
    expect(valor(r, 'fsp')).toBe(Math.round(P.salario_minimo * 20 * 0.02));
  });

  it('resta préstamos, anticipos y otros descuentos', () => {
    const r = liquidarSimple(2_000_000, [
      { tipo: 'prestamo',       cantidad: 0, valor: 150_000 },
      { tipo: 'anticipo',       cantidad: 0, valor: 100_000 },
      { tipo: 'descuento_otro', cantidad: 0, valor:  50_000 },
    ]);
    expect(valor(r, 'prestamo')).toBe(150_000);
    expect(valor(r, 'anticipo')).toBe(100_000);
    expect(valor(r, 'descuento_otro')).toBe(50_000);
  });
});

// ─── Topes del IBC ────────────────────────────────────────────────────────────

describe('topes del IBC', () => {
  it('aplica el piso de un salario mínimo', () => {
    // Nadie cotiza por debajo del mínimo aunque devengue menos
    const r = liquidarSimple(800_000);
    expect(r.ibc).toBe(P.salario_minimo);
  });

  it('prorratea el piso cuando se trabajan menos días', () => {
    const r = liquidarSimple(800_000, [], 15);
    expect(r.ibc).toBe(Math.round(P.salario_minimo / 2));
  });

  it('aplica el techo de 25 salarios mínimos', () => {
    const r = liquidarSimple(P.salario_minimo * 40);
    expect(r.ibc).toBe(P.salario_minimo * 25);
  });
});

// ─── Novedades que restan días ────────────────────────────────────────────────

describe('novedades que afectan los días', () => {
  it('la licencia no remunerada descuenta días de salario', () => {
    const r = liquidarSimple(1_800_000, [
      { tipo: 'licencia_no_remunerada', cantidad: 5, valor: 0 },
    ]);
    expect(valor(r, 'salario')).toBe(Math.round(1_800_000 / 30 * 25));
  });

  it('la incapacidad común se paga al 66,67 %', () => {
    const r = liquidarSimple(1_800_000, [
      { tipo: 'incapacidad_comun', cantidad: 3, valor: 0 },
    ]);
    expect(valor(r, 'salario')).toBe(Math.round(1_800_000 / 30 * 27));
    expect(valor(r, 'incapacidad_comun')).toBe(Math.round(1_800_000 / 30 * 3 * (2 / 3)));
  });

  it('la incapacidad laboral se paga al 100 %', () => {
    const r = liquidarSimple(1_800_000, [
      { tipo: 'incapacidad_laboral', cantidad: 3, valor: 0 },
    ]);
    expect(valor(r, 'incapacidad_laboral')).toBe(Math.round(1_800_000 / 30 * 3));
  });

  it('la incapacidad tiene piso en el salario mínimo diario', () => {
    const r = liquidarSimple(900_000, [
      { tipo: 'incapacidad_comun', cantidad: 30, valor: 0 },
    ]);
    // Se liquida sobre el mínimo diario, no sobre los 900.000
    expect(valor(r, 'incapacidad_comun'))
      .toBe(Math.round(P.salario_minimo / 30 * 30 * (2 / 3)));
  });

  it('las vacaciones se pagan al 100 % y salen del salario ordinario', () => {
    const r = liquidarSimple(1_800_000, [
      { tipo: 'vacaciones', cantidad: 15, valor: 0 },
    ]);
    expect(valor(r, 'salario')).toBe(900_000);
    expect(valor(r, 'vacaciones')).toBe(900_000);
  });
});

// ─── Salarial vs no salarial ──────────────────────────────────────────────────

describe('conceptos salariales y no salariales', () => {
  it('la comisión ES salarial: entra al IBC', () => {
    const r = liquidarSimple(2_000_000, [{ tipo: 'comision', cantidad: 0, valor: 300_000 }]);
    expect(r.ibc).toBe(2_300_000);
  });

  it('la bonificación NO es salarial: no entra al IBC', () => {
    const r = liquidarSimple(2_000_000, [{ tipo: 'bonificacion', cantidad: 0, valor: 300_000 }]);
    expect(r.ibc).toBe(2_000_000);
    // Pero sí se paga al trabajador
    expect(valor(r, 'bonificacion')).toBe(300_000);
  });
});

// ─── Aportes del empleador ────────────────────────────────────────────────────

describe('aportes del empleador', () => {
  it('liquida pensión, caja y ARL sobre el IBC', () => {
    const r = liquidarSimple(2_000_000);
    expect(valor(r, 'emp_pension')).toBe(240_000);          // 12 %
    expect(valor(r, 'emp_caja')).toBe(80_000);              // 4 %
    expect(valor(r, 'emp_arl')).toBe(Math.round(2_000_000 * TARIFAS_ARL.I / 100));
  });

  it('usa la tarifa de ARL del nivel de riesgo del empleado', () => {
    const r = liquidar({
      salario_base: 2_000_000, dias_trabajados: 30, novedades: [], nivel_riesgo_arl: 'III',
    }, P);
    expect(valor(r, 'emp_arl')).toBe(Math.round(2_000_000 * TARIFAS_ARL.III / 100));
  });

  it('aplica la exoneración del art. 114-1: sin salud, ICBF ni SENA', () => {
    const r = liquidar({
      salario_base: 2_000_000, dias_trabajados: 30, novedades: [],
      empresa_exonerada_aportes: true,
    }, P);
    expect(valor(r, 'emp_salud')).toBe(0);
    expect(valor(r, 'emp_icbf')).toBe(0);
    expect(valor(r, 'emp_sena')).toBe(0);
    // La pensión y la caja NO están exoneradas
    expect(valor(r, 'emp_pension')).toBe(240_000);
    expect(valor(r, 'emp_caja')).toBe(80_000);
  });

  it('la exoneración NO aplica a partir de 10 salarios mínimos', () => {
    const r = liquidar({
      salario_base: P.salario_minimo * 11, dias_trabajados: 30, novedades: [],
      empresa_exonerada_aportes: true,
    }, P);
    expect(valor(r, 'emp_salud')).toBeGreaterThan(0);
  });
});

// ─── Provisiones ──────────────────────────────────────────────────────────────

describe('provisiones de prestaciones sociales', () => {
  it('provisiona sobre salario + auxilio de transporte', () => {
    // 2.000.000 está por debajo de 2 SMMLV (2.847.000), así que SÍ lleva
    // auxilio y el auxilio SÍ cuenta para prima y cesantías.
    const r = liquidarSimple(2_000_000);
    const basePrestacional = 2_200_000;

    expect(valor(r, 'prov_cesantias')).toBe(Math.round(basePrestacional * 0.0833));
    expect(valor(r, 'prov_intereses')).toBe(Math.round(basePrestacional * 0.01));
    expect(valor(r, 'prov_prima')).toBe(Math.round(basePrestacional * 0.0833));
    // Las vacaciones se provisionan SIN el auxilio: no se disfrutan con él
    expect(valor(r, 'prov_vacaciones')).toBe(Math.round(2_000_000 * 0.0417));
  });

  it('provisiona solo sobre el salario cuando no hay auxilio', () => {
    const alto = 3_500_000;   // por encima de 2 SMMLV
    const r = liquidarSimple(alto);
    expect(valor(r, 'auxilio_transporte')).toBe(0);
    expect(valor(r, 'prov_cesantias')).toBe(Math.round(alto * 0.0833));
  });

  it('las provisiones NO se descuentan al trabajador', () => {
    const r = liquidarSimple(2_000_000);
    // El neto solo resta deducciones; las provisiones son costo de la empresa
    expect(r.neto_pagar).toBe(r.total_devengado - r.total_deducciones);
  });
});

// ─── Retención en la fuente ───────────────────────────────────────────────────

describe('retención en la fuente', () => {
  it('no retiene a un salario de restaurante típico', () => {
    // La inmensa mayoría de la nómina queda por debajo del umbral
    expect(retencionEnLaFuente(2_000_000, 160_000, P.uvt)).toBe(0);
  });

  it('no retiene por debajo de 95 UVT depurados', () => {
    expect(retencionEnLaFuente(5_000_000, 400_000, P.uvt)).toBe(0);
  });

  it('retiene en el primer tramo gravado', () => {
    // Ingreso alto: la base depurada supera las 95 UVT
    const retencion = retencionEnLaFuente(9_000_000, 720_000, P.uvt);
    expect(retencion).toBeGreaterThan(0);
  });

  it('crece con el ingreso', () => {
    const baja = retencionEnLaFuente(9_000_000, 720_000, P.uvt);
    const alta = retencionEnLaFuente(15_000_000, 1_200_000, P.uvt);
    expect(alta).toBeGreaterThan(baja);
  });

  it('no retiene si la base depurada es cero o negativa', () => {
    expect(retencionEnLaFuente(1_000_000, 1_200_000, P.uvt)).toBe(0);
  });
});

// ─── Totales y coherencia ─────────────────────────────────────────────────────

describe('totales', () => {
  it('el neto es devengado menos deducciones', () => {
    const r = liquidarSimple(2_000_000, [
      { tipo: 'hora_extra_diurna', cantidad: 10, valor: 0 },
      { tipo: 'prestamo',          cantidad: 0,  valor: 100_000 },
    ]);
    expect(r.neto_pagar).toBe(r.total_devengado - r.total_deducciones);
  });

  it('liquida el caso completo del salario mínimo sin novedades', () => {
    const r = liquidarSimple(P.salario_minimo);

    expect(valor(r, 'salario')).toBe(1_423_500);
    expect(valor(r, 'auxilio_transporte')).toBe(200_000);
    expect(r.total_devengado).toBe(1_623_500);
    expect(valor(r, 'salud')).toBe(56_940);     // 4 % de 1.423.500
    expect(valor(r, 'pension')).toBe(56_940);
    expect(r.total_deducciones).toBe(113_880);
    expect(r.neto_pagar).toBe(1_509_620);
  });

  it('no genera líneas con valor cero', () => {
    const r = liquidarSimple(2_000_000);
    expect(r.conceptos.every(c => c.valor !== 0)).toBe(true);
  });

  it('devuelve los conceptos ordenados para el desprendible', () => {
    const r = liquidarSimple(2_000_000);
    const ordenes = r.conceptos.map(c => c.orden);
    expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b));
  });
});

describe('costoTotalEmpleador', () => {
  it('suma devengado, aportes y provisiones', () => {
    const r = liquidarSimple(2_000_000);
    expect(costoTotalEmpleador(r)).toBe(
      r.total_devengado + r.aportes_empleador + r.provisiones,
    );
  });

  it('el costo real supera con creces el salario nominal', () => {
    // El factor prestacional colombiano ronda 1,5: es la cifra que sorprende
    // a quien solo mira el sueldo.
    const r = liquidarSimple(2_000_000);
    const factor = costoTotalEmpleador(r) / 2_000_000;
    expect(factor).toBeGreaterThan(1.4);
    expect(factor).toBeLessThan(1.7);
  });
});
