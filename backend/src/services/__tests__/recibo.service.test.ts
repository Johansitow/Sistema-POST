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
 *   generarReciboUnificado
 *     - estructura con secciones por restaurante
 *     - consolidado es suma de secciones
 *     - cliente tomado de la primera orden con cliente
 *     - cliente null → "Consumidor final"
 *     - cambio calculado sobre PagoGrupo
 *     - lanza NotFoundError si el grupo no existe
 *
 *   generarRecibo
 *     - delega a generarReciboUnificado cuando se pasa idOrdenGrupo
 *     - delega a generarReciboUnificado cuando la orden tiene id_orden_grupo
 *     - delega a generarReciboSimple cuando la orden no tiene grupo
 *     - lanza NotFoundError si la orden no existe
 *     - lanza Error si no se pasa ningún parámetro
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

// ── Mock de Prisma ─────────────────────────────────────────────────────────────

vi.mock('../../config/database', () => ({
  default: {
    orden:      { findUnique: vi.fn() },
    ordenGrupo: { findUnique: vi.fn() },
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

const makeOrdenGrupo = (overrides: Partial<any> = {}) => ({
  id:              1,
  numero_grupo:    'GRP-001',
  fecha_creacion:  new Date('2026-03-28T14:00:00Z'),
  usuario:         { nombre_completo: 'Ana López' },
  ordenes: [
    {
      id:             10,
      numero_orden:   'ORD-000010-A',
      sufijo_orden:   'A',
      restaurante:    { nombre: 'Restaurante Norte' },
      cliente:        { nombre_completo: 'Juan García' },
      detalles:       [makeDetalle()],
      subtotal:       new Decimal('10000'),
      descuento:      new Decimal('0'),
      impuestos:      new Decimal('1900'),
      propina:        new Decimal('500'),
      total:          new Decimal('12400'),
    },
    {
      id:             11,
      numero_orden:   'ORD-000011-B',
      sufijo_orden:   'B',
      restaurante:    { nombre: 'Restaurante Sur' },
      cliente:        null,
      detalles:       [
        makeDetalle({ producto: { nombre: 'Jugo Natural' }, cantidad: new Decimal('1'), precio_unitario: new Decimal('4000'), subtotal: new Decimal('4000') }),
      ],
      subtotal:       new Decimal('4000'),
      descuento:      new Decimal('200'),
      impuestos:      new Decimal('760'),
      propina:        new Decimal('0'),
      total:          new Decimal('4560'),
    },
  ],
  pagos: [
    { metodo_pago: { nombre: 'Tarjeta' }, referencia: 'TXN-123', monto: new Decimal('16960') },
  ],
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

// ── generarReciboUnificado ────────────────────────────────────────────────────

describe('reciboService.generarReciboUnificado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna estructura ReciboUnificado con secciones por restaurante', async () => {
    pm.ordenGrupo.findUnique.mockResolvedValue(makeOrdenGrupo());

    const recibo = await reciboService.generarReciboUnificado(1);

    expect(recibo.tipo).toBe('unificado');
    expect(recibo.numero_grupo).toBe('GRP-001');
    expect(recibo.cajero).toBe('Ana López');
    expect(recibo.secciones).toHaveLength(2);
  });

  it('cada sección contiene datos del restaurante correcto', async () => {
    pm.ordenGrupo.findUnique.mockResolvedValue(makeOrdenGrupo());

    const recibo = await reciboService.generarReciboUnificado(1);

    expect(recibo.secciones[0].restaurante).toBe('Restaurante Norte');
    expect(recibo.secciones[0].codigo_orden).toBe('ORD-000010-A');
    expect(recibo.secciones[0].sufijo).toBe('A');
    expect(recibo.secciones[1].restaurante).toBe('Restaurante Sur');
  });

  it('consolidado es la suma correcta de todas las secciones', async () => {
    pm.ordenGrupo.findUnique.mockResolvedValue(makeOrdenGrupo());

    const recibo = await reciboService.generarReciboUnificado(1);

    // subtotal: 10000 + 4000 = 14000
    expect(recibo.consolidado.subtotal).toBe(14000);
    // descuento: 0 + 200 = 200
    expect(recibo.consolidado.descuento).toBe(200);
    // impuestos: 1900 + 760 = 2660
    expect(recibo.consolidado.impuestos).toBe(2660);
    // total: 12400 + 4560 = 16960
    expect(recibo.consolidado.total).toBe(16960);
  });

  it('calcula cambio sobre el total consolidado y los PagoGrupo', async () => {
    // total consolidado = 16960, pagado = 16960 → cambio = 0
    pm.ordenGrupo.findUnique.mockResolvedValue(makeOrdenGrupo());

    const recibo = await reciboService.generarReciboUnificado(1);
    expect(recibo.cambio).toBe(0);
  });

  it('cambio positivo cuando PagoGrupo supera el total', async () => {
    pm.ordenGrupo.findUnique.mockResolvedValue(makeOrdenGrupo({
      pagos: [{ metodo_pago: { nombre: 'Efectivo' }, referencia: null, monto: new Decimal('20000') }],
    }));

    const recibo = await reciboService.generarReciboUnificado(1);
    // 20000 - 16960 = 3040
    expect(recibo.cambio).toBe(3040);
  });

  it('infiere el cliente desde la primera orden que lo tenga', async () => {
    // Primer orden no tiene cliente, segunda sí
    const grupo = makeOrdenGrupo();
    grupo.ordenes[0].cliente = null;
    grupo.ordenes[1].cliente = { nombre_completo: 'María Pérez' };
    pm.ordenGrupo.findUnique.mockResolvedValue(grupo);

    const recibo = await reciboService.generarReciboUnificado(1);
    expect(recibo.cliente).toBe('María Pérez');
  });

  it('usa "Consumidor final" si ninguna orden tiene cliente', async () => {
    const grupo = makeOrdenGrupo();
    grupo.ordenes[0].cliente = null;
    grupo.ordenes[1].cliente = null;
    pm.ordenGrupo.findUnique.mockResolvedValue(grupo);

    const recibo = await reciboService.generarReciboUnificado(1);
    expect(recibo.cliente).toBe('Consumidor final');
  });

  it('incluye los pagos de grupo con referencia', async () => {
    pm.ordenGrupo.findUnique.mockResolvedValue(makeOrdenGrupo());

    const recibo = await reciboService.generarReciboUnificado(1);

    expect(recibo.pagos).toHaveLength(1);
    expect(recibo.pagos[0].metodo).toBe('Tarjeta');
    expect(recibo.pagos[0].referencia).toBe('TXN-123');
    expect(recibo.pagos[0].monto).toBe(16960);
  });

  it('lanza NotFoundError si el grupo no existe', async () => {
    pm.ordenGrupo.findUnique.mockResolvedValue(null);

    await expect(reciboService.generarReciboUnificado(999))
      .rejects.toThrow(NotFoundError);
  });
});

// ── generarRecibo ─────────────────────────────────────────────────────────────

describe('reciboService.generarRecibo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delega a generarReciboUnificado cuando se pasa idOrdenGrupo directamente', async () => {
    pm.ordenGrupo.findUnique.mockResolvedValue(makeOrdenGrupo());

    const recibo = await reciboService.generarRecibo({ idOrdenGrupo: 1 });

    expect(recibo.tipo).toBe('unificado');
    expect(pm.ordenGrupo.findUnique).toHaveBeenCalledOnce();
    expect(pm.orden.findUnique).not.toHaveBeenCalled();
  });

  it('delega a generarReciboUnificado cuando la orden pertenece a un grupo', async () => {
    // Primera llamada: lookup de id_orden_grupo → tiene grupo
    pm.orden.findUnique
      .mockResolvedValueOnce({ id_orden_grupo: 5 })     // lookup en generarRecibo
    pm.ordenGrupo.findUnique.mockResolvedValue(makeOrdenGrupo({ id: 5 }));

    const recibo = await reciboService.generarRecibo({ idOrden: 42 });

    expect(recibo.tipo).toBe('unificado');
    expect(pm.ordenGrupo.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 } }),
    );
  });

  it('delega a generarReciboSimple cuando la orden no tiene grupo', async () => {
    // Primera llamada: lookup → sin grupo
    // Segunda llamada: findUnique completa para el recibo simple
    pm.orden.findUnique
      .mockResolvedValueOnce({ id_orden_grupo: null })   // lookup en generarRecibo
      .mockResolvedValueOnce(makeOrdenSimple());          // fetch completo en generarReciboSimple

    const recibo = await reciboService.generarRecibo({ idOrden: 42 });

    expect(recibo.tipo).toBe('simple');
  });

  it('lanza NotFoundError si la orden no existe al resolver el tipo', async () => {
    pm.orden.findUnique.mockResolvedValueOnce(null);

    await expect(reciboService.generarRecibo({ idOrden: 999 }))
      .rejects.toThrow(NotFoundError);
  });

  it('lanza Error si no se pasa idOrden ni idOrdenGrupo', async () => {
    await expect(reciboService.generarRecibo({}))
      .rejects.toThrow('Se requiere idOrden o idOrdenGrupo');
  });
});
