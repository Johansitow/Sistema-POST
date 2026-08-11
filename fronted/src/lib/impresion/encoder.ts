/**
 * encoder.ts — Envoltorio de dominio sobre ReceiptPrinterEncoder (ESC/POS).
 *
 * Expone primitivas simples (centro, dos columnas, divisor, qr, corte, cajón)
 * pensadas para tickets de restaurante, con ancho por columnas (58mm=32, 80mm=48).
 * Devuelve `Uint8Array` de comandos ESC/POS listos para enviar a la impresora.
 */

import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

export function columnasDe(ancho: string | number | undefined): number {
  // Acepta '58', '58mm', 58… → 32 columnas; el resto (80mm) → 48.
  return String(ancho ?? '').replace('mm', '').trim() === '58' ? 32 : 48;
}

export class TicketEncoder {
  private enc: any;
  readonly cols: number;

  constructor(ancho: string | number = '80') {
    this.cols = columnasDe(ancho);
    this.enc = new ReceiptPrinterEncoder({ columns: this.cols });
    this.enc.initialize();
    try { this.enc.codepage('cp850'); } catch { /* algunos modelos no soportan cp850 */ }
  }

  /** Línea centrada, opcionalmente en negrita. */
  centro(texto: string, opts: { bold?: boolean } = {}): this {
    this.enc.align('center');
    if (opts.bold) this.enc.bold(true);
    this.enc.line(texto);
    if (opts.bold) this.enc.bold(false);
    this.enc.align('left');
    return this;
  }

  /** Línea a la izquierda (texto libre). */
  linea(texto = ''): this {
    this.enc.align('left').line(texto);
    return this;
  }

  /** Dos columnas: etiqueta a la izquierda, valor a la derecha, alineado al ancho. */
  dosColumnas(izq: string, der: string): this {
    const disponible = this.cols - izq.length - der.length;
    const relleno = disponible > 0 ? ' '.repeat(disponible) : ' ';
    this.enc.align('left').line(`${izq}${relleno}${der}`);
    return this;
  }

  /** Texto grande (doble alto/ancho) — para totales o ítems de comanda. */
  grande(texto: string): this {
    this.enc.align('left').width(2).height(2).line(texto).width(1).height(1);
    return this;
  }

  /** Divisor de guiones del ancho del papel. */
  divisor(): this {
    this.enc.align('left').line('-'.repeat(this.cols));
    return this;
  }

  /** Código QR centrado (ej. CUFE de la factura electrónica). */
  qr(data: string): this {
    this.enc.align('center');
    this.enc.qrcode(data, { model: 2, size: 6, errorlevel: 'm' });
    this.enc.align('left');
    return this;
  }

  /** Avance de papel (líneas en blanco antes del corte). */
  avanzar(n = 3): this {
    for (let i = 0; i < n; i++) this.enc.newline();
    return this;
  }

  /** Corte parcial del papel. */
  cortar(): this {
    this.enc.cut('partial');
    return this;
  }

  /** Pulso de apertura del cajón monedero. */
  abrirCajon(): this {
    this.enc.pulse();
    return this;
  }

  /** Bytes ESC/POS finales. */
  bytes(): Uint8Array {
    return this.enc.encode();
  }
}
