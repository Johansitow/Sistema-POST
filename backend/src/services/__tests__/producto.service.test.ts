/**
 * Tests para productoService — crear, actualizar, actualizarStock
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/producto.repository', () => ({
  productoRepository: {
    findAll:        vi.fn(),
    findById:       vi.fn(),
    findBySKU:      vi.fn(),
    findActivos:    vi.fn(),
    create:         vi.fn(),
    update:         vi.fn(),
    updateStock:    vi.fn(),
    softDelete:     vi.fn(),
    count:          vi.fn(),
    countByEstado:  vi.fn(),
  },
}));

vi.mock('../../repositories/movimiento.repository', () => ({
  movimientoRepository: {
    create: vi.fn(),
  },
}));

vi.mock('../../config/redis', () => ({
  cacheGetOrSet: vi.fn((_k, _t, fn) => fn()),
  cacheDel:      vi.fn(),
  CACHE_TTL:     { SHORT: 60, MID: 300, LONG: 3600 },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { productoService } from '../producto.service';
import { productoRepository } from '../../repositories/producto.repository';
import { movimientoRepository } from '../../repositories/movimiento.repository';
import { ConflictError, NotFoundError, BadRequestError, ForbiddenError } from '../../exceptions/HttpErrors';
import { createProductoSchema } from '../../dto/productos.dto';

// ── Fixture ───────────────────────────────────────────────────────────────────

const mockProducto = {
  id:              1,
  sku:             'CAFE-001',
  nombre:          'Café Americano',
  precio_unitario: new Decimal('5000'),
  precio_venta:    new Decimal('8000'),
  stock_actual:    new Decimal('10'),
  stock_minimo:    new Decimal('2'),
  stock_maximo:    null,
  punto_reorden:   null,
  estado:          'activo',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('productoService.crear', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea el producto cuando el SKU no existe', async () => {
    (productoRepository.findBySKU as any).mockResolvedValue(null);
    (productoRepository.create as any).mockResolvedValue(mockProducto);

    const result = await productoService.crear({
      sku: 'CAFE-001', nombre: 'Café', precio_unitario: 5000, id_grupo: 1,
    });

    expect(productoRepository.create).toHaveBeenCalledOnce();
    expect(result.sku).toBe('CAFE-001');
  });

  it('lanza ConflictError si el SKU ya existe', async () => {
    (productoRepository.findBySKU as any).mockResolvedValue(mockProducto);

    await expect(productoService.crear({ sku: 'CAFE-001', nombre: 'Café', precio_unitario: 5000, id_grupo: 1 }))
      .rejects.toThrow(ConflictError);
  });

  it('lanza ForbiddenError si no se pasa id_grupo (guard multi-tenant)', async () => {
    // Reproduce el bug original: controller omitía req.grupoId → assertGrupoId lanzaba
    await expect(
      productoService.crear({ sku: 'CAFE-001', nombre: 'Café', precio_unitario: 5000 } as any)
    ).rejects.toThrow(ForbiddenError);
  });

  it('propaga id_grupo al repositorio (el producto queda en el grupo correcto)', async () => {
    (productoRepository.findBySKU as any).mockResolvedValue(null);
    (productoRepository.create as any).mockResolvedValue(mockProducto);

    await productoService.crear({ sku: 'CAFE-001', nombre: 'Café', precio_unitario: 5000, id_grupo: 7 });

    const callArg = (productoRepository.create as any).mock.calls[0][0];
    expect(callArg.id_grupo).toBe(7);
  });
});

// ── Seguridad multi-tenant: id_grupo NO viene del body ────────────────────────

describe('createProductoSchema — id_grupo no se acepta desde el body', () => {
  it('strips id_grupo si el cliente lo envía en el body (Zod unknown = strip)', () => {
    const body = {
      sku:             'PROD-001',
      nombre:          'Producto Prueba',
      tipo_materia:    'prima',
      unidad_medida:   'unidad',
      precio_unitario: 10000,
      id_grupo:        999,   // <-- el cliente intenta fijar el grupo
    };
    const parsed = createProductoSchema.parse(body);
    // Zod strip: campos no declarados en el schema se eliminan silenciosamente
    expect((parsed as any).id_grupo).toBeUndefined();
  });
});

describe('productoService.obtenerPorId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve el producto si existe', async () => {
    (productoRepository.findById as any).mockResolvedValue(mockProducto);

    const result = await productoService.obtenerPorId(1);
    expect(result.id).toBe(1);
  });

  it('lanza NotFoundError si no existe', async () => {
    (productoRepository.findById as any).mockResolvedValue(null);

    await expect(productoService.obtenerPorId(999)).rejects.toThrow(NotFoundError);
  });
});

describe('productoService.actualizarStock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('suma stock en entrada', async () => {
    (productoRepository.findById as any)
      .mockResolvedValueOnce(mockProducto)   // primera llamada: obtenerPorId
      .mockResolvedValueOnce({ ...mockProducto, stock_actual: new Decimal('15') }); // al final de actualizarStock
    (productoRepository.updateStock as any).mockResolvedValue({});
    (movimientoRepository.create as any).mockResolvedValue({});

    await productoService.actualizarStock(1, 5, 'entrada', 1);

    expect(productoRepository.updateStock).toHaveBeenCalledOnce();
    const [, decimal] = (productoRepository.updateStock as any).mock.calls[0];
    expect(decimal.toString()).toBe('15');
  });

  it('resta stock en salida', async () => {
    (productoRepository.findById as any)
      .mockResolvedValueOnce(mockProducto)   // primera llamada: obtenerPorId
      .mockResolvedValueOnce(mockProducto);  // segunda: findById al final
    (productoRepository.updateStock as any).mockResolvedValue({});
    (movimientoRepository.create as any).mockResolvedValue({});

    await productoService.actualizarStock(1, 3, 'salida', 1);

    expect(productoRepository.updateStock).toHaveBeenCalledOnce();
    const [, decimal] = (productoRepository.updateStock as any).mock.calls[0];
    expect(decimal.toString()).toBe('7');
  });

  it('lanza BadRequestError si la salida supera el stock', async () => {
    (productoRepository.findById as any).mockResolvedValue(mockProducto); // stock = 10

    await expect(productoService.actualizarStock(1, 99, 'salida', 1)).rejects.toThrow(BadRequestError);
  });

  it('lanza BadRequestError si stock queda exactamente negativo', async () => {
    (productoRepository.findById as any).mockResolvedValue(mockProducto); // stock = 10

    await expect(productoService.actualizarStock(1, 11, 'salida', 1)).rejects.toThrow(BadRequestError);
  });

  it('crea movimiento de inventario', async () => {
    (productoRepository.findById as any).mockResolvedValue(mockProducto);
    (productoRepository.updateStock as any).mockResolvedValue({});
    (movimientoRepository.create as any).mockResolvedValue({});

    await productoService.actualizarStock(1, 5, 'entrada', 1);

    expect(movimientoRepository.create).toHaveBeenCalledOnce();
    const callArg = (movimientoRepository.create as any).mock.calls[0][0];
    expect(callArg.tipo_movimiento).toBe('entrada');
  });
});

describe('productoService.stockBajo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filtra solo productos con stock <= stock_minimo', async () => {
    const productos = [
      { ...mockProducto, id: 1, stock_actual: new Decimal('1'), stock_minimo: new Decimal('2') },  // bajo
      { ...mockProducto, id: 2, stock_actual: new Decimal('5'), stock_minimo: new Decimal('2') },  // ok
      { ...mockProducto, id: 3, stock_actual: new Decimal('2'), stock_minimo: new Decimal('2') },  // exacto = bajo
    ];
    (productoRepository.findActivos as any).mockResolvedValue(productos);

    const result = await productoService.stockBajo();
    expect(result).toHaveLength(2);
    expect(result.map(p => p.id)).toEqual([1, 3]);
  });

  it('devuelve vacío si todos tienen stock suficiente', async () => {
    const productos = [
      { ...mockProducto, stock_actual: new Decimal('10'), stock_minimo: new Decimal('2') },
    ];
    (productoRepository.findActivos as any).mockResolvedValue(productos);

    const result = await productoService.stockBajo();
    expect(result).toHaveLength(0);
  });
});
