/**
 * proveedor.service.test.ts
 *
 * Cubre los tenant guards añadidos en Oleada 3a:
 *   - findByIdScoped dispara para write-methods (actualizar, cambiarEstado,
 *     listarProductos, asociarProducto, actualizarRelacion, desasociarProducto)
 *   - assertGrupoCtx en crear
 *   - superadmin bypass
 *   - cross-tenant → NotFoundError
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { proveedorService } from '../proveedor.service';
import { ForbiddenError, NotFoundError, ConflictError } from '../../exceptions/HttpErrors';
import type { TenantCtx } from '../../lib/tenantCtx';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/proveedor.repository', () => ({
  proveedorRepository: {
    findAll:                    vi.fn(),
    findById:                   vi.fn(),
    findByIdScoped:             vi.fn(),
    findByNit:                  vi.fn(),
    create:                     vi.fn(),
    update:                     vi.fn(),
    findProductosByProveedor:   vi.fn(),
    findRelacion:               vi.fn(),
    createRelacion:             vi.fn(),
    updateRelacion:             vi.fn(),
    findParaScoring:            vi.fn(),
    findCompetidoresByProducto: vi.fn(),
  },
}));

import { proveedorRepository } from '../../repositories/proveedor.repository';

const repo = proveedorRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CTX_GRUPO_1: TenantCtx    = { grupoId: 1, restauranteId: 10 };
const CTX_SIN_GRUPO: TenantCtx  = { restauranteId: 10 };
const CTX_SUPERADMIN: TenantCtx = { esSuperAdmin: true, grupoId: 1 };
const CTX_SUPERADMIN_NO_GRUPO: TenantCtx = { esSuperAdmin: true };

const PROVEEDOR = { id: 5, id_grupo: 1, razon_social: 'Dist. Test', productos: [] };

// ── Helper: reset mocks entre describe blocks ─────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// crear — assertGrupoCtx
// ══════════════════════════════════════════════════════════════════════════════

describe('proveedorService.crear — assertGrupoCtx', () => {
  it('lanza ForbiddenError si ctx no tiene grupoId y no es superadmin', async () => {
    await expect(
      proveedorService.crear({ razon_social: 'X' }, CTX_SIN_GRUPO)
    ).rejects.toThrow(ForbiddenError);
  });

  it('procede si ctx tiene grupoId', async () => {
    repo.findByNit.mockResolvedValueOnce(null);
    repo.create.mockResolvedValueOnce(PROVEEDOR);

    const result = await proveedorService.crear({ razon_social: 'X' }, CTX_GRUPO_1);
    expect(result).toEqual(PROVEEDOR);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ id_grupo: 1 }));
  });

  it('superadmin con grupoId puede crear', async () => {
    repo.findByNit.mockResolvedValueOnce(null);
    repo.create.mockResolvedValueOnce(PROVEEDOR);

    await expect(
      proveedorService.crear({ razon_social: 'X' }, CTX_SUPERADMIN)
    ).resolves.toEqual(PROVEEDOR);
  });

  it('lanza ConflictError si NIT ya existe', async () => {
    repo.findByNit.mockResolvedValueOnce({ id: 99, nit: '123' });

    await expect(
      proveedorService.crear({ razon_social: 'X', nit: '123' }, CTX_GRUPO_1)
    ).rejects.toThrow(ConflictError);
    expect(repo.create).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// actualizar — tenant guard
// ══════════════════════════════════════════════════════════════════════════════

describe('proveedorService.actualizar — tenant guard', () => {
  it('lanza ForbiddenError si ctx no tiene grupoId', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new ForbiddenError('Se requiere contexto'));
    await expect(
      proveedorService.actualizar(5, { razon_social: 'Y' }, CTX_SIN_GRUPO)
    ).rejects.toThrow(ForbiddenError);
  });

  it('lanza NotFoundError si el proveedor es de otro grupo (cross-tenant)', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 5'));
    await expect(
      proveedorService.actualizar(5, { razon_social: 'Y' }, { grupoId: 99 })
    ).rejects.toThrow(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('happy path: actualiza cuando el proveedor pertenece al grupo', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(PROVEEDOR);
    repo.findByNit.mockResolvedValueOnce(null);
    repo.update.mockResolvedValueOnce({ ...PROVEEDOR, razon_social: 'Nuevo' });

    const result = await proveedorService.actualizar(5, { razon_social: 'Nuevo' }, CTX_GRUPO_1);
    expect(result).toMatchObject({ razon_social: 'Nuevo' });
    expect(repo.findByIdScoped).toHaveBeenCalledWith(5, CTX_GRUPO_1);
  });

  it('superadmin puede actualizar sin restricción de grupo', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(PROVEEDOR);
    repo.update.mockResolvedValueOnce(PROVEEDOR);

    await expect(
      proveedorService.actualizar(5, {}, CTX_SUPERADMIN_NO_GRUPO)
    ).resolves.toEqual(PROVEEDOR);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// cambiarEstado — tenant guard
// ══════════════════════════════════════════════════════════════════════════════

describe('proveedorService.cambiarEstado — tenant guard', () => {
  it('lanza ForbiddenError si ctx no tiene grupoId', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new ForbiddenError('Se requiere contexto'));
    await expect(
      proveedorService.cambiarEstado(5, 'inactivo' as never, CTX_SIN_GRUPO)
    ).rejects.toThrow(ForbiddenError);
  });

  it('lanza NotFoundError cross-tenant', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 5'));
    await expect(
      proveedorService.cambiarEstado(5, 'inactivo' as never, { grupoId: 99 })
    ).rejects.toThrow(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('happy path', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(PROVEEDOR);
    repo.update.mockResolvedValueOnce({ ...PROVEEDOR, estado: 'inactivo' });

    await expect(
      proveedorService.cambiarEstado(5, 'inactivo' as never, CTX_GRUPO_1)
    ).resolves.toMatchObject({ estado: 'inactivo' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// listarProductos — tenant guard
// ══════════════════════════════════════════════════════════════════════════════

describe('proveedorService.listarProductos — tenant guard', () => {
  it('lanza ForbiddenError si ctx no tiene grupoId', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new ForbiddenError('Se requiere contexto'));
    await expect(
      proveedorService.listarProductos(5, CTX_SIN_GRUPO)
    ).rejects.toThrow(ForbiddenError);
  });

  it('lanza NotFoundError cross-tenant', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 5'));
    await expect(
      proveedorService.listarProductos(5, { grupoId: 99 })
    ).rejects.toThrow(NotFoundError);
    expect(repo.findProductosByProveedor).not.toHaveBeenCalled();
  });

  it('happy path', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(PROVEEDOR);
    repo.findProductosByProveedor.mockResolvedValueOnce([]);

    await expect(
      proveedorService.listarProductos(5, CTX_GRUPO_1)
    ).resolves.toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// asociarProducto — tenant guard
// ══════════════════════════════════════════════════════════════════════════════

describe('proveedorService.asociarProducto — tenant guard', () => {
  const dataProd = { id_producto: 10, precio_unitario: 1000 };

  it('lanza ForbiddenError si ctx no tiene grupoId', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new ForbiddenError('Se requiere contexto'));
    await expect(
      proveedorService.asociarProducto(5, dataProd, CTX_SIN_GRUPO)
    ).rejects.toThrow(ForbiddenError);
  });

  it('lanza NotFoundError cross-tenant', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 5'));
    await expect(
      proveedorService.asociarProducto(5, dataProd, { grupoId: 99 })
    ).rejects.toThrow(NotFoundError);
    expect(repo.createRelacion).not.toHaveBeenCalled();
  });

  it('happy path', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(PROVEEDOR);
    repo.findRelacion.mockResolvedValueOnce(null);
    repo.createRelacion.mockResolvedValueOnce({ id_proveedor: 5, id_producto: 10 });
    repo.findParaScoring.mockResolvedValueOnce(null);

    await expect(
      proveedorService.asociarProducto(5, dataProd, CTX_GRUPO_1)
    ).resolves.toMatchObject({ id_proveedor: 5, id_producto: 10 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// actualizarRelacion — tenant guard
// ══════════════════════════════════════════════════════════════════════════════

describe('proveedorService.actualizarRelacion — tenant guard', () => {
  it('lanza NotFoundError cross-tenant antes de buscar la relación', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 5'));
    await expect(
      proveedorService.actualizarRelacion(5, 10, {}, { grupoId: 99 })
    ).rejects.toThrow(NotFoundError);
    expect(repo.findRelacion).not.toHaveBeenCalled();
  });

  it('happy path', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(PROVEEDOR);
    repo.findRelacion.mockResolvedValueOnce({ id_proveedor: 5, id_producto: 10 });
    repo.updateRelacion.mockResolvedValueOnce({ id_proveedor: 5, id_producto: 10 });
    repo.findParaScoring.mockResolvedValueOnce(null);

    await expect(
      proveedorService.actualizarRelacion(5, 10, {}, CTX_GRUPO_1)
    ).resolves.toMatchObject({ id_proveedor: 5 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// desasociarProducto — tenant guard
// ══════════════════════════════════════════════════════════════════════════════

describe('proveedorService.desasociarProducto — tenant guard', () => {
  it('lanza NotFoundError cross-tenant antes de buscar la relación', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 5'));
    await expect(
      proveedorService.desasociarProducto(5, 10, { grupoId: 99 })
    ).rejects.toThrow(NotFoundError);
    expect(repo.findRelacion).not.toHaveBeenCalled();
  });

  it('lanza NotFoundError si la relación no existe', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(PROVEEDOR);
    repo.findRelacion.mockResolvedValueOnce(null);

    await expect(
      proveedorService.desasociarProducto(5, 10, CTX_GRUPO_1)
    ).rejects.toThrow(NotFoundError);
    expect(repo.updateRelacion).not.toHaveBeenCalled();
  });

  it('happy path', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(PROVEEDOR);
    repo.findRelacion.mockResolvedValueOnce({ id_proveedor: 5, id_producto: 10 });
    repo.updateRelacion.mockResolvedValueOnce({ id_proveedor: 5, id_producto: 10, estado: 'inactivo' });

    await expect(
      proveedorService.desasociarProducto(5, 10, CTX_GRUPO_1)
    ).resolves.toMatchObject({ estado: 'inactivo' });
  });
});
