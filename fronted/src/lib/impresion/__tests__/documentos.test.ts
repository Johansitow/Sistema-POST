import { describe, it, expect } from 'vitest';
import { recibo, comanda, cierre, kickCajon } from '../documentos';
import { columnasDe } from '../encoder';
import type { PrintOrden, PrintNegocio, PrintPago } from '../../plantillas/ticketRenderer';

const negocio: PrintNegocio = { nombre: 'Mi Restaurante', nit: '900123', telefono: '3001112233', ciudad: 'Bogotá' };
const orden: PrintOrden = {
  numero_orden: 'ORD-000042', tipo_orden: 'local', fecha_apertura: '2026-08-06T14:00:00.000Z',
  detalles: [
    { nombre: 'Café', cantidad: 2, precio_unitario: 5000 },
    { nombre: 'Pan', cantidad: 1, precio_unitario: 3000, variante: 'Integral', notas: 'Sin azúcar' },
  ],
  subtotal: 13000, impuestos: 0, total: 13000,
};
const pagos: PrintPago[] = [{ metodo: 'Efectivo', monto: 13000 }];

const decode = (b: Uint8Array) => new TextDecoder('latin1').decode(b);
/** ¿La secuencia contiene estos bytes de control? */
function contieneBytes(b: Uint8Array, seq: number[]): boolean {
  outer: for (let i = 0; i <= b.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) if (b[i + j] !== seq[j]) continue outer;
    return true;
  }
  return false;
}
const ESC_INIT = [0x1b, 0x40];   // ESC @
const GS_CUT   = [0x1d, 0x56];   // GS V (cut)
const ESC_PULSE = [0x1b, 0x70];  // ESC p (cajón)
const GS_QR    = [0x1d, 0x28, 0x6b]; // GS ( k (QR)

describe('columnasDe', () => {
  it('58mm=32 columnas, 80mm(default)=48', () => {
    expect(columnasDe('58')).toBe(32);
    expect(columnasDe('80')).toBe(48);
    expect(columnasDe(undefined)).toBe(48);
  });
});

describe('recibo', () => {
  it('inicializa, incluye negocio/total/pagos y corta', () => {
    const b = recibo(orden, pagos, negocio);
    expect(b).toBeInstanceOf(Uint8Array);
    expect(contieneBytes(b, ESC_INIT)).toBe(true);
    expect(contieneBytes(b, GS_CUT)).toBe(true);
    const s = decode(b);
    expect(s).toContain('Mi Restaurante');
    expect(s).toContain('TOTAL');
    expect(s).toContain('Efectivo');
  });

  it('con factura electrónica imprime CUFE y un QR', () => {
    const b = recibo(orden, pagos, negocio, {}, { cufe: 'CUFE123ABC', numero: 'SETP-1', qr_url: 'https://dian/qr' });
    expect(decode(b)).toContain('CUFE123ABC');
    expect(contieneBytes(b, GS_QR)).toBe(true);
  });
});

describe('comanda', () => {
  it('no incluye precios y corta una vez por copia', () => {
    const b1 = comanda(orden, {}, 1);
    const s = decode(b1);
    expect(s).toContain('COMANDA');
    expect(s).toContain('Pan'); // ítem sin tilde (evita depender del codepage en el test)
    expect(s).not.toContain('5.000'); // sin precios

    // 2 copias → 2 cortes
    const b2 = comanda(orden, {}, 2);
    const cortes = (n: Uint8Array) => {
      let c = 0;
      for (let i = 0; i <= n.length - 2; i++) if (n[i] === GS_CUT[0] && n[i + 1] === GS_CUT[1]) c++;
      return c;
    };
    expect(cortes(b2)).toBe(2);
  });
});

describe('kickCajon', () => {
  it('emite el pulso de apertura de cajón (ESC p)', () => {
    expect(contieneBytes(kickCajon(), ESC_PULSE)).toBe(true);
  });
});

describe('cierre', () => {
  it('incluye totales por método y la diferencia', () => {
    const b = cierre(
      { numero: 'CIE-1', fecha: '2026-08-06T20:00:00Z', ventas: [{ metodo: 'Efectivo', monto: 100000 }], totalVentas: 100000, diferencia: 0 },
      negocio,
    );
    const s = decode(b);
    expect(s).toContain('CIERRE DE CAJA');
    expect(s).toContain('Efectivo');
    expect(s).toContain('Diferencia');
  });
});
