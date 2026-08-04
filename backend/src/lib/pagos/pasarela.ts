/**
 * pasarela.ts — Contrato de la pasarela de pagos, agnóstico al proveedor.
 *
 * Toda la app habla contra `PasarelaPagos`; el driver concreto (Wompi real o
 * noop de desarrollo) se elige por config (PAGOS_DRIVER). Molde: logoStorage.ts.
 *
 * Incluye helpers PUROS de cripto y dinero (sin efectos secundarios), usados por
 * el driver real, el servicio de webhook y los tests:
 *   - pesosACentavos / centavosAPesos: frontera COP(Decimal 12,2) ↔ centavos Wompi.
 *   - firmaIntegridad: firma que Wompi exige al crear una transacción.
 *   - verificarFirmaEvento: valida la firma de un evento de webhook (anti-spoofing).
 */

import crypto from 'crypto';

export type MetodoPasarela = 'nequi' | 'pse' | 'tarjeta';

/** Estado normalizado de una transacción, independiente del proveedor. */
export type EstadoPasarela = 'aprobada' | 'pendiente' | 'rechazada' | 'error' | 'anulada';

export interface CrearTransaccionParams {
  referencia:     string;
  montoCentavos:  number;
  emailCliente:   string;
  metodo:         MetodoPasarela;
  /** Nequi recurrente: id de la fuente de pago tokenizada (cobro sin interacción). */
  paymentSourceId?: string;
  /** Datos puntuales del método cuando no hay token: Nequi {phone_number}, PSE {...}. */
  datosMetodo?:   Record<string, unknown>;
  /** PSE devuelve una URL de redirección asíncrona. */
  redirectUrl?:   string;
}

export interface ResultadoTransaccion {
  wompiTransactionId: string | null;
  estado:             EstadoPasarela;
  /** PSE: URL a la que redirigir al usuario para completar el pago. */
  urlRedireccion?:    string | null;
  raw?:               unknown;
}

export interface CrearFuentePagoParams {
  tipo:         'nequi' | 'card';
  emailCliente: string;
  /** Nequi: { phone_number }. Tarjeta: { token }. */
  datos:        Record<string, unknown>;
}

export interface ResultadoFuentePago {
  paymentSourceId: string | null;
  estado:          EstadoPasarela;
  raw?:            unknown;
}

export interface PasarelaPagos {
  /** true si el driver activo es real (con llaves); false para el noop de dev. */
  disponible(): boolean;
  getAcceptanceToken(): Promise<string | null>;
  crearFuentePago(p: CrearFuentePagoParams): Promise<ResultadoFuentePago>;
  crearTransaccion(p: CrearTransaccionParams): Promise<ResultadoTransaccion>;
  obtenerTransaccion(id: string): Promise<ResultadoTransaccion>;
}

// ─── Dinero: frontera COP ↔ centavos ────────────────────────────────────────────

/** COP en unidades (Decimal 12,2) → centavos enteros que espera Wompi. */
export function pesosACentavos(cop: number | string): number {
  return Math.round(Number(cop) * 100);
}

/** Centavos de Wompi → COP en unidades. */
export function centavosAPesos(centavos: number): number {
  return centavos / 100;
}

// ─── Firmas ─────────────────────────────────────────────────────────────────────

/**
 * Firma de integridad que Wompi exige al crear una transacción:
 * SHA256 de `${referencia}${centavos}${moneda}${integritySecret}`.
 */
export function firmaIntegridad(
  referencia: string,
  montoCentavos: number,
  moneda: string,
  integritySecret: string,
): string {
  return crypto
    .createHash('sha256')
    .update(`${referencia}${montoCentavos}${moneda}${integritySecret}`)
    .digest('hex');
}

/** Estructura mínima de un evento de webhook de Wompi. */
export interface EventoWompi {
  event?:     string;
  data?:      Record<string, unknown>;
  timestamp?: number;
  signature?: { checksum?: string; properties?: string[] };
  [k: string]: unknown;
}

/** Lee una ruta con puntos ("transaction.id") dentro de un objeto anidado. */
function leerRuta(obj: unknown, ruta: string): string {
  const val = ruta.split('.').reduce<unknown>(
    (acc, key) => (acc != null && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
  return val == null ? '' : String(val);
}

/** Comparación de hex en tiempo constante (evita fugas por timing). */
function hexEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/**
 * Verifica la firma de un evento de Wompi:
 * checksum == SHA256( concat(valores de signature.properties) + timestamp + eventsSecret ).
 * Las properties son rutas relativas a `data` (ej. "transaction.id", "transaction.status").
 */
export function verificarFirmaEvento(evento: EventoWompi, eventsSecret: string): boolean {
  const sig = evento?.signature;
  if (!eventsSecret || !sig?.checksum || !Array.isArray(sig.properties) || evento.timestamp == null) {
    return false;
  }
  const concatValores = sig.properties.map((p) => leerRuta(evento.data, p)).join('');
  const cadena = `${concatValores}${evento.timestamp}${eventsSecret}`;
  const esperado = crypto.createHash('sha256').update(cadena).digest('hex');
  return hexEqual(esperado, sig.checksum);
}

/** Mapea el estado textual de Wompi a nuestro estado normalizado. */
export function mapEstadoWompi(status: unknown): EstadoPasarela {
  switch (String(status).toUpperCase()) {
    case 'APPROVED': return 'aprobada';
    case 'PENDING':  return 'pendiente';
    case 'DECLINED': return 'rechazada';
    case 'VOIDED':   return 'anulada';
    case 'ERROR':    return 'error';
    default:         return 'pendiente';
  }
}
