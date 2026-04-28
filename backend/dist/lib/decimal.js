"use strict";
/**
 * decimal.ts - Helpers para Decimal de Prisma
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcularTotales = exports.calcularIVA = exports.toNumber = exports.toDecimal = void 0;
const library_1 = require("@prisma/client/runtime/library");
const toDecimal = (value) => new library_1.Decimal(value ?? 0);
exports.toDecimal = toDecimal;
const toNumber = (value) => Number(value ?? 0);
exports.toNumber = toNumber;
/** IVA Colombia 19% */
const calcularIVA = (subtotal) => subtotal.times(new library_1.Decimal('0.19'));
exports.calcularIVA = calcularIVA;
const calcularTotales = (subtotal, descuento = new library_1.Decimal(0), propina = new library_1.Decimal(0), costoDomicilio = new library_1.Decimal(0)) => {
    const subtotalFinal = subtotal.minus(descuento);
    const impuestos = (0, exports.calcularIVA)(subtotalFinal);
    const total = subtotalFinal.plus(impuestos).plus(propina).plus(costoDomicilio);
    return { subtotalFinal, impuestos, total };
};
exports.calcularTotales = calcularTotales;
//# sourceMappingURL=decimal.js.map