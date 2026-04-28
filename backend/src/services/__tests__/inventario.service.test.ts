import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TipoMovimiento } from '@prisma/client';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/movimiento.repository', () => ({
  movimientoRepository: {
    findAll:               vi.fn(),
    groupByTipo:           vi.fn(),
    count:                 vi.fn(),
    findDistinctProductos: vi.fn(),
  },
}));

vi.mock('../../repositories/producto.repository', () => ({
  productoRepository: { findActivos: vi.fn() },
}));

vi.mock('../../repositories/lote.repository', () => ({
  loteRepository: { findProximosVencer: vi.fn(), findAll: vi.fn() },
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
