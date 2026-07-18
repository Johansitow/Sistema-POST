/**
 * Tests para ordenService
 *
 * Cubre:
 *   - crear: llama verificarDisponibilidadParaDetalles; productos con receta no descuentan stock propio
 *   - actualizarEstado: transición inválida, ENTREGADA sin pagos, total insuficiente, verifica stock de receta
 *   - agregarDetalle: llama verificarDisponibilidadParaDetalles
 *   - actualizarDetalle: llama verificarDisponibilidadParaDetalles solo cuando la cantidad sube
 *   - eliminar: productos con receta no recuperan stock; productos sin receta sí
 *   - pagar, cancelar, actualizar, actualizarEstado (tenant guard — Oleada 2b)
 *   - actualizarDetalle, eliminarDetalle (tenant guard vía orden padre — Oleada 2b)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { EstadoOrdenGlobal } from '@prisma/client';
import type { TenantCtx } from '../../lib/tenantCtx';
import { ForbiddenError, NotFoundError } from '../../exceptions/HttpErrors';

// ── Mocks: se definen con vi.hoisted para que estén disponibles dentro de vi.mock ──

const { mockTx } = vi.hoisted(() => {
  const mockTx: any = {
    receta:        { findFirst: vi.fn() },
    producto:      { findUnique: vi.fn(), update: vi.fn() },
    productoStock: { findUnique: vi.fn(), update: vi.fn() },
    movimiento:    { create: vi.fn() },
    orden:         { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    ordenDetalle:  { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
    ordenSede:     { create: vi.fn(), findMany: vi.fn() },
    ordenEvento:   { create: vi.fn() },
    factura:       { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    pago:          { create: vi.fn() },
  };
  return { mockTx };
});

vi.mock('../../repositories/orden.repository', () => ({
  ordenRepository: {
    findAll:          vi.fn(),
    findById:         vi.fn(),
    findByIdScoped:   vi.fn(),
    findUltima:       vi.fn(),
    findDetalleById:  vi.fn(),
    update:           vi.fn(),
    count:            vi.fn(),
    groupByEstado:    vi.fn(),
    groupByTipo:      vi.fn(),
    aggregate:        vi.fn(),
  },
  includeOrdenCompleta: {},
}));

vi.mock('../../repositories/estado.repository', () => ({
  estadoRepository: {
    findTransicion: vi.fn(),
    findById:       vi.fn(),
  },
}));

vi.mock('../configuracion.service', () => ({
  configuracionService: {
    resolverTasaImpuestoDeRestaurante: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../lib/numero-generator', () => ({
  generarNumeroOrden: vi.fn(() => 'ORD-000001'),
}));

vi.mock('../receta.service', () => ({
  recetaService: {
    verificarDisponibilidadParaDetalles: vi.fn(),
    verificarStockParaOrden:             vi.fn(),
    descontarIngredientesOrden:          vi.fn(),
  },
}));

vi.mock('../factura.service', () => ({
  facturaService: {
    generarDesdeOrden: vi.fn(),
    garantizarPagada:  vi.fn(),
  },
}));

vi.mock('../../config/database', () => ({
  default: {
    $transaction:  vi.fn((fn: any) => fn(mockTx)),
    ordenDetalle:  { findUnique: vi.fn() },
    restaurante:   { findUnique: vi.fn().mockResolvedValue({ id_grupo: 10 }) },
  },
}));

vi.mock('../../repositories/cliente.repository', () => ({
  clienteRepository: {
    findByIdScoped: vi.fn().mockResolvedValue({ id: 1, nombre_completo: 'Cliente Test' }),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { ordenService } from '../orden.service';
import { ordenRepository } from '../../repositories/orden.repository';
import { estadoRepository } from '../../repositories/estado.repository';
import { configuracionService } from '../configuracion.service';
import { recetaService } from '../receta.service';
import { facturaService } from '../factura.service';
import { clienteRepository } from '../../repositories/cliente.repository';
import prisma from '../../config/database';
import { BadRequestError } from '../../exceptions/HttpErrors';

// ── Contextos de tenant ───────────────────────────────────────────────────────

const CTX_RESTAURANTE_1: TenantCtx = { restauranteId: 1, grupoId: 10, esSuperAdmin: false };
const CTX_SIN_TENANT:    TenantCtx = { esSuperAdmin: false };
const CTX_SUPERADMIN:    TenantCtx = { esSuperAdmin: true };

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockOrdenBase = {
  id:       1,
  id_estado: 2,
  numero_orden: 'ORD-000001',
  total:    new Decimal('25000'),
  subtotal: new Decimal('21000'),
  impuestos: new Decimal('4000'),
  descuento: new Decimal('0'),
  propina:   new Decimal('0'),
  costo_domicilio: new Decimal('0'),
  estado: { id: 2, codigo: 'PENDIENTE', nombre: 'Pendiente' },
  detalles: [
    { id: 10, id_producto: 5, cantidad: new Decimal(2), subtotal: new Decimal('10000'), producto: { id: 5, nombre: 'Café', stock_actual: new Decimal('10') } },
  ],
  pagos: [],
};

// Configura la resolución de impuesto (sede→grupo→global) para las pruebas.
// activo=false → sin impuesto configurado (comportamiento por defecto en la mayoría de tests).
const setupIva = (activo = false, tarifa = 19, tipo = 'iva') => {
  (configuracionService.resolverTasaImpuestoDeRestaurante as any).mockResolvedValue(
    activo ? { tarifa, tipo } : null
  );
};

// ── crear ─────────────────────────────────────────────────────────────────────

describe('ordenService.crear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupIva(false);
  });

  it('llama verificarDisponibilidadParaDetalles antes de abrir la transacción', async () => {
    (recetaService.verificarDisponibilidadParaDetalles as any).mockResolvedValue({ ok: true });
    (ordenRepository.findUltima as any).mockResolvedValue(null);

    // Tx mocks
    mockTx.receta.findFirst.mockResolvedValue(null); // sin receta → descuenta stock
    const mockProd = { id: 5, nombre: 'Café', stock_actual: new Decimal('10'), unidad_medida: 'unidad' };
    mockTx.producto.findUnique.mockResolvedValue(mockProd);
    mockTx.producto.update.mockResolvedValue({});
    mockTx.movimiento.create.mockResolvedValue({});
    mockTx.orden.create.mockResolvedValue({ ...mockOrdenBase, estado: { codigo: 'PENDIENTE' } });

    await ordenService.crearLegado({
      id_estado: 2, id_usuario: 1, id_cliente: 1,
      detalles: [{ id_producto: 5, cantidad: 1, precio_unitario: 10000, descuento: 0 }],
    });

    expect(recetaService.verificarDisponibilidadParaDetalles).toHaveBeenCalledOnce();
    expect(recetaService.verificarDisponibilidadParaDetalles).toHaveBeenCalledWith([
      { id_producto: 5, cantidad: 1 },
    ]);
  });

  it('resuelve el impuesto del restaurante (sede→grupo→global) y lo guarda en la orden — no un porcentaje fijo', async () => {
    (recetaService.verificarDisponibilidadParaDetalles as any).mockResolvedValue({ ok: true });
    (ordenRepository.findUltima as any).mockResolvedValue(null);
    setupIva(true, 8, 'impoconsumo'); // override de sede: impoconsumo 8%

    mockTx.receta.findFirst.mockResolvedValue(null);
    const mockProd = { id: 5, nombre: 'Café', stock_actual: new Decimal('10'), unidad_medida: 'unidad' };
    mockTx.producto.findUnique.mockResolvedValue(mockProd);
    mockTx.producto.update.mockResolvedValue({});
    mockTx.movimiento.create.mockResolvedValue({});
    mockTx.orden.create.mockResolvedValue({ ...mockOrdenBase, estado: { codigo: 'PENDIENTE' } });

    await ordenService.crearLegado({
      id_estado: 2, id_usuario: 1, id_restaurante: 7, id_cliente: 1,
      detalles: [{ id_producto: 5, cantidad: 1, precio_unitario: 10000, descuento: 0 }],
    });

    expect(configuracionService.resolverTasaImpuestoDeRestaurante).toHaveBeenCalledWith(7);
    const callArg = mockTx.orden.create.mock.calls[0][0];
    // subtotal 10000 × 8% = 800 de impuestos, con el tipo persistido para el ticket
    expect(callArg.data.impuestos.toString()).toBe('800');
    expect(callArg.data.impuesto_tipo).toBe('impoconsumo');
  });

  it('sin id_restaurante: no calcula impuesto (no adivina un porcentaje)', async () => {
    (recetaService.verificarDisponibilidadParaDetalles as any).mockResolvedValue({ ok: true });
    (ordenRepository.findUltima as any).mockResolvedValue(null);

    mockTx.receta.findFirst.mockResolvedValue(null);
    const mockProd = { id: 5, nombre: 'Café', stock_actual: new Decimal('10'), unidad_medida: 'unidad' };
    mockTx.producto.findUnique.mockResolvedValue(mockProd);
    mockTx.producto.update.mockResolvedValue({});
    mockTx.movimiento.create.mockResolvedValue({});
    mockTx.orden.create.mockResolvedValue({ ...mockOrdenBase, estado: { codigo: 'PENDIENTE' } });

    await ordenService.crearLegado({
      id_estado: 2, id_usuario: 1, id_cliente: 1,
      detalles: [{ id_producto: 5, cantidad: 1, precio_unitario: 10000, descuento: 0 }],
    });

    expect(configuracionService.resolverTasaImpuestoDeRestaurante).not.toHaveBeenCalled();
    const callArg = mockTx.orden.create.mock.calls[0][0];
    expect(callArg.data.impuestos.toString()).toBe('0');
  });

  it('no crea la orden si verificarDisponibilidadParaDetalles lanza error', async () => {
    (recetaService.verificarDisponibilidadParaDetalles as any).mockRejectedValue(
      new BadRequestError('Stock insuficiente')
    );

    await expect(ordenService.crearLegado({
      id_estado: 2, id_usuario: 1, id_cliente: 1,
      detalles: [{ id_producto: 5, cantidad: 1, precio_unitario: 10000, descuento: 0 }],
    })).rejects.toThrow(BadRequestError);

    expect(mockTx.orden.create).not.toHaveBeenCalled();
  });

  it('producto SIN receta: descuenta su stock en la transacción', async () => {
    (recetaService.verificarDisponibilidadParaDetalles as any).mockResolvedValue({ ok: true });
    (ordenRepository.findUltima as any).mockResolvedValue(null);

    mockTx.receta.findFirst.mockResolvedValue(null); // sin receta
    const mockProd = { id: 5, nombre: 'Café', stock_actual: new Decimal('10'), unidad_medida: 'unidad' };
    mockTx.producto.findUnique.mockResolvedValue(mockProd);
    mockTx.producto.update.mockResolvedValue({});
    mockTx.movimiento.create.mockResolvedValue({});
    mockTx.orden.create.mockResolvedValue({ ...mockOrdenBase, estado: { codigo: 'PENDIENTE' } });

    await ordenService.crearLegado({
      id_estado: 2, id_usuario: 1, id_cliente: 1,
      detalles: [{ id_producto: 5, cantidad: 3, precio_unitario: 10000, descuento: 0 }],
    });

    // Debe actualizar el stock del producto
    expect(mockTx.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 } })
    );
    // Debe registrar movimiento de venta
    expect(mockTx.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo_movimiento: 'venta' }) })
    );
  });

  it('producto CON receta: NO descuenta su stock en la transacción (lo hará descontarIngredientesOrden)', async () => {
    (recetaService.verificarDisponibilidadParaDetalles as any).mockResolvedValue({ ok: true });
    (ordenRepository.findUltima as any).mockResolvedValue(null);

    // Ambas llamadas a receta.findFirst (check en 1er bucle + skip en 2do bucle)
    mockTx.receta.findFirst.mockResolvedValue({ id: 99 }); // siempre tiene receta
    const mockProd = { id: 5, nombre: 'Bandeja', stock_actual: new Decimal('0'), unidad_medida: 'unidad' };
    mockTx.producto.findUnique.mockResolvedValue(mockProd);
    mockTx.orden.create.mockResolvedValue({ ...mockOrdenBase, estado: { codigo: 'PENDIENTE' } });

    await ordenService.crearLegado({
      id_estado: 2, id_usuario: 1, id_cliente: 1,
      detalles: [{ id_producto: 5, cantidad: 1, precio_unitario: 10000, descuento: 0 }],
    });

    // No debe descontar stock del producto (el descuento ocurre al entregar vía ingredientes)
    expect(mockTx.producto.update).not.toHaveBeenCalled();
    expect(mockTx.movimiento.create).not.toHaveBeenCalled();
  });

  it('rechaza si el cliente no pertenece al grupo del restaurante de la orden', async () => {
    (prisma.restaurante.findUnique as any).mockResolvedValueOnce({ id_grupo: 10 });
    (clienteRepository.findByIdScoped as any).mockRejectedValueOnce(new NotFoundError('Cliente'));

    await expect(ordenService.crearLegado({
      id_estado: 2, id_usuario: 1, id_restaurante: 7, id_cliente: 999,
      detalles: [{ id_producto: 5, cantidad: 1, precio_unitario: 10000, descuento: 0 }],
    })).rejects.toThrow(NotFoundError);

    expect(mockTx.orden.create).not.toHaveBeenCalled();
  });
});

// ── crear (nueva arquitectura, multi-sede) ────────────────────────────────────
// Antes sin cobertura — cubre el fix de "retorna null tras crear con éxito"
// (ordenService.crear() leía la orden vía el cliente prisma global, todavía
// dentro de la transacción sin commit) y el fix de impuesto por sede.

describe('ordenService.crear — nueva arquitectura (multi-sede)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (clienteRepository.findByIdScoped as any).mockResolvedValue({ id: 1, nombre_completo: 'Cliente Test' });
  });

  const mockProd = (id: number, stock = 100) => ({
    id, nombre: `Producto ${id}`, stock_actual: new Decimal(stock), unidad_medida: 'unidad',
  });

  it('retorna la orden completa (no null) tras crear con éxito — no usa ordenRepository.findById', async () => {
    (recetaService.verificarDisponibilidadParaDetalles as any).mockResolvedValue({ ok: true });
    (ordenRepository.findUltima as any).mockResolvedValue(null);
    (configuracionService.resolverTasaImpuestoDeRestaurante as any).mockResolvedValue(null);

    mockTx.orden.create.mockResolvedValueOnce({ id: 1 });
    mockTx.producto.findUnique.mockResolvedValue(mockProd(5));
    mockTx.receta.findFirst.mockResolvedValue(null);
    mockTx.productoStock.findUnique.mockResolvedValue(null);
    mockTx.productoStock.update.mockResolvedValue({});
    mockTx.movimiento.create.mockResolvedValue({});
    mockTx.ordenSede.create.mockResolvedValue({ id: 10 });
    mockTx.ordenSede.findMany.mockResolvedValue([
      { id: 10, id_restaurante: 1, subtotal: new Decimal('10000'), impuestos: new Decimal('800'), impuesto_tipo: 'impoconsumo' },
    ]);
    mockTx.orden.findUnique
      .mockResolvedValueOnce({ descuento: new Decimal(0), propina: new Decimal(0), costo_domicilio: new Decimal(0) }) // consolidarTotalesOrden
      .mockResolvedValueOnce({ id: 1, numero_orden: 'ORD-000001', sedes: [{ id: 10, id_restaurante: 1, sufijo: null }] }); // ordenFinal
    mockTx.orden.update.mockResolvedValue({});
    mockTx.ordenEvento.create.mockResolvedValue({});

    const result = await ordenService.crear({
      id_grupo: 2, id_usuario: 1, id_cliente: 1, tipo_orden: 'local' as any,
      sedes: [{ id_restaurante: 1, items: [{ id_producto: 5, cantidad: 1, precio_unitario: 10000 }] }],
    });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ id: 1, numero_orden: 'ORD-000001' });
    expect(ordenRepository.findById).not.toHaveBeenCalled();
  });

  it('multi-sede: resuelve el impuesto por cada restaurante y consolida la suma en la Orden', async () => {
    (recetaService.verificarDisponibilidadParaDetalles as any).mockResolvedValue({ ok: true });
    (ordenRepository.findUltima as any).mockResolvedValue(null);
    // Sede 1: impoconsumo 8%. Sede 2: iva 19% — tasas distintas en el mismo pedido.
    (configuracionService.resolverTasaImpuestoDeRestaurante as any)
      .mockResolvedValueOnce({ tarifa: 8, tipo: 'impoconsumo' })
      .mockResolvedValueOnce({ tarifa: 19, tipo: 'iva' });

    mockTx.orden.create.mockResolvedValueOnce({ id: 1 });
    mockTx.producto.findUnique.mockResolvedValue(mockProd(5));
    mockTx.receta.findFirst.mockResolvedValue(null);
    mockTx.productoStock.findUnique.mockResolvedValue(null);
    mockTx.productoStock.update.mockResolvedValue({});
    mockTx.movimiento.create.mockResolvedValue({});
    mockTx.ordenSede.create.mockResolvedValue({ id: 10 });
    mockTx.ordenSede.findMany.mockResolvedValue([
      { id: 10, id_restaurante: 1, subtotal: new Decimal('10000'), impuestos: new Decimal('800'),  impuesto_tipo: 'impoconsumo' },
      { id: 11, id_restaurante: 2, subtotal: new Decimal('10000'), impuestos: new Decimal('1900'), impuesto_tipo: 'iva' },
    ]);
    mockTx.orden.findUnique
      .mockResolvedValueOnce({ descuento: new Decimal(0), propina: new Decimal(0), costo_domicilio: new Decimal(0) })
      .mockResolvedValueOnce({ id: 1, numero_orden: 'ORD-000001' });
    mockTx.orden.update.mockResolvedValue({});
    mockTx.ordenEvento.create.mockResolvedValue({});

    await ordenService.crear({
      id_grupo: 2, id_usuario: 1, id_cliente: 1, tipo_orden: 'local' as any,
      sedes: [
        { id_restaurante: 1, items: [{ id_producto: 5, cantidad: 1, precio_unitario: 10000 }] },
        { id_restaurante: 2, items: [{ id_producto: 5, cantidad: 1, precio_unitario: 10000 }] },
      ],
    });

    // Cada sede resolvió su propia tasa — no una tasa única para todo el pedido
    expect(configuracionService.resolverTasaImpuestoDeRestaurante).toHaveBeenNthCalledWith(1, 1);
    expect(configuracionService.resolverTasaImpuestoDeRestaurante).toHaveBeenNthCalledWith(2, 2);

    // Cada sede se crea con SU propio impuesto (800 y 1900) — no una tasa compartida
    expect(mockTx.ordenSede.create.mock.calls[0][0].data.impuestos.toString()).toBe('800');
    expect(mockTx.ordenSede.create.mock.calls[1][0].data.impuestos.toString()).toBe('1900');

    // Consolidado de la Orden = suma de los impuestos YA resueltos por sede (800 + 1900 = 2700),
    // no una tasa única recalculada sobre el subtotal total.
    const updateArg = mockTx.orden.update.mock.calls[0][0];
    expect(updateArg.data.impuestos.toString()).toBe('2700');
    expect(updateArg.data.impuesto_tipo).toBeNull(); // tipos distintos por sede → ambiguo a nivel Orden
  });

  it('rechaza si el cliente no pertenece al grupo de la orden (id_cliente de otro grupo)', async () => {
    (clienteRepository.findByIdScoped as any).mockRejectedValueOnce(new NotFoundError('Cliente'));

    await expect(ordenService.crear({
      id_grupo: 2, id_usuario: 1, id_cliente: 999, tipo_orden: 'local' as any,
      sedes: [{ id_restaurante: 1, items: [{ id_producto: 5, cantidad: 1, precio_unitario: 10000 }] }],
    })).rejects.toThrow(NotFoundError);

    expect(mockTx.orden.create).not.toHaveBeenCalled();
  });
});

// ── actualizarEstado ──────────────────────────────────────────────────────────

describe('ordenService.actualizarEstado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupIva(false);
  });

  it('lanza BadRequestError si la transición de estado no está permitida', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(mockOrdenBase);
    (estadoRepository.findTransicion as any).mockResolvedValue(null); // transición no existe

    await expect(ordenService.actualizarEstado(1, 5, CTX_SUPERADMIN)).rejects.toThrow(BadRequestError);
  });

  it('lanza NotFoundError si el estado destino no existe en BD', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(mockOrdenBase);
    (estadoRepository.findTransicion as any).mockResolvedValue({ id: 1 });
    (estadoRepository.findById as any).mockResolvedValue(null); // estado no encontrado

    await expect(ordenService.actualizarEstado(1, 99, CTX_SUPERADMIN)).rejects.toThrow(NotFoundError);
  });

  it('lanza BadRequestError si el estado actual ya es final (protección contra re-transición)', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(mockOrdenBase);
    (estadoRepository.findById as any).mockResolvedValueOnce({ id: 4, codigo: 'ENTREGADA', es_final: true });

    await expect(ordenService.actualizarEstado(1, 3, CTX_SUPERADMIN)).rejects.toThrow(BadRequestError);
    expect(estadoRepository.findTransicion).not.toHaveBeenCalled();
  });

  it('lanza BadRequestError al pasar a ENTREGADA sin proveer pagos', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValue(mockOrdenBase);
    (estadoRepository.findTransicion as any).mockResolvedValue({ id: 1 });
    (estadoRepository.findById as any).mockResolvedValue({ id: 4, codigo: 'ENTREGADA', nombre: 'Entregada' });
    (recetaService.verificarStockParaOrden as any).mockResolvedValue({ ok: true });

    await expect(ordenService.actualizarEstado(1, 4, CTX_SUPERADMIN, [])).rejects.toThrow(BadRequestError);
    await expect(ordenService.actualizarEstado(1, 4, CTX_SUPERADMIN, undefined)).rejects.toThrow(BadRequestError);
  });

  it('lanza BadRequestError si el total pagado es menor al total de la orden', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce({ ...mockOrdenBase, total: new Decimal('25000') });
    (estadoRepository.findTransicion as any).mockResolvedValue({ id: 1 });
    (estadoRepository.findById as any).mockResolvedValue({ id: 4, codigo: 'ENTREGADA' });
    (recetaService.verificarStockParaOrden as any).mockResolvedValue({ ok: true });

    await expect(
      ordenService.actualizarEstado(1, 4, CTX_SUPERADMIN, [{ id_metodo_pago: 1, monto: 10000 }])
    ).rejects.toThrow(BadRequestError);
  });

  it('llama verificarStockParaOrden antes de abrir la transacción al pasar a ENTREGADA', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce({ ...mockOrdenBase, total: new Decimal('10000') });
    (estadoRepository.findTransicion as any).mockResolvedValue({ id: 1 });
    (estadoRepository.findById as any).mockResolvedValue({ id: 4, codigo: 'ENTREGADA' });
    (recetaService.verificarStockParaOrden as any).mockResolvedValue({ ok: true });
    (recetaService.descontarIngredientesOrden as any).mockResolvedValue(undefined);

    mockTx.pago.create.mockResolvedValue({});
    mockTx.factura.findUnique.mockResolvedValue({ id: 1 });
    mockTx.factura.update.mockResolvedValue({});
    mockTx.orden.update.mockResolvedValue({ ...mockOrdenBase, id_estado: 4 });

    await ordenService.actualizarEstado(1, 4, CTX_SUPERADMIN, [{ id_metodo_pago: 1, monto: 10000 }]);

    expect(recetaService.verificarStockParaOrden).toHaveBeenCalledWith(1);
    // Se verifica ANTES de la tx → si falla, no hay rollback innecesario
    const verificarCallOrder = (recetaService.verificarStockParaOrden as any).mock.invocationCallOrder[0];
    const txCallOrder = (prisma.$transaction as any).mock.invocationCallOrder[0];
    expect(verificarCallOrder).toBeLessThan(txCallOrder);
  });

  it('NO llama verificarStockParaOrden para estados distintos a ENTREGADA', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(mockOrdenBase);
    (estadoRepository.findTransicion as any).mockResolvedValue({ id: 1 });
    (estadoRepository.findById as any).mockResolvedValue({ id: 3, codigo: 'EN_PREPARACION' });
    mockTx.factura.findUnique.mockResolvedValue(null);
    (facturaService.generarDesdeOrden as any).mockResolvedValue({});
    mockTx.orden.update.mockResolvedValue({ ...mockOrdenBase, id_estado: 3 });

    await ordenService.actualizarEstado(1, 3, CTX_SUPERADMIN);

    expect(recetaService.verificarStockParaOrden).not.toHaveBeenCalled();
  });

  it('genera factura automáticamente al pasar a EN_PREPARACION (si no existe)', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(mockOrdenBase);
    (estadoRepository.findTransicion as any).mockResolvedValue({ id: 1 });
    (estadoRepository.findById as any).mockResolvedValue({ id: 3, codigo: 'EN_PREPARACION' });
    mockTx.factura.findUnique.mockResolvedValue(null); // no existe factura
    (facturaService.generarDesdeOrden as any).mockResolvedValue({});
    mockTx.orden.update.mockResolvedValue({ ...mockOrdenBase, id_estado: 3 });

    await ordenService.actualizarEstado(1, 3, CTX_SUPERADMIN);

    expect(facturaService.generarDesdeOrden).toHaveBeenCalledWith(1, mockTx);
  });

  it('NO genera factura si ya existe al pasar a EN_PREPARACION', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(mockOrdenBase);
    (estadoRepository.findTransicion as any).mockResolvedValue({ id: 1 });
    (estadoRepository.findById as any).mockResolvedValue({ id: 3, codigo: 'EN_PREPARACION' });
    mockTx.factura.findUnique.mockResolvedValue({ id: 5 }); // ya existe
    mockTx.orden.update.mockResolvedValue({ ...mockOrdenBase, id_estado: 3 });

    await ordenService.actualizarEstado(1, 3, CTX_SUPERADMIN);

    expect(facturaService.generarDesdeOrden).not.toHaveBeenCalled();
  });

  it('al pasar a ENTREGADA llama descontarIngredientesOrden dentro de la transacción', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce({ ...mockOrdenBase, total: new Decimal('10000') });
    (estadoRepository.findTransicion as any).mockResolvedValue({ id: 1 });
    (estadoRepository.findById as any).mockResolvedValue({ id: 4, codigo: 'ENTREGADA' });
    (recetaService.verificarStockParaOrden as any).mockResolvedValue({ ok: true });
    (recetaService.descontarIngredientesOrden as any).mockResolvedValue(undefined);
    (facturaService.garantizarPagada as any).mockResolvedValue(undefined);

    mockTx.pago.create.mockResolvedValue({});
    mockTx.orden.update.mockResolvedValue({ ...mockOrdenBase, id_estado: 4 });

    await ordenService.actualizarEstado(1, 4, CTX_SUPERADMIN, [{ id_metodo_pago: 1, monto: 10000 }]);

    expect(recetaService.descontarIngredientesOrden).toHaveBeenCalledWith(1, mockTx);
  });

  it('garantiza la factura (crea si falta) al pasar a ENTREGADA, incluso si se saltó EN_PREPARACION', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce({ ...mockOrdenBase, total: new Decimal('10000') });
    (estadoRepository.findTransicion as any).mockResolvedValue({ id: 1 });
    (estadoRepository.findById as any).mockResolvedValue({ id: 4, codigo: 'ENTREGADA' });
    (recetaService.verificarStockParaOrden as any).mockResolvedValue({ ok: true });
    (recetaService.descontarIngredientesOrden as any).mockResolvedValue(undefined);
    (facturaService.garantizarPagada as any).mockResolvedValue(undefined);

    mockTx.pago.create.mockResolvedValue({});
    mockTx.orden.update.mockResolvedValue({ ...mockOrdenBase, id_estado: 4 });

    await ordenService.actualizarEstado(1, 4, CTX_SUPERADMIN, [{ id_metodo_pago: 1, monto: 10000 }]);

    // No importa si la orden nunca pasó por EN_PREPARACION (facturaExistente): garantizarPagada
    // se encarga de crear la factura si falta antes de marcarla pagada.
    expect(facturaService.garantizarPagada).toHaveBeenCalledWith(1, mockTx);
  });
});

// ── actualizarEstadoLegado ────────────────────────────────────────────────────

describe('ordenService.actualizarEstadoLegado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza BadRequestError si la orden ya fue entregada (protección contra doble descuento)', async () => {
    (ordenRepository.findById as any).mockResolvedValue({ ...mockOrdenBase, estado_global: 'ENTREGADA' });

    await expect(
      ordenService.actualizarEstadoLegado(1, [{ id_metodo_pago: 1, monto: 25000 }])
    ).rejects.toThrow(BadRequestError);
    expect(recetaService.descontarIngredientesOrden).not.toHaveBeenCalled();
  });

  it('descuenta ingredientes al entregar una orden que no había sido entregada', async () => {
    (ordenRepository.findById as any).mockResolvedValue({ ...mockOrdenBase, estado_global: 'EN_PROCESO', total: new Decimal('25000') });
    (facturaService.garantizarPagada as any).mockResolvedValue(undefined);
    (recetaService.descontarIngredientesOrden as any).mockResolvedValue(undefined);
    mockTx.pago.create.mockResolvedValue({});
    mockTx.orden.update.mockResolvedValue({ ...mockOrdenBase, estado_global: 'ENTREGADA' });
    mockTx.orden.findUnique.mockResolvedValue({ ...mockOrdenBase, estado_global: 'ENTREGADA' });

    await ordenService.actualizarEstadoLegado(1, [{ id_metodo_pago: 1, monto: 25000 }]);

    expect(recetaService.descontarIngredientesOrden).toHaveBeenCalledWith(1, mockTx);
  });
});

// ── agregarDetalle ────────────────────────────────────────────────────────────

describe('ordenService.agregarDetalle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('llama verificarDisponibilidadParaDetalles antes de abrir la transacción', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(mockOrdenBase);
    (recetaService.verificarDisponibilidadParaDetalles as any).mockResolvedValue({ ok: true });

    mockTx.receta.findFirst.mockResolvedValue(null); // sin receta
    mockTx.producto.findUnique.mockResolvedValue({ id: 7, nombre: 'Jugo', stock_actual: new Decimal('5'), unidad_medida: 'unidad' });
    mockTx.producto.update.mockResolvedValue({});
    mockTx.ordenDetalle.create.mockResolvedValue({ id: 20, id_producto: 7 });
    mockTx.ordenDetalle.findMany.mockResolvedValue([]);
    mockTx.orden.findUnique.mockResolvedValue(mockOrdenBase);
    mockTx.orden.update.mockResolvedValue({});

    await ordenService.agregarDetalle(1, { id_producto: 7, cantidad: 2, precio_unitario: 5000 }, CTX_SUPERADMIN);

    expect(recetaService.verificarDisponibilidadParaDetalles).toHaveBeenCalledWith([
      { id_producto: 7, cantidad: 2 },
    ]);
  });

  it('no agrega el detalle si verificarDisponibilidadParaDetalles lanza error', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(mockOrdenBase);
    (recetaService.verificarDisponibilidadParaDetalles as any).mockRejectedValue(
      new BadRequestError('Ingredientes insuficientes')
    );

    await expect(
      ordenService.agregarDetalle(1, { id_producto: 7, cantidad: 2, precio_unitario: 5000 }, CTX_SUPERADMIN)
    ).rejects.toThrow(BadRequestError);

    expect(mockTx.ordenDetalle.create).not.toHaveBeenCalled();
  });

  it('NO toca stock ni exige stock suficiente si el producto tiene receta activa', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(mockOrdenBase);
    (recetaService.verificarDisponibilidadParaDetalles as any).mockResolvedValue({ ok: true });

    mockTx.receta.findFirst.mockResolvedValue({ id: 99 }); // tiene receta
    mockTx.producto.findUnique.mockResolvedValue({ id: 7, nombre: 'Bandeja', stock_actual: new Decimal('0'), unidad_medida: 'unidad' });
    mockTx.ordenDetalle.create.mockResolvedValue({ id: 20, id_producto: 7 });
    mockTx.ordenDetalle.findMany.mockResolvedValue([]);
    mockTx.orden.findUnique.mockResolvedValue(mockOrdenBase);
    mockTx.orden.update.mockResolvedValue({});

    // stock_actual = 0, pero al tener receta no debe validar "stock insuficiente"
    await ordenService.agregarDetalle(1, { id_producto: 7, cantidad: 5, precio_unitario: 5000 }, CTX_SUPERADMIN);

    expect(mockTx.producto.update).not.toHaveBeenCalled();
  });

  it('lanza BadRequestError si la orden no permite edición en su estado actual', async () => {
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce({
      ...mockOrdenBase, estado: { id: 4, codigo: 'ENTREGADA', permite_edicion: false },
    });

    await expect(
      ordenService.agregarDetalle(1, { id_producto: 7, cantidad: 2, precio_unitario: 5000 }, CTX_SUPERADMIN)
    ).rejects.toThrow(BadRequestError);
    expect(recetaService.verificarDisponibilidadParaDetalles).not.toHaveBeenCalled();
  });
});

// ── actualizarDetalle ─────────────────────────────────────────────────────────

describe('ordenService.actualizarDetalle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('llama verificarDisponibilidadParaDetalles cuando la cantidad aumenta', async () => {
    // Guard: findDetalleById → findByIdScoped
    (ordenRepository.findDetalleById as any).mockResolvedValueOnce({ id: 10, id_orden: 1, id_producto: 5, cantidad: new Decimal(2) });
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(mockOrdenBase);
    // Pre-check cantidad (dentro del if)
    (prisma.ordenDetalle.findUnique as any).mockResolvedValue({
      id: 10, id_producto: 5, cantidad: new Decimal(2),
    });
    (recetaService.verificarDisponibilidadParaDetalles as any).mockResolvedValue({ ok: true });

    mockTx.ordenDetalle.findUnique.mockResolvedValue({
      id: 10, id_producto: 5, cantidad: new Decimal(2),
      precio_unitario: new Decimal(5000), descuento: new Decimal(0),
      producto: { stock_actual: new Decimal(10) },
    });
    mockTx.ordenDetalle.update.mockResolvedValue({});
    mockTx.producto.update.mockResolvedValue({});
    mockTx.ordenDetalle.findMany.mockResolvedValue([]);
    mockTx.orden.findUnique.mockResolvedValue(mockOrdenBase);
    mockTx.orden.update.mockResolvedValue({});

    await ordenService.actualizarDetalle(10, { cantidad: 5 }, CTX_SUPERADMIN); // 5 > 2 → verifica dif = 3

    expect(recetaService.verificarDisponibilidadParaDetalles).toHaveBeenCalledWith([
      { id_producto: 5, cantidad: 3 }, // diferencia = 5 - 2 = 3
    ]);
  });

  it('NO llama verificarDisponibilidadParaDetalles cuando la cantidad baja', async () => {
    // Guard: findDetalleById → findByIdScoped
    (ordenRepository.findDetalleById as any).mockResolvedValueOnce({ id: 10, id_orden: 1, id_producto: 5, cantidad: new Decimal(5) });
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(mockOrdenBase);
    (prisma.ordenDetalle.findUnique as any).mockResolvedValue({
      id: 10, id_producto: 5, cantidad: new Decimal(5),
    });

    mockTx.ordenDetalle.findUnique.mockResolvedValue({
      id: 10, id_producto: 5, cantidad: new Decimal(5),
      precio_unitario: new Decimal(5000), descuento: new Decimal(0),
      id_orden: 1,
      producto: { stock_actual: new Decimal(10) },
    });
    mockTx.ordenDetalle.update.mockResolvedValue({});
    mockTx.producto.update.mockResolvedValue({});
    mockTx.ordenDetalle.findMany.mockResolvedValue([]);
    mockTx.orden.findUnique.mockResolvedValue(mockOrdenBase);
    mockTx.orden.update.mockResolvedValue({});

    await ordenService.actualizarDetalle(10, { cantidad: 2 }, CTX_SUPERADMIN); // 2 < 5 → no verifica

    expect(recetaService.verificarDisponibilidadParaDetalles).not.toHaveBeenCalled();
  });

  it('NO toca stock si el producto tiene receta activa, aunque cambie la cantidad', async () => {
    (ordenRepository.findDetalleById as any).mockResolvedValueOnce({ id: 10, id_orden: 1, id_producto: 5, cantidad: new Decimal(2) });
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(mockOrdenBase);
    (prisma.ordenDetalle.findUnique as any).mockResolvedValue({ id: 10, id_producto: 5, cantidad: new Decimal(2) });
    (recetaService.verificarDisponibilidadParaDetalles as any).mockResolvedValue({ ok: true });

    mockTx.receta.findFirst.mockResolvedValue({ id: 99 }); // tiene receta
    mockTx.ordenDetalle.findUnique.mockResolvedValue({
      id: 10, id_producto: 5, cantidad: new Decimal(2),
      precio_unitario: new Decimal(5000), descuento: new Decimal(0),
      producto: { stock_actual: new Decimal(0) }, // insuficiente si se validara, pero tiene receta
    });
    mockTx.ordenDetalle.update.mockResolvedValue({});
    mockTx.ordenDetalle.findMany.mockResolvedValue([]);
    mockTx.orden.findUnique.mockResolvedValue(mockOrdenBase);
    mockTx.orden.update.mockResolvedValue({});

    await ordenService.actualizarDetalle(10, { cantidad: 5 }, CTX_SUPERADMIN);

    expect(mockTx.producto.update).not.toHaveBeenCalled();
  });

  it('lanza BadRequestError si la orden no permite edición en su estado actual', async () => {
    (ordenRepository.findDetalleById as any).mockResolvedValueOnce({ id: 10, id_orden: 1, id_producto: 5, cantidad: new Decimal(2) });
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce({
      ...mockOrdenBase, estado: { id: 5, codigo: 'CANCELADA', permite_edicion: false },
    });

    await expect(
      ordenService.actualizarDetalle(10, { cantidad: 5 }, CTX_SUPERADMIN)
    ).rejects.toThrow(BadRequestError);
  });
});

// ── eliminar ──────────────────────────────────────────────────────────────────

describe('ordenService.eliminar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve stock del producto SIN receta al eliminar la orden', async () => {
    const detalles = [{ id: 10, id_producto: 5, cantidad: new Decimal(3) }];
    (ordenRepository.findById as any).mockResolvedValue({ ...mockOrdenBase, detalles });

    mockTx.receta.findFirst.mockResolvedValue(null); // sin receta
    const mockProd = { id: 5, stock_actual: new Decimal('7') };
    mockTx.producto.findUnique.mockResolvedValue(mockProd);
    mockTx.producto.update.mockResolvedValue({});
    mockTx.ordenDetalle.deleteMany.mockResolvedValue({});
    mockTx.orden.delete.mockResolvedValue({});

    await ordenService.eliminar(1);

    // stock devuelto: 7 + 3 = 10
    expect(mockTx.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 } })
    );
  });

  it('NO devuelve stock del producto CON receta al eliminar (nunca se descontó)', async () => {
    const detalles = [{ id: 10, id_producto: 5, cantidad: new Decimal(2) }];
    (ordenRepository.findById as any).mockResolvedValue({ ...mockOrdenBase, detalles });

    mockTx.receta.findFirst.mockResolvedValue({ id: 99 }); // tiene receta
    mockTx.ordenDetalle.deleteMany.mockResolvedValue({});
    mockTx.orden.delete.mockResolvedValue({});

    await ordenService.eliminar(1);

    expect(mockTx.producto.update).not.toHaveBeenCalled();
  });

  it('lanza NotFoundError si la orden no existe', async () => {
    (ordenRepository.findById as any).mockResolvedValue(null);

    await expect(ordenService.eliminar(999)).rejects.toThrow(NotFoundError);
    expect(mockTx.orden.delete).not.toHaveBeenCalled();
  });

  it('lanza BadRequestError si la orden ya está en un estado final (entregada o cancelada)', async () => {
    (ordenRepository.findById as any).mockResolvedValue({
      ...mockOrdenBase, estado: { id: 4, codigo: 'ENTREGADA', es_final: true },
    });

    await expect(ordenService.eliminar(1)).rejects.toThrow(BadRequestError);
    expect(mockTx.orden.delete).not.toHaveBeenCalled();
  });
});

// ── pagar — tenant guard (Oleada 2b) ─────────────────────────────────────────

describe('ordenService.pagar — tenant guard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupIva(false);
  });

  it('lanza ForbiddenError cuando ctx no tiene tenant', async () => {
    (ordenRepository.findByIdScoped as any)
      .mockRejectedValueOnce(new ForbiddenError('Se requiere contexto de restaurante para esta operación'));

    await expect(ordenService.pagar(100, [], CTX_SIN_TENANT))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lanza NotFoundError cuando la orden pertenece a otro restaurante (IDOR)', async () => {
    (ordenRepository.findByIdScoped as any)
      .mockRejectedValueOnce(new NotFoundError('Registro 100 no encontrado'));

    await expect(ordenService.pagar(100, [], CTX_RESTAURANTE_1))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('superadmin puede pagar una orden de cualquier restaurante', async () => {
    const sedes = [{ id: 5, id_restaurante: 99, items: [] }];
    const orden = { ...mockOrdenBase, id_restaurante: 99, estado_global: EstadoOrdenGlobal.LISTA, sedes, total: new Decimal('10000') };
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(orden);
    (prisma.$transaction as any).mockResolvedValueOnce({ ...orden, sedes });

    await expect(ordenService.pagar(100, [{ id_metodo_pago: 1, monto: 10000 }], CTX_SUPERADMIN))
      .resolves.toBeDefined();
  });

  it('caso feliz: cajero del restaurante 1 paga su orden', async () => {
    const sedes = [{ id: 5, id_restaurante: 1, items: [] }];
    const orden = { ...mockOrdenBase, id_restaurante: 1, estado_global: EstadoOrdenGlobal.LISTA, sedes, total: new Decimal('10000') };
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(orden);
    (prisma.$transaction as any).mockResolvedValueOnce({ ...orden, sedes });

    await expect(ordenService.pagar(100, [{ id_metodo_pago: 1, monto: 10000 }], CTX_RESTAURANTE_1))
      .resolves.toBeDefined();
    expect(ordenRepository.findByIdScoped).toHaveBeenCalledWith(100, CTX_RESTAURANTE_1);
  });
});

// ── cancelar — tenant guard (Oleada 2b) ──────────────────────────────────────

describe('ordenService.cancelar — tenant guard', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lanza ForbiddenError cuando ctx no tiene tenant', async () => {
    (ordenRepository.findByIdScoped as any)
      .mockRejectedValueOnce(new ForbiddenError('Se requiere contexto de restaurante para esta operación'));

    await expect(ordenService.cancelar(100, CTX_SIN_TENANT))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lanza NotFoundError cuando la orden pertenece a otro restaurante (IDOR)', async () => {
    (ordenRepository.findByIdScoped as any)
      .mockRejectedValueOnce(new NotFoundError('Registro 100 no encontrado'));

    await expect(ordenService.cancelar(100, CTX_RESTAURANTE_1))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('superadmin puede cancelar una orden de cualquier restaurante', async () => {
    const orden = { ...mockOrdenBase, id_restaurante: 99, estado_global: EstadoOrdenGlobal.EN_PROCESO, sedes: [{ id: 5, items: [] }] };
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(orden);
    (prisma.$transaction as any).mockResolvedValueOnce(undefined);

    await expect(ordenService.cancelar(100, CTX_SUPERADMIN, 'motivo'))
      .resolves.toBeUndefined();
  });

  it('caso feliz: cajero del restaurante 1 cancela su orden', async () => {
    const orden = { ...mockOrdenBase, id_restaurante: 1, estado_global: EstadoOrdenGlobal.EN_PROCESO, sedes: [{ id: 5, items: [] }] };
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(orden);
    (prisma.$transaction as any).mockResolvedValueOnce(undefined);

    await expect(ordenService.cancelar(100, CTX_RESTAURANTE_1, 'cliente canceló'))
      .resolves.toBeUndefined();
    expect(ordenRepository.findByIdScoped).toHaveBeenCalledWith(100, CTX_RESTAURANTE_1);
  });
});

// ── actualizarDetalle — tenant guard vía orden padre (Oleada 2b) ──────────────

describe('ordenService.actualizarDetalle — tenant guard vía orden padre', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lanza NotFoundError cuando el detalle no existe', async () => {
    (ordenRepository.findDetalleById as any).mockResolvedValueOnce(null);

    await expect(ordenService.actualizarDetalle(50, { notas: 'test' }, CTX_RESTAURANTE_1))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('lanza NotFoundError cuando la orden padre es de otro restaurante (IDOR)', async () => {
    (ordenRepository.findDetalleById as any)
      .mockResolvedValueOnce({ id: 50, id_orden: 100, id_producto: 7 });
    (ordenRepository.findByIdScoped as any)
      .mockRejectedValueOnce(new NotFoundError('Registro 100 no encontrado'));

    await expect(ordenService.actualizarDetalle(50, { notas: 'test' }, CTX_RESTAURANTE_1))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('caso feliz: actualiza notas sin cambiar cantidad', async () => {
    (ordenRepository.findDetalleById as any)
      .mockResolvedValueOnce({ id: 50, id_orden: 100, id_producto: 7 });
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(mockOrdenBase);
    (prisma.$transaction as any).mockResolvedValueOnce({ id: 50, notas: 'sin cebolla' });

    const result = await ordenService.actualizarDetalle(50, { notas: 'sin cebolla' }, CTX_RESTAURANTE_1);
    expect(result).toBeDefined();
    expect(ordenRepository.findByIdScoped).toHaveBeenCalledWith(100, CTX_RESTAURANTE_1);
  });
});

// ── eliminarDetalle — tenant guard vía orden padre (Oleada 2b) ────────────────

describe('ordenService.eliminarDetalle — tenant guard vía orden padre', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lanza NotFoundError cuando el detalle no existe', async () => {
    (ordenRepository.findDetalleById as any).mockResolvedValueOnce(null);

    await expect(ordenService.eliminarDetalle(50, CTX_RESTAURANTE_1))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('lanza NotFoundError cuando la orden padre es de otro restaurante (IDOR)', async () => {
    (ordenRepository.findDetalleById as any)
      .mockResolvedValueOnce({ id: 50, id_orden: 100, id_producto: 7 });
    (ordenRepository.findByIdScoped as any)
      .mockRejectedValueOnce(new NotFoundError('Registro 100 no encontrado'));

    await expect(ordenService.eliminarDetalle(50, CTX_RESTAURANTE_1))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('caso feliz: dueño legítimo elimina su detalle', async () => {
    (ordenRepository.findDetalleById as any)
      .mockResolvedValueOnce({ id: 50, id_orden: 100, id_producto: 7 });
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce(mockOrdenBase);
    (prisma.$transaction as any).mockResolvedValueOnce(undefined);

    await expect(ordenService.eliminarDetalle(50, CTX_RESTAURANTE_1))
      .resolves.toBeUndefined();
    expect(ordenRepository.findByIdScoped).toHaveBeenCalledWith(100, CTX_RESTAURANTE_1);
  });

  it('lanza BadRequestError si la orden no permite edición en su estado actual', async () => {
    (ordenRepository.findDetalleById as any)
      .mockResolvedValueOnce({ id: 50, id_orden: 100, id_producto: 7 });
    (ordenRepository.findByIdScoped as any).mockResolvedValueOnce({
      ...mockOrdenBase, estado: { id: 4, codigo: 'ENTREGADA', permite_edicion: false },
    });

    await expect(ordenService.eliminarDetalle(50, CTX_RESTAURANTE_1))
      .rejects.toThrow(BadRequestError);
  });
});
