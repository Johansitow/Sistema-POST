/**
 * Tests de utils/empleado.ts — la lógica de dominio del empleado que comparten
 * la ficha del administrador y el portal del trabajador.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  calcularAntiguedad, diasParaCumpleanos, construirAlertas, etiqueta,
  TIPO_CONTRATO_LABEL, ESTADO_LABORAL_LABEL,
} from '../utils/empleado';

// Fecha fija para que los tests no dependan del día en que se ejecuten
const HOY = new Date('2026-07-21T12:00:00');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(HOY);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Antigüedad ───────────────────────────────────────────────────────────────

describe('calcularAntiguedad', () => {
  it('devuelve null si no hay fecha de ingreso', () => {
    expect(calcularAntiguedad(null)).toBeNull();
    expect(calcularAntiguedad(undefined)).toBeNull();
  });

  it('devuelve null si la fecha es inválida', () => {
    expect(calcularAntiguedad('no-es-fecha')).toBeNull();
  });

  it('calcula años y meses', () => {
    const r = calcularAntiguedad('2024-03-21');
    expect(r).toEqual({ anios: 2, meses: 4, texto: '2 años y 4 meses' });
  });

  it('usa singular para un solo año o un solo mes', () => {
    expect(calcularAntiguedad('2025-06-21')?.texto).toBe('1 año y 1 mes');
  });

  it('omite la parte de meses cuando son exactos', () => {
    expect(calcularAntiguedad('2024-07-21')?.texto).toBe('2 años');
  });

  it('cuenta meses de calendario, no bloques de 30 días', () => {
    // Del 31 de enero al 21 de julio aún no se cumple el sexto mes:
    // faltan 10 días para el día 31.
    expect(calcularAntiguedad('2026-01-31')?.meses).toBe(5);
    // Del 21 de enero sí: se cumple justo hoy.
    expect(calcularAntiguedad('2026-01-21')?.meses).toBe(6);
  });

  it('reporta "Menos de un mes" para un ingreso reciente', () => {
    expect(calcularAntiguedad('2026-07-10')?.texto).toBe('Menos de un mes');
  });

  it('congela el cálculo en la fecha de retiro', () => {
    // Ingresó en 2024 y se retiró en 2025: la antigüedad no sigue corriendo
    const r = calcularAntiguedad('2024-01-21', '2025-01-21');
    expect(r?.texto).toBe('1 año');
  });

  it('devuelve null si la fecha de ingreso es futura', () => {
    expect(calcularAntiguedad('2027-01-01')).toBeNull();
  });
});

// ─── Cumpleaños ───────────────────────────────────────────────────────────────

describe('diasParaCumpleanos', () => {
  it('devuelve null sin fecha de nacimiento', () => {
    expect(diasParaCumpleanos(null)).toBeNull();
  });

  it('devuelve 0 el mismo día del cumpleaños', () => {
    expect(diasParaCumpleanos('1990-07-21')).toBe(0);
  });

  it('cuenta los días que faltan dentro del mismo año', () => {
    expect(diasParaCumpleanos('1990-07-28')).toBe(7);
  });

  it('salta al año siguiente si el cumpleaños ya pasó', () => {
    const dias = diasParaCumpleanos('1990-07-20');
    expect(dias).toBeGreaterThan(300);
  });
});

// ─── Etiquetas ────────────────────────────────────────────────────────────────

describe('etiqueta', () => {
  it('traduce el código a texto legible', () => {
    expect(etiqueta(TIPO_CONTRATO_LABEL, 'obra_labor')).toBe('Obra o labor');
    expect(etiqueta(ESTADO_LABORAL_LABEL, 'periodo_prueba')).toBe('Periodo de prueba');
  });

  it('devuelve null cuando no hay valor', () => {
    expect(etiqueta(TIPO_CONTRATO_LABEL, null)).toBeNull();
    expect(etiqueta(TIPO_CONTRATO_LABEL, undefined)).toBeNull();
  });
});

// ─── Alertas ──────────────────────────────────────────────────────────────────

describe('construirAlertas', () => {
  const completo = {
    estado_laboral: 'activo' as const,
    documento_identidad: '123',
    eps: 'Sura', afp: 'Porvenir', arl: 'Positiva',
    fecha_nacimiento: '1990-01-01',
  };

  it('no genera alertas si la ficha está completa', () => {
    expect(construirAlertas(completo)).toEqual([]);
  });

  it('avisa de los datos que faltan para poder liquidar nómina', () => {
    const alertas = construirAlertas({ ...completo, eps: null, arl: null });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidad).toBe('warning');
    expect(alertas[0].mensaje).toContain('EPS');
    expect(alertas[0].mensaje).toContain('ARL');
    expect(alertas[0].mensaje).not.toContain('pensiones');
  });

  it('avisa del cumpleaños dentro de la semana', () => {
    const alertas = construirAlertas({ ...completo, fecha_nacimiento: '1990-07-23' });
    expect(alertas.some(a => a.mensaje.includes('2 días'))).toBe(true);
  });

  it('no genera NINGUNA alerta para un empleado retirado', () => {
    // Un ex-empleado no necesita EPS ni felicitaciones de cumpleaños
    const alertas = construirAlertas({
      estado_laboral: 'retirado',
      documento_identidad: null, eps: null, afp: null, arl: null,
      fecha_nacimiento: '1990-07-21',
      fecha_retiro: '2026-06-30',
    });
    expect(alertas).toEqual([]);
  });
});
