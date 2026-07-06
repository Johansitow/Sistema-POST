/**
 * Tests para reciboService
 *
 * Cubre:
 *   generarReciboSimple
 *     - estructura completa del recibo
 *     - cliente null → "Consumidor final"
 *     - variante incluida en nombre del item
 *     - cálculo de cambio (pagado > total)
 *     - cambio = 0 cuando pago exacto
 *     - lanza NotFoundError si la orden no existe
 *
 *   generarRecibo
 *     - delega a generarReciboSimple
 *     - lanza Error si no se pasa idOrden
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

// ── Mock de Prisma ─────────────────────────────────────────────────────────────

vi.mock('../../config/database', () => ({
  default: {
    orden: { findUnique: vi.fn() },
  },
}));

// ── Imports DESPUÉS de los mocks ───────────────────────────────────────────────

import { reciboService }  from '../recibo.service';
import prisma             from '../../config/database';
import { NotFoundError }  from '../../exceptions/HttpErrors';

const pm = prisma as any;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeDetalle = (overrides: Partial<any> = {}) => ({
  id_producto:     1,
  id_variante:     null,
  producto:        { nombre: 'Café Americano' },
  variante:        null,
  cantidad:        new Decimal('2'),
  precio_unitario: new Decimal('5000'),
  descuento:       new Decimal('0'),
  subtotal:        new Decimal('10000'),
  notas:           null,
  ...overrides,
});

const makeDetalleConVariante = () => ({
  ...makeDetalle(),
  variante: { nombre: 'Grande' },
});

const makePago = (monto = 10000) => ({
  metodo_pago: { nombre: 'Efectivo' },
  referencia:  null,
  monto:       new Decimal(monto),
});

const makeOrdenSimple = (overrides: Partial<any> = {}) => ({
  id:             42,
  numero_orden:   'ORD-000042',
  fecha_apertura: new Date('2026-03-28T14:00:00Z'),
  restaurante:    { nombre: 'Restaurante Norte' },
  usuario:        { nombre_completo: 'Ana López' },
  cliente:        { nombre_completo: 'Juan García' },
  estado:         { nombre: 'Entregada' },
  detalles:       [makeDetalle()],
  pagos:          [makePago(12000)],
  subtotal:       new Decimal('10000'),
  descuento:      new Decimal('0'),
  impuestos:      new Decimal('1900'),
  propina:        new Decimal('0'),
  costo_domicilio: new Decimal('0'),
  total:          new Decimal('11900'),
  ...overrides,
});

// ── generarReciboSimple ───────────────────────────────────────────────────────

describe('reciboService.generarReciboSimple', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna estructura ReciboSimple completa', async () => {
    pm.orden.findUnique.mockResolvedValue(makeOrdenSimple());

    const recibo = await reciboService.generarReciboSimple(42);

    expect(recibo.tipo).toBe('simple');
    expect(recibo.numero).toBe('ORD-000042');
    expect(recibo.restaurante).toBe('Restaurante Norte');
    expect(recibo.cajero).toBe('Ana López');
    expect(recibo.cliente).toBe('Juan García');
    expect(recibo.items).toHaveLength(1);
    expect(recibo.items[0].nombre).toBe('Café Americano');
    expect(recibo.items[0].cantidad).toBe(2);
    expect(recibo.items[0].precio_unitario).toBe(5000);
    expect(recibo.items[0].subtotal).toBe(10000);
    expect(recibo.subtotal).toBe(10000);
    expect(recibo.total).toBe(11900);
    expect(recibo.pagos).toHaveLength(1);
    expect(recibo.pagos[0].metodo).toBe('Efectivo');
    expect(recibo.pagos[0].monto).toBe(12000);
  });

  it('calcula cambio correctamente cuando pago supera el total', async () => {
    // total = 11900, pagado = 12000 → cambio = 100
    pm.orden.findUnique.mockResolvedValue(makeOrdenSimple());

    const recibo = await reciboService.generarReciboSimple(42);
    expect(recibo.cambio).toBe(100);
  });

  it('cambio = 0 cuando el pago es exacto', async () => {
    // total = 11900, pagado = 11900 → cambio = 0
    pm.orden.findUnique.mockResolvedValue(
      makeOrdenSimple({ pagos: [makePago(11900)] }),
    );

    const recibo = await reciboService.generarReciboSimple(42);
    expect(recibo.cambio).toBe(0);
  });

  it('cambio = 0 aunque el total sea mayor que lo pagado (no negativo)', async () => {
    // total = 11900, pagado = 5000 → cambio = 0 (no negativo)
    pm.orden.findUnique.mockResolvedValue(
      makeOrdenSimple({ pagos: [makePago(5000)] }),
    );

    const recibo = await reciboService.generarReciboSimple(42);
    expect(recibo.cambio).toBe(0);
  });

  it('usa "Consumidor final" si la orden no tiene cliente', async () => {
    pm.orden.findUnique.mockResolvedValue(makeOrdenSimple({ cliente: null }));

    const recibo = await reciboService.generarReciboSimple(42);
    expect(recibo.cliente).toBe('Consumidor final');
  });

  it('concatena nombre + variante en el item cuando existe variante', async () => {
    pm.orden.findUnique.mockResolvedValue(
      makeOrdenSimple({ detalles: [makeDetalleConVariante()] }),
    );

    const recibo = await reciboService.generarReciboSimple(42);
    expect(recibo.items[0].nombre).toBe('Café Americano — Grande');
  });

  it('propaga el campo notas del detalle', async () => {
    pm.orden.findUnique.mockResolvedValue(
      makeOrdenSimple({ detalles: [makeDetalle({ notas: 'Sin azúcar' })] }),
    );

    const recibo = await reciboService.generarReciboSimple(42);
    expect(recibo.items[0].notas).toBe('Sin azúcar');
  });

  it('incluye costo_domicilio en el recibo', async () => {
    pm.orden.findUnique.mockResolvedValue(
      makeOrdenSimple({ costo_domicilio: new Decimal('3500') }),
    );

    const recibo = await reciboService.generarReciboSimple(42);
    expect(recibo.costo_domicilio).toBe(3500);
  });

  it('lanza NotFoundError si la orden no existe', async () => {
    pm.orden.findUnique.mockResolvedValue(null);

    await expect(reciboService.generarReciboSimple(999))
      .rejects.toThrow(NotFoundError);
  });
});

// ── generarRecibo ─────────────────────────────────────────────────────────────

describe('reciboService.generarRecibo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delega a generarReciboSimple', async () => {
    pm.orden.findUnique.mockResolvedValue(makeOrdenSimple());

    const recibo = await reciboService.generarRecibo({ idOrden: 42 });

    expect(recibo.tipo).toBe('simple');
    expect(recibo.numero).toBe('ORD-000042');
  });

  it('lanza NotFoundError si la orden no existe', async () => {
    pm.orden.findUnique.mockResolvedValue(null);

    await expect(reciboService.generarRecibo({ idOrden: 999 }))
      .rejects.toThrow(NotFoundError);
  });

  it('lanza Error si no se pasa idOrden', async () => {
    await expect(reciboService.generarRecibo({}))
      .rejects.toThrow('Se requiere idOrden');
  });
});
