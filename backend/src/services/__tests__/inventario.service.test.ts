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
    findProximosVencer:   vi.fn(),
    findAll:              vi.fn(),
    findById:             vi.fn(),
    findByIdWithReceta:   vi.fn(),
    update:               vi.fn(),
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
  },
  movimiento: {
    create: vi.fn(),
  },
};

vi.mock('../../config/database', () => ({
  default: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  },
}));

// ── Imports DESPUÉS de los mocks ───────────────────────────────────────────────

import { inventarioService } from '../inventario.service';
import { loteRepository } from '../../repositories/lote.repository';

const loteRepo = loteRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;
import { movimientoRepository } from '../../repositories/movimiento.repository';

const movRepo = movimientoRepository as ReturnType<typeof vi.fn> & typeof movimientoRepository;

const mockProducto = { id: 1, nombre: 'Harina', stock_actual: 100 };
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
  it('registra una entrada y crea lote', async () => {
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
    });

    expect(result.movimiento.tipo_movimiento).toBe(TipoMovimiento.entrada);
    expect(result.lote_generado).toBeTruthy();
    expect(mockTx.lote.create).toHaveBeenCalled();
  });

  it('lanza BadRequestError si entrada sin proveedor', async () => {
    await expect(inventarioService.registrarMovimiento({
      id_producto:     1,
      id_restaurante:  1,
      tipo_movimiento: TipoMovimiento.entrada,
      cantidad:        50,
      motivo:          'Sin proveedor',
    })).rejects.toThrow('proveedor es obligatorio');
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
