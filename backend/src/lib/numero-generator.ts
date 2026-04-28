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

const extraerSecuencia = (ultimo: string | null, _prefijo: string): number => {
  if (!ultimo) return 1;
  const partes = ultimo.split('-');
  const num = parseInt(partes[partes.length - 1], 10);
  return isNaN(num) ? 1 : num + 1;
};

const formatear = (prefijo: string, secuencia: number): string =>
  `${prefijo}-${String(secuencia).padStart(6, '0')}`;

export const generarNumeroOrden = (ultimoNumero: string | null): string =>
  formatear('ORD', extraerSecuencia(ultimoNumero, 'ORD'));

export const generarNumeroFactura = (ultimoNumero: string | null): string =>
  formatear('FAC', extraerSecuencia(ultimoNumero, 'FAC'));

export const generarNumeroCierre = (ultimoNumero: string | null): string =>
  formatear('CIERRE', extraerSecuencia(ultimoNumero, 'CIERRE'));

/**
 * generarNumeroLote — formato global LOTE-000001
 * Secuencial global sin depender del SKU del producto.
 * Escalable: funciona igual con 10 o 10.000 lotes.
 */
export const generarNumeroLote = (ultimoNumero: string | null): string =>
  formatear('LOTE', extraerSecuencia(ultimoNumero, 'LOTE'));
