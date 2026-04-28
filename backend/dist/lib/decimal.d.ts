/**
 * decimal.ts - Helpers para Decimal de Prisma
 */
import { Decimal } from '@prisma/client/runtime/library';
export declare const toDecimal: (value: number | string | null | undefined) => Decimal;
export declare const toNumber: (value: Decimal | null | undefined) => number;
/** IVA Colombia 19% */
export declare const calcularIVA: (subtotal: Decimal) => Decimal;
export declare const calcularTotales: (subtotal: Decimal, descuento?: Decimal, propina?: Decimal, costoDomicilio?: Decimal) => {
    subtotalFinal: Decimal;
    impuestos: Decimal;
    total: Decimal;
};
//# sourceMappingURL=decimal.d.ts.map