/**
 * Tests para varianteService — crear, actualizar, eliminar, reordenar
 * + aislamiento multi-tenant (una variante hereda el tenant de su producto padre).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EstadoGeneral } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/variante.repository', () => ({
  varianteRepository: {
    findAllByProducto: vi.fn(),
    findById:          vi.fn(),
    findBySKU:         vi.fn(),
    create:            vi.fn(),
    update:            vi.fn(),
    softDelete:        vi.fn(),
    reorder:           vi.fn(),
  },
}));

vi.mock('../../repositories/producto.repository', () => ({
  productoRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('../../config/redis', () => ({
  cacheGetOrSet: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()),
  cacheDel:      vi.fn(),
  CACHE_TTL:     { SHORT: 60, MID: 300, LONG: 3600 },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { varianteService }    from '../variante.service';
import { varianteRepository } from '../../repositories/variante.repository';
import { productoRepository } from '../../repositories/producto.repository';
import { cacheDel }           from '../../config/redis';
import { NotFoundError, ConflictError, BadRequestError } from '../../exceptions/HttpErrors';
import type { TenantCtx }     from '../../lib/tenantCtx';

// ── Fixtures ──────────────────────────────────────────────────────────────────

// El producto padre pertenece al grupo 3.
const mockProducto = { id: 1, nombre: 'Café', estado: EstadoGeneral.activo, id_grupo: 3 };
// Contexto del usuario dueño del grupo 3.
const ctx: TenantCtx = { grupoId: 3, esSuperAdmin: false };

const mockVariante = {
  id:         1,
  id_producto: 1,
  nombre:     'Grande',
  precio:     new Decimal('5000'),
  sku:        'VAR-001',
  atributos:  null,
  orden:      0,
  estado:     EstadoGeneral.activo,
};

const mockVarianteEliminada = { ...mockVariante, id: 99, sku: null, estado: EstadoGeneral.eliminado };

// ── varianteService.crear ─────────────────────────────────────────────────────

describe('varianteService.crear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (productoRepository.findById as any).mockResolvedValue(mockProducto);
  });

  it('crea la variante cuando el producto existe y el SKU no está en uso', async () => {
    (varianteRepository.findBySKU as any).mockResolvedValue(null);
    (varianteRepository.create as any).mockResolvedValue(mockVariante);

    const result = await varianteService.crear(1, { nombre: 'Grande', precio: 5000, sku: 'VAR-001' }, ctx);

    expect(varianteRepository.create).toHaveBeenCalledOnce();
    expect(result.nombre).toBe('Grande');
    expect(cacheDel).toHaveBeenCalledWith('variantes:prod:1');
  });

  it('lanza NotFoundError si el producto no existe', async () => {
    (productoRepository.findById as any).mockResolvedValue(null);

    await expect(varianteService.crear(99, { nombre: 'Grande', precio: 5000 }, ctx))
      .rejects.toThrow(NotFoundError);

    expect(varianteRepository.create).not.toHaveBeenCalled();
  });

  it('lanza ConflictError si el SKU ya pertenece a una variante activa', async () => {
    (varianteRepository.findBySKU as any).mockResolvedValue(mockVariante); // activa

    await expect(varianteService.crear(1, { nombre: 'Mediano', precio: 4000, sku: 'VAR-001' }, ctx))
      .rejects.toThrow(ConflictError);
  });

  it('NO lanza ConflictError si el SKU pertenece a una variante eliminada', async () => {
    // findBySKU nunca devuelve eliminadas porque el SKU es null al eliminar —
    // el mock de null simula ese comportamiento
    (varianteRepository.findBySKU as any).mockResolvedValue(null);
    (varianteRepository.create as any).mockResolvedValue(mockVariante);

    await expect(varianteService.crear(1, { nombre: 'Grande', precio: 5000, sku: 'VAR-001' }, ctx))
      .resolves.toBeDefined();
  });

  it('crea la variante sin SKU (campo opcional)', async () => {
    (varianteRepository.create as any).mockResolvedValue({ ...mockVariante, sku: null });

    const result = await varianteService.crear(1, { nombre: 'Sin talla', precio: 3000 }, ctx);

    expect(varianteRepository.findBySKU).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

// ── Aislamiento multi-tenant ────────────────────────────────────────────────────

describe('varianteService — aislamiento multi-tenant (IDOR)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crear: lanza NotFoundError si el producto es de OTRO grupo (no revela existencia)', async () => {
    (productoRepository.findById as any).mockResolvedValue(mockProducto); // id_grupo: 3
    const ctxAjeno: TenantCtx = { grupoId: 999, esSuperAdmin: false };

    await expect(varianteService.crear(1, { nombre: 'Grande', precio: 5000 }, ctxAjeno))
      .rejects.toThrow(NotFoundError);

    expect(varianteRepository.create).not.toHaveBeenCalled();
  });

  it('obtenerPorId (vía actualizar): lanza NotFoundError si la variante es de otro grupo', async () => {
    (varianteRepository.findById as any).mockResolvedValue(mockVariante); // id_producto: 1
    (productoRepository.findById as any).mockResolvedValue(mockProducto);  // id_grupo: 3
    const ctxAjeno: TenantCtx = { grupoId: 999, esSuperAdmin: false };

    await expect(varianteService.actualizar(1, { nombre: 'Hack' }, ctxAjeno))
      .rejects.toThrow(NotFoundError);

    expect(varianteRepository.update).not.toHaveBeenCalled();
  });

  it('permite acceso a variantes de un producto GLOBAL (id_grupo null) desde cualquier grupo', async () => {
    (productoRepository.findById as any).mockResolvedValue({ ...mockProducto, id_grupo: null });
    (varianteRepository.findBySKU as any).mockResolvedValue(null);
    (varianteRepository.create as any).mockResolvedValue(mockVariante);
    const ctxOtro: TenantCtx = { grupoId: 999, esSuperAdmin: false };

    await expect(varianteService.crear(1, { nombre: 'Grande', precio: 5000 }, ctxOtro))
      .resolves.toBeDefined();
  });

  it('superadmin accede a variantes de cualquier grupo', async () => {
    (productoRepository.findById as any).mockResolvedValue(mockProducto); // id_grupo: 3
    (varianteRepository.findBySKU as any).mockResolvedValue(null);
    (varianteRepository.create as any).mockResolvedValue(mockVariante);
    const ctxSuper: TenantCtx = { esSuperAdmin: true };

    await expect(varianteService.crear(1, { nombre: 'Grande', precio: 5000 }, ctxSuper))
      .resolves.toBeDefined();
  });
});

// ── varianteService.actualizar ────────────────────────────────────────────────

describe('varianteService.actualizar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (productoRepository.findById as any).mockResolvedValue(mockProducto);
  });

  it('actualiza la variante correctamente', async () => {
    (varianteRepository.findById as any).mockResolvedValue(mockVariante);
    (varianteRepository.update as any).mockResolvedValue({ ...mockVariante, nombre: 'XL' });

    const result = await varianteService.actualizar(1, { nombre: 'XL' }, ctx);

    expect(result.nombre).toBe('XL');
    expect(cacheDel).toHaveBeenCalledWith('variante:1', 'variantes:prod:1');
  });

  it('lanza NotFoundError si la variante no existe', async () => {
    (varianteRepository.findById as any).mockResolvedValue(null);

    await expect(varianteService.actualizar(99, { nombre: 'Test' }, ctx))
      .rejects.toThrow(NotFoundError);
  });

  it('lanza ConflictError al cambiar SKU a uno que ya usa otra variante activa', async () => {
    (varianteRepository.findById as any).mockResolvedValue(mockVariante);
    // SKU diferente al actual → lo busca
    (varianteRepository.findBySKU as any).mockResolvedValue({ ...mockVariante, id: 2, sku: 'VAR-002' });

    await expect(varianteService.actualizar(1, { sku: 'VAR-002' }, ctx))
      .rejects.toThrow(ConflictError);
  });

  it('no verifica SKU si no cambió', async () => {
    (varianteRepository.findById as any).mockResolvedValue(mockVariante);
    (varianteRepository.update as any).mockResolvedValue(mockVariante);

    await varianteService.actualizar(1, { sku: 'VAR-001' }, ctx); // mismo SKU

    expect(varianteRepository.findBySKU).not.toHaveBeenCalled();
  });
});

// ── varianteService.eliminar ──────────────────────────────────────────────────

describe('varianteService.eliminar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (productoRepository.findById as any).mockResolvedValue(mockProducto);
  });

  it('hace soft-delete e invalida caché', async () => {
    (varianteRepository.findById as any).mockResolvedValue(mockVariante);
    (varianteRepository.softDelete as any).mockResolvedValue(mockVarianteEliminada);

    await varianteService.eliminar(1, ctx);

    expect(varianteRepository.softDelete).toHaveBeenCalledWith(1);
    expect(cacheDel).toHaveBeenCalledWith('variante:1', 'variantes:prod:1');
  });

  it('lanza NotFoundError si la variante no existe', async () => {
    (varianteRepository.findById as any).mockResolvedValue(null);

    await expect(varianteService.eliminar(99, ctx)).rejects.toThrow(NotFoundError);
    expect(varianteRepository.softDelete).not.toHaveBeenCalled();
  });
});

// ── varianteService.reordenar ─────────────────────────────────────────────────

describe('varianteService.reordenar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (productoRepository.findById as any).mockResolvedValue(mockProducto);
  });

  const variantesActivas = [
    { ...mockVariante, id: 1, orden: 0 },
    { ...mockVariante, id: 2, orden: 1 },
    { ...mockVariante, id: 3, orden: 2 },
  ];

  it('reordena correctamente cuando se incluyen todas las variantes', async () => {
    (varianteRepository.findAllByProducto as any).mockResolvedValue(variantesActivas);
    (varianteRepository.reorder as any).mockResolvedValue([]);

    await varianteService.reordenar(1, [
      { id: 3, orden: 0 },
      { id: 1, orden: 1 },
      { id: 2, orden: 2 },
    ], ctx);

    expect(varianteRepository.reorder).toHaveBeenCalledOnce();
    expect(cacheDel).toHaveBeenCalledWith('variantes:prod:1');
  });

  it('lanza BadRequestError si falta alguna variante activa', async () => {
    (varianteRepository.findAllByProducto as any).mockResolvedValue(variantesActivas);

    // Solo se envían 2 de 3
    await expect(varianteService.reordenar(1, [{ id: 1, orden: 0 }, { id: 2, orden: 1 }], ctx))
      .rejects.toThrow(BadRequestError);
  });

  it('lanza BadRequestError si se incluye una variante ajena al producto', async () => {
    (varianteRepository.findAllByProducto as any).mockResolvedValue(variantesActivas);

    await expect(varianteService.reordenar(1, [
      { id: 1, orden: 0 },
      { id: 2, orden: 1 },
      { id: 99, orden: 2 }, // ajena
    ], ctx)).rejects.toThrow(BadRequestError);
  });

  it('lanza BadRequestError si hay valores de orden duplicados', async () => {
    (varianteRepository.findAllByProducto as any).mockResolvedValue(variantesActivas);

    await expect(varianteService.reordenar(1, [
      { id: 1, orden: 0 },
      { id: 2, orden: 0 }, // duplicado
      { id: 3, orden: 1 },
    ], ctx)).rejects.toThrow(BadRequestError);
  });

  it('lanza BadRequestError si hay un valor de orden negativo', async () => {
    (varianteRepository.findAllByProducto as any).mockResolvedValue(variantesActivas);

    await expect(varianteService.reordenar(1, [
      { id: 1, orden: -1 }, // negativo
      { id: 2, orden: 0 },
      { id: 3, orden: 1 },
    ], ctx)).rejects.toThrow(BadRequestError);
  });

  it('lanza BadRequestError si la lista de items está vacía', async () => {
    (varianteRepository.findAllByProducto as any).mockResolvedValue(variantesActivas);

    await expect(varianteService.reordenar(1, [], ctx))
      .rejects.toThrow(BadRequestError);
  });
});
