"use strict";
/**
 * numero-generator — Generadores de números secuenciales con prefijo
 *
 * Formato: PREFIJO-000001
 * Busca el último número usado y suma 1.
 * Si no hay registros previos, comienza en 000001.
 *
 * Exporta:
 * - generarNumeroOrden()   → ORD-000001
 * - generarNumeroFactura() → FAC-000001
 * - generarNumeroCierre()  → CIERRE-000001
 * - generarNumeroLote()    → LOTE-000001
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generarNumeroLote = exports.generarNumeroCierre = exports.generarNumeroFactura = exports.generarNumeroOrden = void 0;
const extraerSecuencia = (ultimo, _prefijo) => {
    if (!ultimo)
        return 1;
    const partes = ultimo.split('-');
    const num = parseInt(partes[partes.length - 1], 10);
    return isNaN(num) ? 1 : num + 1;
};
const formatear = (prefijo, secuencia) => `${prefijo}-${String(secuencia).padStart(6, '0')}`;
const generarNumeroOrden = (ultimoNumero) => formatear('ORD', extraerSecuencia(ultimoNumero, 'ORD'));
exports.generarNumeroOrden = generarNumeroOrden;
const generarNumeroFactura = (ultimoNumero) => formatear('FAC', extraerSecuencia(ultimoNumero, 'FAC'));
exports.generarNumeroFactura = generarNumeroFactura;
const generarNumeroCierre = (ultimoNumero) => formatear('CIERRE', extraerSecuencia(ultimoNumero, 'CIERRE'));
exports.generarNumeroCierre = generarNumeroCierre;
/**
 * generarNumeroLote — formato global LOTE-000001
 * Secuencial global sin depender del SKU del producto.
 * Escalable: funciona igual con 10 o 10.000 lotes.
 */
const generarNumeroLote = (ultimoNumero) => formatear('LOTE', extraerSecuencia(ultimoNumero, 'LOTE'));
exports.generarNumeroLote = generarNumeroLote;
//# sourceMappingURL=numero-generator.js.map