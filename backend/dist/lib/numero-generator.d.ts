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
export declare const generarNumeroOrden: (ultimoNumero: string | null) => string;
export declare const generarNumeroFactura: (ultimoNumero: string | null) => string;
export declare const generarNumeroCierre: (ultimoNumero: string | null) => string;
/**
 * generarNumeroLote — formato global LOTE-000001
 * Secuencial global sin depender del SKU del producto.
 * Escalable: funciona igual con 10 o 10.000 lotes.
 */
export declare const generarNumeroLote: (ultimoNumero: string | null) => string;
//# sourceMappingURL=numero-generator.d.ts.map