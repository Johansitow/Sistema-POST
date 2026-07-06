/**
 * decimal.ts - Helpers para Decimal de Prisma
 */

import { Decimal } from '@prisma/client/runtime/library';

export const toDecimal = (value: number | string | null | undefined): Decimal =>
  new Decimal(value ?? 0);

export const toNumber = (value: Decimal | null | undefined): number =>
  Number(value ?? 0);

export const calcularTotales = (
  subtotal: Decimal,
  descuento: Decimal = new Decimal(0),
  propina: Decimal = new Decimal(0),
  costoDomicilio: Decimal = new Decimal(0),
  /** Tasa de IVA como número (ej: 19). null o 0 → sin impuestos */
  tasaIva: number | null = 19
): { subtotalFinal: Decimal; impuestos: Decimal; total: Decimal } => {
  const subtotalFinal = subtotal.minus(descuento);
  const impuestos = (tasaIva && tasaIva > 0)
    ? subtotalFinal.times(new Decimal(tasaIva).div(100))
    : new Decimal(0);
  const total = subtotalFinal.plus(impuestos).plus(propina).plus(costoDomicilio);
  return { subtotalFinal, impuestos, total };
};
