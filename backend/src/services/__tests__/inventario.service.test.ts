import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TipoMovimiento } from '@prisma/client';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/movimiento.repository', () => ({
  movimientoRepository: {
    findAll:               vi.fn(),
    groupByTipo:           vi.fn(),
    count:                 vi.fn(),
    findDistinctProductos: vi.fn(),
    sumMermaByLote:        vi.fn(),
  },
}));

vi.mock('../../repositories/producto.repository', () => ({
  productoRepository: { findActivos: vi.fn() },
}));

vi.mock('../../repositories/lote.repository', () => ({
  loteRepository: {
    findProximosVencer:      vi.fn(),
    findAll:                 vi.fn(),
    findById:                vi.fn(),
    findByIdWithReceta:      vi.fn(),
    findActivosPorProducto:  vi.fn(),
    update:                  vi.fn(),
  },
}));

// Prisma: $transaction delega al callback usando un tx con product + productoStock + lote + movimiento
const mockTx = {
  producto: {
    findUnique: vi.fn(),
    update:     vi.fn(),
  },
  // ProductoStock — per-restaurante: findUnique para leer stock base, upsert para escribir
  productoStock: {
    findUnique: vi.fn(),
    upsert:     vi.fn(),
  },
  lote: {
    findFirst:  vi.fn(),
    create:     vi.fn(),
    findUnique: vi.fn(),
    update:     vi.fn(),
  },
  movimiento: {
    create:    vi.fn(),
    aggregate: vi.fn(),
  },
};

vi.mock('../../config/database', () => ({
  default: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
    lote: { findMany: vi.fn() },
  },
}));

// ── Imports DESPUÉS de los mocks ───────────────────────────────────────────────

import { inventarioService } from '../inventario.service';
import { loteRepository } from '../../repositories/lote.repository';

const loteRepo = loteRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;
import { movimientoRepository } from '../../repositories/movimiento.repository';
import prisma from '../../config/database';

const movRepo = movimientoRepository as ReturnType<typeof vi.fn> & typeof movimientoRepository;
const prismaMock = prisma as unknown as { lote: { findMany: ReturnType<typeof vi.fn> } };

const mockProducto = { id: 1, nombre: 'Harina', stock_actual: 100, es_vendible: false };
const mockMovimiento = {
  id: 1, id_producto: 1, tipo_movimiento: TipoMovimiento.entrada,
  cantidad: 50, stock_anterior: 100, stock_nuevo: 150,
  motivo: 'Reposición', producto: mockProducto,
};

beforeEach(() => vi.clearAllMocks());

// ── listarMovimientos ─────────────────────────────────────────────────────────

describe('listarMovimientos', () => {
  it('devuelve resultado paginado', async () => {
    (movRepo.findAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([[mockMovimiento], 1]);

    const result = await inventarioService.listarMovimientos({ page: 1, limit: 20, id_restaurante: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });
});

// ── registrarMovimiento ───────────────────────────────────────────────────────

describe('registrarMovimiento', () => {
  it('registra una entrada con generar_lote y crea el lote', async () => {
    mockTx.producto.findUnique.mockResolvedValueOnce(mockProducto);
    mockTx.productoStock.findUnique.mockResolvedValueOnce(null); // sin registro previo → usa producto.stock_actual
    mockTx.lote.findFirst.mockResolvedValueOnce({ numero_lote: 'LOTE-000001' });
    mockTx.lote.create.mockResolvedValueOnce({ id: 10, numero_lote: 'LOTE-000002' });
    mockTx.productoStock.upsert.mockResolvedValueOnce({});
    mockTx.producto.update.mockResolvedValueOnce({});
    mockTx.movimiento.create.mockResolvedValueOnce(mockMovimiento);
    mockTx.lote.findUnique.mockResolvedValueOnce({ id: 10, numero_lote: 'LOTE-000002' });

    const result = await inventarioService.registrarMovimiento({
      id_producto:     1,
      id_restaurante:  1,
      tipo_movimiento: TipoMovimiento.entrada,
      cantidad:        50,
      motivo:          'Reposición',
      id_proveedor:    2,
      generar_lote:    true,
    });

    expect(result.movimiento.tipo_movimiento).toBe(TipoMovimiento.entrada);
    expect(result.lote_generado).toBeTruthy();
    expect(mockTx.lote.create).toHaveBeenCalled();
  });

  it('registra una entrada manual sin proveedor y sin lote (solo suma stock)', async () => {
    mockTx.producto.findUnique.mockResolvedValueOnce(mockProducto);
    mockTx.productoStock.findUnique.mockResolvedValueOnce(null);
    mockTx.productoStock.upsert.mockResolvedValueOnce({});
    mockTx.producto.update.mockResolvedValueOnce({});
    mockTx.movimiento.create.mockResolvedValueOnce({ ...mockMovimiento, id_proveedor: undefined });

    const result = await inventarioService.registrarMovimiento({
      id_producto:     1,
      id_restaurante:  1,
      tipo_movimiento: TipoMovimiento.entrada,
      cantidad:        50,
      motivo:          'Conteo físico — encontramos más stock',
    });

    expect(result.movimiento).toBeTruthy();
    expect(result.lote_generado).toBeNull();
    expect(mockTx.lote.create).not.toHaveBeenCalled();
  });

  it('lanza BadRequestError si generar_lote sobre un producto vendible (ensamblado)', async () => {
    mockTx.producto.findUnique.mockResolvedValueOnce({ ...mockProducto, es_vendible: true });

    await expect(inventarioService.registrarMovimiento({
      id_producto:     1,
      id_restaurante:  1,
      tipo_movimiento: TipoMovimiento.entrada,
      cantidad:        5,
      motivo:          'Hamburguesa ensamblada',
      generar_lote:    true,
    })).rejects.toThrow('solo aplican a productos que se almacenan');
  });

  it('merma con id_lote existente acumula la merma y cierra el lote al agotarse', async () => {
    mockTx.producto.findUnique.mockResolvedValueOnce(mockProducto);
    mockTx.productoStock.findUnique.mockResolvedValueOnce({ stock_actual: 100 });
    mockTx.lote.findUnique.mockResolvedValueOnce({
      id: 10, id_producto: 1, id_restaurante: 1,
      cantidad_producida: '20', merma_cantidad: '0', fecha_cierre: null,
    });
    mockTx.movimiento.aggregate.mockResolvedValueOnce({ _sum: { cantidad: null } }); // sin salidas previas
    mockTx.lote.update.mockResolvedValueOnce({});
    mockTx.productoStock.upsert.mockResolvedValueOnce({});
    mockTx.producto.update.mockResolvedValueOnce({});
    mockTx.movimiento.create.mockResolvedValueOnce({ ...mockMovimiento, tipo_movimiento: TipoMovimiento.merma });

    await inventarioService.registrarMovimiento({
      id_producto:     1,
      id_restaurante:  1,
      tipo_movimiento: TipoMovimiento.merma,
      cantidad:        20, // agota toda la cantidad producida del lote
      motivo:          'Se dañó el lote completo',
      id_lote:         10,
    });

    expect(mockTx.lote.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        merma_cantidad:   expect.anything(),
        merma_porcentaje: expect.anything(),
        estado_lote:      'agotado',
        fecha_cierre:     expect.any(Date),
      }),
    });
  });

  it('lanza NotFoundError si producto no existe', async () => {
    mockTx.producto.findUnique.mockResolvedValueOnce(null);

    await expect(inventarioService.registrarMovimiento({
      id_producto:     99,
      id_restaurante:  1,
      tipo_movimiento: TipoMovimiento.salida,
      cantidad:        10,
      motivo:          'Prueba',
    })).rejects.toThrow('Producto');
  });

  it('lanza BadRequestError si stock insuficiente para salida', async () => {
    mockTx.producto.findUnique.mockResolvedValueOnce({ ...mockProducto, stock_actual: 5 });
    mockTx.productoStock.findUnique.mockResolvedValueOnce(null); // null → usa producto.stock_actual = 5

    await expect(inventarioService.registrarMovimiento({
      id_producto:     1,
      id_restaurante:  1,
      tipo_movimiento: TipoMovimiento.salida,
      cantidad:        10,
      motivo:          'Sin stock',
    })).rejects.toThrow('Stock insuficiente');
  });

  it('registra ajuste (establece stock al valor exacto)', async () => {
    mockTx.producto.findUnique.mockResolvedValueOnce(mockProducto);
    mockTx.productoStock.findUnique.mockResolvedValueOnce(null);
    mockTx.productoStock.upsert.mockResolvedValueOnce({});
    mockTx.producto.update.mockResolvedValueOnce({});
    mockTx.movimiento.create.mockResolvedValueOnce({
      ...mockMovimiento,
      tipo_movimiento: TipoMovimiento.ajuste,
      stock_nuevo: 200,
    });

    const result = await inventarioService.registrarMovimiento({
      id_producto:     1,
      id_restaurante:  1,
      tipo_movimiento: TipoMovimiento.ajuste,
      cantidad:        200,
      motivo:          'Conteo físico',
    });

    expect(result.movimiento.stock_nuevo).toBe(200);
    expect(result.lote_generado).toBeNull();
  });

  it('registra devolucion sin requerir proveedor', async () => {
    mockTx.producto.findUnique.mockResolvedValueOnce(mockProducto);
    mockTx.productoStock.findUnique.mockResolvedValueOnce(null);
    mockTx.productoStock.upsert.mockResolvedValueOnce({});
    mockTx.producto.update.mockResolvedValueOnce({});
    mockTx.movimiento.create.mockResolvedValueOnce({
      ...mockMovimiento, tipo_movimiento: TipoMovimiento.devolucion,
    });

    const result = await inventarioService.registrarMovimiento({
      id_producto:     1,
      id_restaurante:  1,
      tipo_movimiento: TipoMovimiento.devolucion,
      cantidad:        5,
      motivo:          'Devolución cliente',
    });

    expect(result.movimiento).toBeTruthy();
    expect(mockTx.lote.create).not.toHaveBeenCalled();
  });

  it('devolucion resta stock (es una pérdida, no un reingreso)', async () => {
    mockTx.producto.findUnique.mockResolvedValueOnce(mockProducto); // stock_actual: 100
    mockTx.productoStock.findUnique.mockResolvedValueOnce(null);
    mockTx.productoStock.upsert.mockResolvedValueOnce({});
    mockTx.producto.update.mockResolvedValueOnce({});
    mockTx.movimiento.create.mockResolvedValueOnce({
      ...mockMovimiento, tipo_movimiento: TipoMovimiento.devolucion,
    });

    await inventarioService.registrarMovimiento({
      id_producto:     1,
      id_restaurante:  1,
      tipo_movimiento: TipoMovimiento.devolucion,
      cantidad:        5,
      motivo:          'Devolución cliente',
    });

    expect(mockTx.productoStock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ stock_actual: expect.anything() }),
      })
    );
    const stockEscrito = Number(mockTx.productoStock.upsert.mock.calls[0][0].update.stock_actual);
    expect(stockEscrito).toBe(95); // 100 - 5, no 105
  });

  it('lanza BadRequestError si no hay stock suficiente para una devolucion', async () => {
    mockTx.producto.findUnique.mockResolvedValueOnce({ ...mockProducto, stock_actual: 2 });
    mockTx.productoStock.findUnique.mockResolvedValueOnce(null);

    await expect(inventarioService.registrarMovimiento({
      id_producto:     1,
      id_restaurante:  1,
      tipo_movimiento: TipoMovimiento.devolucion,
      cantidad:        5,
      motivo:          'Devolución cliente',
    })).rejects.toThrow('Stock insuficiente');
  });

  it('devolucion con id_lote existente se vincula al lote y lo cierra si se agota', async () => {
    mockTx.producto.findUnique.mockResolvedValueOnce(mockProducto);
    mockTx.productoStock.findUnique.mockResolvedValueOnce({ stock_actual: 100 });
    mockTx.lote.findUnique.mockResolvedValueOnce({
      id: 10, id_producto: 1, id_restaurante: 1,
      cantidad_producida: '5', merma_cantidad: '0', fecha_cierre: null,
    });
    mockTx.movimiento.aggregate.mockResolvedValueOnce({ _sum: { cantidad: null } }); // sin salidas previas
    mockTx.lote.update.mockResolvedValueOnce({});
    mockTx.productoStock.upsert.mockResolvedValueOnce({});
    mockTx.producto.update.mockResolvedValueOnce({});
    mockTx.movimiento.create.mockResolvedValueOnce({ ...mockMovimiento, tipo_movimiento: TipoMovimiento.devolucion });

    await inventarioService.registrarMovimiento({
      id_producto:     1,
      id_restaurante:  1,
      tipo_movimiento: TipoMovimiento.devolucion,
      cantidad:        5, // agota toda la cantidad producida del lote
      motivo:          'Devolución cliente',
      id_lote:         10,
    });

    // La devolución NO acumula merma_cantidad (eso solo aplica a tipo 'merma')
    expect(mockTx.lote.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        estado_lote:  'agotado',
        fecha_cierre: expect.any(Date),
      }),
    });
    expect(mockTx.lote.update.mock.calls[0][0].data.merma_cantidad).toBeUndefined();
  });
});

// ── actualizarEstadoLote ──────────────────────────────────────────────────────

describe('actualizarEstadoLote', () => {
  it('estampa fecha_cierre la primera vez que el lote pasa a agotado', async () => {
    loteRepo.findById.mockResolvedValueOnce({ id: 1, fecha_cierre: null });
    loteRepo.update.mockResolvedValueOnce({});

    await inventarioService.actualizarEstadoLote(1, { estado_lote: 'agotado' as never });

    expect(loteRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({
      estado_lote:  'agotado',
      fecha_cierre: expect.any(Date),
    }));
  });

  it('no vuelve a estampar fecha_cierre si el lote ya estaba cerrado', async () => {
    const yaCerrado = new Date('2026-01-01');
    loteRepo.findById.mockResolvedValueOnce({ id: 1, fecha_cierre: yaCerrado });
    loteRepo.update.mockResolvedValueOnce({});

    await inventarioService.actualizarEstadoLote(1, { estado_lote: 'vencido' as never });

    const dataEnviada = loteRepo.update.mock.calls[0][1];
    expect(dataEnviada.fecha_cierre).toBeUndefined();
  });

  it('lanza NotFoundError si el lote no existe', async () => {
    loteRepo.findById.mockResolvedValueOnce(null);

    await expect(inventarioService.actualizarEstadoLote(999, { observaciones: 'x' }))
      .rejects.toThrow('Lote');
  });
});

// ── vidaUtilPromedio ──────────────────────────────────────────────────────────

describe('vidaUtilPromedio', () => {
  it('combina duración real observada con la estimación declarada', async () => {
    prismaMock.lote.findMany.mockResolvedValueOnce([
      {
        id_producto: 1, vida_util_dias: 5,
        fecha_produccion: new Date('2026-01-01'),
        fecha_cierre:     new Date('2026-01-08'), // 7 días reales
        producto: { nombre: 'Salsa casera', sku: 'MPP-SALSA' },
      },
      {
        id_producto: 1, vida_util_dias: 6,
        fecha_produccion: new Date('2026-02-01'),
        fecha_cierre:     null, // aún abierto — no cuenta para el real
        producto: { nombre: 'Salsa casera', sku: 'MPP-SALSA' },
      },
    ]);

    const [resultado] = await inventarioService.vidaUtilPromedio(1);

    expect(resultado.dias_reales_promedio).toBe(7);
    expect(resultado.muestras_reales).toBe(1);
    expect(resultado.dias_estimados_promedio).toBe(5.5);
    expect(resultado.muestras_estimadas).toBe(2);
  });

  it('devuelve null cuando no hay ninguna muestra real', async () => {
    prismaMock.lote.findMany.mockResolvedValueOnce([
      {
        id_producto: 2, vida_util_dias: 3,
        fecha_produccion: new Date('2026-02-01'),
        fecha_cierre:     null,
        producto: { nombre: 'Masa', sku: 'MPP-MASA' },
      },
    ]);

    const [resultado] = await inventarioService.vidaUtilPromedio(1);

    expect(resultado.dias_reales_promedio).toBeNull();
    expect(resultado.muestras_reales).toBe(0);
    expect(resultado.dias_estimados_promedio).toBe(3);
  });
});

// ── calcularRentabilidadLote ──────────────────────────────────────────────────

const movRepo2 = movimientoRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;

const makeLote = (overrides: Record<string, unknown> = {}) => ({
  id:               1,
  numero_lote:      'LOT-001',
  id_restaurante:   10,
  cantidad_producida: '100',
  restaurante:      { id: 10 },
  producto: {
    nombre:       'Hamburguesa',
    precio_venta: '12.00',
    recetas_como_final: [{
      ingredientes: [
        {
          cantidad: '0.2',
          unidad:   'kilogramo',
          producto: {
            nombre: 'Carne',
            unidad_medida: 'kilogramo',
            proveedor_productos: [{ precio_unitario: '50', es_proveedor_preferido: true }],
          },
        },
      ],
    }],
  },
  ...overrides,
});

describe('calcularRentabilidadLote', () => {
  it('calcula rentabilidad correcta con merma real', async () => {
    loteRepo.findByIdWithReceta.mockResolvedValueOnce(makeLote());
    // 10 unidades de merma de 100 producidas = 10%
    movRepo2.sumMermaByLote.mockResolvedValueOnce({ _sum: { cantidad: '10' } });

    const r = await inventarioService.calcularRentabilidadLote(1, 10);

    // costo_ingredientes = 0.2 kg × $50 = $10
    expect(r.costo_ingredientes).toBe(10);
    // merma 10% → costo_con_merma = 10 / 0.9 ≈ 11.11
    expect(r.costo_con_merma).toBeCloseTo(11.11, 1);
    expect(r.merma_real_porcentaje).toBe(10);
    // cantidad_vendida = 100 - 10 = 90; ingresos = 90 × 12 = 1080
    expect(r.cantidad_vendida).toBe(90);
    expect(r.ingresos).toBeCloseTo(1080, 0);
    expect(r.ganancia_neta).toBeCloseTo(1068.89, 0);
  });

  it('asume merma 0% si no hay movimientos de merma', async () => {
    loteRepo.findByIdWithReceta.mockResolvedValueOnce(makeLote());
    movRepo2.sumMermaByLote.mockResolvedValueOnce({ _sum: { cantidad: null } });

    const r = await inventarioService.calcularRentabilidadLote(1, 10);

    expect(r.merma_real_cantidad).toBe(0);
    expect(r.merma_real_porcentaje).toBe(0);
    expect(r.costo_con_merma).toBe(r.costo_ingredientes);
    expect(r.perdida_merma).toBe(0);
  });

  it('devuelve ganancia negativa si merma consume casi toda la producción', async () => {
    // precio proveedor $100/kg → costo_ingredientes = 0.2 × 100 = $20
    // 90% merma → costo_con_merma = 20 / 0.1 = $200
    // ingresos = 10 vendidas × $12 = $120 → ganancia = -$80
    const loteCaroBajo = makeLote({ cantidad_producida: '100' });
    loteCaroBajo.producto.recetas_como_final[0].ingredientes[0]
      .producto.proveedor_productos[0].precio_unitario = '100';
    loteRepo.findByIdWithReceta.mockResolvedValueOnce(loteCaroBajo);
    movRepo2.sumMermaByLote.mockResolvedValueOnce({ _sum: { cantidad: '90' } });

    const r = await inventarioService.calcularRentabilidadLote(1, 10);

    expect(r.ingresos).toBeCloseTo(120, 0);
    expect(r.ganancia_neta!).toBeLessThan(0);
    expect(r.margen_porcentaje!).toBeLessThan(0);
  });

  it('devuelve margen null si precio_venta es null', async () => {
    const lote = makeLote();
    lote.producto.precio_venta = null as unknown as string;
    loteRepo.findByIdWithReceta.mockResolvedValueOnce(lote);
    movRepo2.sumMermaByLote.mockResolvedValueOnce({ _sum: { cantidad: '5' } });

    const r = await inventarioService.calcularRentabilidadLote(1, 10);

    expect(r.precio_venta).toBeNull();
    expect(r.margen_porcentaje).toBeNull();
    expect(r.ganancia_neta).toBeNull();
  });

  it('agrega advertencia si un ingrediente no tiene proveedor', async () => {
    const lote = makeLote();
    lote.producto.recetas_como_final[0].ingredientes[0].producto.proveedor_productos = [];
    loteRepo.findByIdWithReceta.mockResolvedValueOnce(lote);
    movRepo2.sumMermaByLote.mockResolvedValueOnce({ _sum: { cantidad: null } });

    const r = await inventarioService.calcularRentabilidadLote(1, 10);

    expect(r.advertencias).toHaveLength(1);
    expect(r.advertencias[0].ingrediente).toBe('Carne');
    expect(r.costo_ingredientes).toBe(0);
  });

  it('caso Lechuga: unidad de ingrediente (kilogramo) incompatible con la unidad del producto (unidad) → no calcula un costo falso', async () => {
    const lote = makeLote();
    lote.producto.recetas_como_final[0].ingredientes[0].producto = {
      nombre: 'Lechuga',
      unidad_medida: 'unidad',
      proveedor_productos: [{ precio_unitario: '500', es_proveedor_preferido: true }],
    } as never;
    loteRepo.findByIdWithReceta.mockResolvedValueOnce(lote);
    movRepo2.sumMermaByLote.mockResolvedValueOnce({ _sum: { cantidad: null } });

    const r = await inventarioService.calcularRentabilidadLote(1, 10);

    expect(r.costo_ingredientes).toBe(0);
    expect(r.advertencias).toHaveLength(1);
    expect(r.advertencias[0].ingrediente).toBe('Lechuga');
    expect(r.advertencias[0].mensaje).toContain('incompatible');
  });

  it('lanza NotFoundError si el lote no existe', async () => {
    loteRepo.findByIdWithReceta.mockResolvedValueOnce(null);

    await expect(inventarioService.calcularRentabilidadLote(999, 10))
      .rejects.toThrow('Lote');
  });

  it('lanza NotFoundError si el lote pertenece a otro restaurante', async () => {
    loteRepo.findByIdWithReceta.mockResolvedValueOnce(makeLote({ restaurante: { id: 99 } }));

    await expect(inventarioService.calcularRentabilidadLote(1, 10))
      .rejects.toThrow('Lote');
  });
});
