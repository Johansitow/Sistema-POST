/**
 * Tests de helpers del proveedor de facturación + driver noop.
 */

import { describe, it, expect } from 'vitest';
import { nuevaReferencia, mapEstadoFactus } from '../proveedor';
import { NoopFacturacion } from '../noopFacturacion';

describe('nuevaReferencia', () => {
  it('incluye el grupo y es única entre llamadas', () => {
    const a = nuevaReferencia(7);
    const b = nuevaReferencia(7);
    expect(a).toMatch(/^fe_7_/);
    expect(a).not.toBe(b);
  });
});

describe('mapEstadoFactus', () => {
  it('mapea estados textuales del proveedor a los normalizados', () => {
    expect(mapEstadoFactus('Valid')).toBe('emitida');
    expect(mapEstadoFactus('validated')).toBe('emitida');
    expect(mapEstadoFactus('rejected')).toBe('rechazada');
    expect(mapEstadoFactus('pending')).toBe('pendiente');
    expect(mapEstadoFactus('???')).toBe('error');
  });
});

describe('NoopFacturacion', () => {
  it('simula una emisión con CUFE y estado emitida', async () => {
    const noop = new NoopFacturacion();
    expect(noop.disponible()).toBe(false);
    const res = await noop.emitir({
      referencia: 'fe_1_x', adquiriente: { tipo_documento: '13', numero_documento: '123', nombre: 'Juan' },
      lineas: [], subtotal: 1000, impuestos: 190, total: 1190,
    });
    expect(res.estado).toBe('emitida');
    expect(res.cufe).toBeTruthy();
    expect(res.numero).toBeTruthy();
  });
});
