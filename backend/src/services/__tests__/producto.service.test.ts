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

vi.mock('../../repositories/producto-stock.repository', () => ({
  productoStockRepository: {
    findOne:        vi.fn(),
    findBajoMinimo: vi.fn(),
  },
}));

vi.mock('../inventario.service', () => ({
  inventarioService: {
    registrarMovimiento: vi.fn(),
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
import { productoStockRepository } from '../../repositories/producto-stock.repository';
import { inventarioService } from '../inventario.service';
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

  it('delega la entrada al flujo canónico de inventario (mantiene ProductoStock por sede)', async () => {
    (inventarioService.registrarMovimiento as any).mockResolvedValue({});
    (productoRepository.findById as any).mockResolvedValue(mockProducto);
    (productoStockRepository.findOne as any).mockResolvedValue(null);

    await productoService.actualizarStock(1, 5, 'entrada', 3);

    expect(inventarioService.registrarMovimiento).toHaveBeenCalledOnce();
    const callArg = (inventarioService.registrarMovimiento as any).mock.calls[0][0];
    expect(callArg).toMatchObject({
      id_producto:     1,
      id_restaurante:  3,
      tipo_movimiento: 'entrada',
      cantidad:        5,
    });
  });

  it('delega la salida con tipo_movimiento salida', async () => {
    (inventarioService.registrarMovimiento as any).mockResolvedValue({});
    (productoRepository.findById as any).mockResolvedValue(mockProducto);
    (productoStockRepository.findOne as any).mockResolvedValue(null);

    await productoService.actualizarStock(1, 3, 'salida', 3);

    const callArg = (inventarioService.registrarMovimiento as any).mock.calls[0][0];
    expect(callArg.tipo_movimiento).toBe('salida');
  });

  it('propaga BadRequestError de stock insuficiente desde inventario', async () => {
    (inventarioService.registrarMovimiento as any).mockRejectedValue(
      new BadRequestError('Stock insuficiente. Actual: 10, requerido: 99'),
    );

    await expect(productoService.actualizarStock(1, 99, 'salida', 3)).rejects.toThrow(BadRequestError);
  });

  it('devuelve el producto con el stock de la sede (ProductoStock)', async () => {
    (inventarioService.registrarMovimiento as any).mockResolvedValue({});
    (productoRepository.findById as any).mockResolvedValue(mockProducto);
    (productoStockRepository.findOne as any).mockResolvedValue({
      stock_actual:       new Decimal('15'),
      stock_minimo:       new Decimal('2'),
      stock_maximo:       null,
      precio_venta_local: null,
    });

    const result = await productoService.actualizarStock(1, 5, 'entrada', 3);

    expect(productoStockRepository.findOne).toHaveBeenCalledWith(1, 3);
    expect(String((result as any).stock_actual)).toBe('15');
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

  it('con sede usa ProductoStock (no el catálogo global) y filtra bajo mínimo', async () => {
    const stockRow = (id: number, actual: string, minimo: string) => ({
      stock_actual: new Decimal(actual),
      stock_minimo: new Decimal(minimo),
      producto: { id, nombre: `P${id}`, sku: `SKU-${id}`, precio_unitario: new Decimal('1000'), categoria: null },
    });
    (productoStockRepository.findBajoMinimo as any).mockResolvedValue([
      stockRow(1, '1', '2'),   // bajo
      stockRow(2, '5', '2'),   // ok
      stockRow(3, '2', '2'),   // exacto = bajo
    ]);

    const result = await productoService.stockBajo(7);

    expect(productoStockRepository.findBajoMinimo).toHaveBeenCalledWith(7);
    expect(productoRepository.findActivos).not.toHaveBeenCalled();
    expect(result.map(p => p.id)).toEqual([1, 3]);
  });
});

// ── listar — stock por sede desde ProductoStock ───────────────────────────────

describe('productoService.listar con id_restaurante', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sobrescribe stock_actual con la fila de ProductoStock de la sede', async () => {
    const conStock = {
      ...mockProducto,
      stocks: [{ stock_actual: new Decimal('33'), stock_minimo: new Decimal('4'), stock_maximo: null, precio_venta_local: null }],
    };
    (productoRepository.findAll as any).mockResolvedValue([[conStock], 1]);

    const result = await productoService.listar({ id_grupo: 1, id_restaurante: 3 });

    const filtros = (productoRepository.findAll as any).mock.calls[0][1];
    expect(filtros.id_restaurante).toBe(3);
    expect(String(result.data[0].stock_actual)).toBe('33');
    expect((result.data[0] as any).stocks).toBeUndefined();
  });

  it('sin fila de ProductoStock expone stock 0 (la sede nunca movió el producto)', async () => {
    const sinStock = { ...mockProducto, stocks: [] };
    (productoRepository.findAll as any).mockResolvedValue([[sinStock], 1]);

    const result = await productoService.listar({ id_grupo: 1, id_restaurante: 3 });

    expect(String(result.data[0].stock_actual)).toBe('0');
  });

  it('sin contexto de sede el producto se devuelve tal cual (catálogo)', async () => {
    (productoRepository.findAll as any).mockResolvedValue([[mockProducto], 1]);

    const result = await productoService.listar({ id_grupo: 1 });

    expect(String(result.data[0].stock_actual)).toBe('10');
  });
});
