/**
 * Tests para plantillaService — listar, crear, actualizar, eliminar.
 * Oleada 3b-i: cubre tenant guards (assertGrupoCtx + findByIdScoped con id_grupo).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EstadoGeneral } from '@prisma/client';
import type { TenantCtx } from '../../lib/tenantCtx';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/plantilla.repository', () => ({
  plantillaRepository: {
    findAll:        vi.fn(),
    findById:       vi.fn(),
    findByIdScoped: vi.fn(),
    findDefault:    vi.fn(),
    create:         vi.fn(),
    update:         vi.fn(),
    clearDefaults:  vi.fn(),
    softDelete:     vi.fn(),
  },
}));

vi.mock('../../config/redis', () => ({
  cacheGetOrSet: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()),
  cacheDel:      vi.fn(),
  CACHE_TTL:     { SHORT: 60, MID: 300, LONG: 3600 },
}));

// Mock de prisma para las transacciones en crear/actualizar
vi.mock('../../config/database', () => ({
  default: {
    $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        plantillaImpresion: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create:     vi.fn(),
          update:     vi.fn(),
        },
      };
      return fn(tx);
    }),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { plantillaService }    from '../plantilla.service';
import { plantillaRepository } from '../../repositories/plantilla.repository';
import { cacheDel }            from '../../config/redis';
import prisma                  from '../../config/database';
import { NotFoundError, ConflictError, ForbiddenError } from '../../exceptions/HttpErrors';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CTX_GRUPO_1: TenantCtx   = { grupoId: 1, restauranteId: 10 };
const CTX_GRUPO_2: TenantCtx   = { grupoId: 2, restauranteId: 20 };
const CTX_SIN_GRUPO: TenantCtx = { restauranteId: 10 };
const CTX_SUPER: TenantCtx     = { esSuperAdmin: true };
const CTX_SUPER_GRUPO: TenantCtx = { esSuperAdmin: true, grupoId: 1 };

const mkPlantilla = (overrides: Record<string, unknown> = {}) => ({
  id:         1,
  nombre:     'Ticket estándar',
  tipo:       'ticket',
  es_default: false,
  plantilla:  { header: 'Mi Restaurante' },
  estado:     EstadoGeneral.activo,
  id_grupo:   1,
  id_restaurante: null,
  ...overrides,
});

const repo = plantillaRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;

// ── listar ────────────────────────────────────────────────────────────────────

describe('plantillaService.listar', () => {
  beforeEach(() => vi.resetAllMocks());

  it('retorna todas las plantillas cuando no se filtra por tipo', async () => {
    repo.findAll.mockResolvedValue([mkPlantilla()]);

    const result = await plantillaService.listar();

    expect(result).toHaveLength(1);
    expect(repo.findAll).toHaveBeenCalledWith(undefined, undefined);
  });

  it('filtra por tipo cuando se proporciona', async () => {
    repo.findAll.mockResolvedValue([]);

    await plantillaService.listar('factura');

    expect(repo.findAll).toHaveBeenCalledWith('factura', undefined);
  });
});

// ── obtenerPorId ──────────────────────────────────────────────────────────────

describe('plantillaService.obtenerPorId', () => {
  beforeEach(() => vi.resetAllMocks());

  it('retorna la plantilla cuando existe y está activa', async () => {
    repo.findById.mockResolvedValue(mkPlantilla());

    const result = await plantillaService.obtenerPorId(1);
    expect(result.id).toBe(1);
  });

  it('lanza NotFoundError si la plantilla no existe', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(plantillaService.obtenerPorId(99)).rejects.toThrow(NotFoundError);
  });

  it('lanza NotFoundError si la plantilla está eliminada', async () => {
    repo.findById.mockResolvedValue(mkPlantilla({ estado: EstadoGeneral.eliminado }));

    await expect(plantillaService.obtenerPorId(1)).rejects.toThrow(NotFoundError);
  });
});

// ── obtenerDefault ────────────────────────────────────────────────────────────

describe('plantillaService.obtenerDefault', () => {
  beforeEach(() => vi.resetAllMocks());

  it('retorna null si no hay plantilla por defecto para el tipo', async () => {
    repo.findDefault.mockResolvedValue(null);

    const result = await plantillaService.obtenerDefault('comanda');
    expect(result).toBeNull();
  });

  it('retorna la plantilla por defecto si existe', async () => {
    repo.findDefault.mockResolvedValue(mkPlantilla({ es_default: true, tipo: 'comanda' }));

    const result = await plantillaService.obtenerDefault('comanda');
    expect(result?.es_default).toBe(true);
  });
});

// ── crear — assertGrupoCtx ────────────────────────────────────────────────────

describe('plantillaService.crear — assertGrupoCtx', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lanza ForbiddenError si ctx no tiene grupoId y no es superadmin', async () => {
    await expect(
      plantillaService.crear({ nombre: 'T', tipo: 'ticket', plantilla: {} }, CTX_SIN_GRUPO)
    ).rejects.toThrow(ForbiddenError);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lanza ConflictError para un tipo inválido (después de assertGrupoCtx)', async () => {
    await expect(
      plantillaService.crear({ nombre: 'T', tipo: 'invalid_type', plantilla: {} }, CTX_GRUPO_1)
    ).rejects.toThrow(ConflictError);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('crea la plantilla con id_grupo del ctx', async () => {
    const nueva = mkPlantilla({ tipo: 'ticket', id_grupo: 1 });

    (prisma.$transaction as any).mockImplementationOnce(async (fn: any) => {
      const tx = {
        plantillaImpresion: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create:     vi.fn().mockResolvedValue(nueva),
        },
      };
      return fn(tx);
    });

    const result = await plantillaService.crear(
      { nombre: 'Ticket estándar', tipo: 'ticket', plantilla: {} },
      CTX_GRUPO_1,
    );

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(result.tipo).toBe('ticket');
    expect(cacheDel).toHaveBeenCalledWith('plantillas:all', 'plantillas:tipo:ticket', 'plantilla:default:ticket');
  });

  it('superadmin sin grupoId crea plantilla global (id_grupo=null)', async () => {
    const global = mkPlantilla({ tipo: 'ticket', id_grupo: null });
    const mockCreate = vi.fn().mockResolvedValue(global);

    (prisma.$transaction as any).mockImplementationOnce(async (fn: any) => {
      const tx = { plantillaImpresion: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), create: mockCreate } };
      return fn(tx);
    });

    const result = await plantillaService.crear(
      { nombre: 'Global', tipo: 'ticket', plantilla: {} },
      CTX_SUPER,
    );

    expect(result.id_grupo).toBeNull();
  });

  it('llama updateMany scoped al grupo al crear con es_default=true', async () => {
    const nueva = mkPlantilla({ es_default: true, tipo: 'factura', id_grupo: 1 });
    const mockUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

    (prisma.$transaction as any).mockImplementationOnce(async (fn: any) => {
      const tx = {
        plantillaImpresion: {
          updateMany: mockUpdateMany,
          create:     vi.fn().mockResolvedValue(nueva),
        },
      };
      return fn(tx);
    });

    await plantillaService.crear(
      { nombre: 'Nueva default', tipo: 'factura', es_default: true, plantilla: {} },
      CTX_GRUPO_1,
    );

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tipo: 'factura', es_default: true, id_grupo: 1 }),
      })
    );
  });

  it('NO llama updateMany si es_default es false', async () => {
    const nueva = mkPlantilla({ tipo: 'comanda', es_default: false });
    const mockUpdateMany = vi.fn();

    (prisma.$transaction as any).mockImplementationOnce(async (fn: any) => {
      const tx = {
        plantillaImpresion: {
          updateMany: mockUpdateMany,
          create:     vi.fn().mockResolvedValue(nueva),
        },
      };
      return fn(tx);
    });

    await plantillaService.crear(
      { nombre: 'Comanda sin default', tipo: 'comanda', es_default: false, plantilla: {} },
      CTX_GRUPO_1,
    );

    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});

// ── actualizar — tenant guard ─────────────────────────────────────────────────

describe('plantillaService.actualizar — tenant guard', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lanza NotFoundError si la plantilla pertenece a otra cadena (cross-tenant)', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 1'));

    await expect(
      plantillaService.actualizar(1, { nombre: 'X' }, CTX_GRUPO_2)
    ).rejects.toThrow(NotFoundError);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lanza NotFoundError si la plantilla es global y el usuario no es superadmin', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 1'));

    await expect(
      plantillaService.actualizar(1, { nombre: 'X' }, CTX_GRUPO_1)
    ).rejects.toThrow(NotFoundError);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('invalida el caché del tipo anterior cuando cambia el tipo', async () => {
    const existente = mkPlantilla({ tipo: 'ticket', id_grupo: 1 });
    const actualizada = mkPlantilla({ tipo: 'comanda', id_grupo: 1 });

    repo.findByIdScoped.mockResolvedValueOnce(existente);
    (prisma.$transaction as any).mockImplementationOnce(async (fn: any) => {
      const tx = {
        plantillaImpresion: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          update:     vi.fn().mockResolvedValue(actualizada),
        },
      };
      return fn(tx);
    });

    await plantillaService.actualizar(1, { tipo: 'comanda' }, CTX_GRUPO_1);

    const deletedKeys = (cacheDel as any).mock.calls[0];
    expect(deletedKeys).toContain('plantillas:tipo:ticket');
    expect(deletedKeys).toContain('plantilla:default:ticket');
    expect(deletedKeys).toContain('plantillas:tipo:comanda');
  });

  it('solo invalida el tipo nuevo si el tipo no cambió', async () => {
    const existente = mkPlantilla({ tipo: 'ticket', id_grupo: 1 });
    const actualizada = mkPlantilla({ tipo: 'ticket', nombre: 'Ticket v2', id_grupo: 1 });

    repo.findByIdScoped.mockResolvedValueOnce(existente);
    (prisma.$transaction as any).mockImplementationOnce(async (fn: any) => {
      const tx = {
        plantillaImpresion: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          update:     vi.fn().mockResolvedValue(actualizada),
        },
      };
      return fn(tx);
    });

    await plantillaService.actualizar(1, { nombre: 'Ticket v2' }, CTX_GRUPO_1);

    const deletedKeys = (cacheDel as any).mock.calls[0];
    const ticketCount = deletedKeys.filter((k: string) => k === 'plantillas:tipo:ticket').length;
    expect(ticketCount).toBe(1);
  });

  it('superadmin puede actualizar plantilla de cualquier cadena', async () => {
    const existente = mkPlantilla({ id_grupo: 99 });
    const actualizada = mkPlantilla({ nombre: 'X', id_grupo: 99 });

    repo.findByIdScoped.mockResolvedValueOnce(existente);
    (prisma.$transaction as any).mockImplementationOnce(async (fn: any) => {
      const tx = {
        plantillaImpresion: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          update:     vi.fn().mockResolvedValue(actualizada),
        },
      };
      return fn(tx);
    });

    await expect(
      plantillaService.actualizar(1, { nombre: 'X' }, CTX_SUPER)
    ).resolves.toMatchObject({ nombre: 'X' });
  });

  it('superadmin puede actualizar plantilla global (id_grupo=null)', async () => {
    const global = mkPlantilla({ id_grupo: null });
    const actualizada = mkPlantilla({ nombre: 'Global v2', id_grupo: null });

    repo.findByIdScoped.mockResolvedValueOnce(global);
    (prisma.$transaction as any).mockImplementationOnce(async (fn: any) => {
      const tx = {
        plantillaImpresion: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          update:     vi.fn().mockResolvedValue(actualizada),
        },
      };
      return fn(tx);
    });

    await expect(
      plantillaService.actualizar(1, { nombre: 'Global v2' }, CTX_SUPER)
    ).resolves.toMatchObject({ nombre: 'Global v2' });
  });
});

// ── eliminar — tenant guard ───────────────────────────────────────────────────

describe('plantillaService.eliminar — tenant guard', () => {
  beforeEach(() => vi.resetAllMocks());

  it('hace soft-delete e invalida todos los cachés relacionados (happy path)', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(mkPlantilla({ tipo: 'ticket', id_grupo: 1 }));
    repo.softDelete.mockResolvedValue(undefined);

    await plantillaService.eliminar(1, CTX_GRUPO_1);

    expect(repo.softDelete).toHaveBeenCalledWith(1);
    expect(cacheDel).toHaveBeenCalledWith(
      'plantillas:all',
      'plantilla:1',
      'plantillas:tipo:ticket',
      'plantilla:default:ticket',
    );
  });

  it('lanza NotFoundError cross-tenant y no hace softDelete', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 1'));

    await expect(plantillaService.eliminar(1, CTX_GRUPO_2)).rejects.toThrow(NotFoundError);
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it('usuario normal no puede eliminar plantilla global (id_grupo=null) → 404', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 1'));

    await expect(plantillaService.eliminar(1, CTX_GRUPO_1)).rejects.toThrow(NotFoundError);
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it('superadmin puede eliminar plantilla global', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(mkPlantilla({ tipo: 'ticket', id_grupo: null }));
    repo.softDelete.mockResolvedValue(undefined);

    await expect(plantillaService.eliminar(1, CTX_SUPER)).resolves.toBeUndefined();
    expect(repo.softDelete).toHaveBeenCalledWith(1);
  });

  it('superadmin puede eliminar plantilla de cualquier cadena', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(mkPlantilla({ tipo: 'comanda', id_grupo: 99 }));
    repo.softDelete.mockResolvedValue(undefined);

    await expect(plantillaService.eliminar(1, CTX_SUPER_GRUPO)).resolves.toBeUndefined();
    expect(repo.softDelete).toHaveBeenCalledWith(1);
  });
});
