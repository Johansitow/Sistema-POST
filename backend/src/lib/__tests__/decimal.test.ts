import { describe, it, expect } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { toDecimal, toNumber, calcularTotales } from '../decimal';

describe('toDecimal', () => {
  it('convierte número', () => {
    expect(toDecimal(100).toString()).toBe('100');
  });

  it('convierte string', () => {
    expect(toDecimal('99.99').toString()).toBe('99.99');
  });

  it('null → 0', () => {
    expect(toDecimal(null).toString()).toBe('0');
  });

  it('undefined → 0', () => {
    expect(toDecimal(undefined).toString()).toBe('0');
  });
});

describe('toNumber', () => {
  it('convierte Decimal a number', () => {
    expect(toNumber(new Decimal('42.5'))).toBe(42.5);
  });

  it('null → 0', () => {
    expect(toNumber(null)).toBe(0);
  });
});

describe('calcularTotales', () => {
  it('sin descuento ni propina ni domicilio', () => {
    const { subtotalFinal, impuestos, total } = calcularTotales(new Decimal(100));
    expect(Number(subtotalFinal)).toBe(100);
    expect(Number(impuestos)).toBe(19);
    expect(Number(total)).toBe(119);
  });

  it('con descuento', () => {
    const { subtotalFinal, total } = calcularTotales(
      new Decimal(100), new Decimal(10)
    );
    // subtotalFinal = 90, iva = 17.1, total = 107.1
    expect(Number(subtotalFinal)).toBe(90);
    expect(Number(total)).toBeCloseTo(107.1, 2);
  });

  it('con propina', () => {
    const { total } = calcularTotales(
      new Decimal(100), new Decimal(0), new Decimal(15)
    );
    // 100 - 0 = 100, iva 19 = 19, + 15 propina = 134
    expect(Number(total)).toBe(134);
  });

  it('con costo domicilio', () => {
    const { total } = calcularTotales(
      new Decimal(100), new Decimal(0), new Decimal(0), new Decimal(8)
    );
    expect(Number(total)).toBe(127); // 100 + 19 + 8
  });
});
