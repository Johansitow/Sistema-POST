/**
 * Tests para featureFlagService — isEnabled, getClientFlags, CRUD, asignaciones
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/feature-flag.repository', () => ({
  featureFlagRepository: {
    findAll:          vi.fn(),
    findById:         vi.fn(),
    findByNombre:     vi.fn(),
    create:           vi.fn(),
    update:           vi.fn(),
    delete:           vi.fn(),
    setAsignacion:    vi.fn(),
    deleteAsignacion: vi.fn(),
  },
}));

vi.mock('../../config/redis', () => ({
  cacheGetOrSet: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()),
  cacheDel:      vi.fn(),
  CACHE_TTL:     { SHORT: 60, MID: 300, LONG: 3600 },
}));

vi.mock('../../config/socket.gateway', () => ({
  socketGateway: {
    emitFeatureFlagChanged: vi.fn(),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { featureFlagService }    from '../feature-flag.service';
import { featureFlagRepository } from '../../repositories/feature-flag.repository';
import { cacheDel }              from '../../config/redis';
import { socketGateway }         from '../../config/socket.gateway';
import { NotFoundError, ConflictError } from '../../exceptions/HttpErrors';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mkFlag = (overrides = {}) => ({
  id:          1,
  nombre:      'variantes_productos',
  descripcion: 'Activa el módulo de variantes',
  habilitado:  true,
  scope:       'global',
  metadata:    null,
  asignaciones: [],
  ...overrides,
});

// ── isEnabled ─────────────────────────────────────────────────────────────────

describe('featureFlagService.isEnabled', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna false si el flag no existe', async () => {
    (featureFlagRepository.findByNombre as any).mockResolvedValue(null);
    expect(await featureFlagService.isEnabled('inexistente')).toBe(false);
  });

  it('retorna false si el flag está deshabilitado globalmente', async () => {
    (featureFlagRepository.findByNombre as any).mockResolvedValue(mkFlag({ habilitado: false }));
    expect(await featureFlagService.isEnabled('variantes_productos')).toBe(false);
  });

  it('retorna true para un flag global habilitado', async () => {
    (featureFlagRepository.findByNombre as any).mockResolvedValue(mkFlag({ scope: 'global', habilitado: true }));
    expect(await featureFlagService.isEnabled('variantes_productos')).toBe(true);
  });

  it('retorna true para scope=contexto con asignación activa', async () => {
    (featureFlagRepository.findByNombre as any).mockResolvedValue(mkFlag({
      scope: 'contexto',
      habilitado: true,
      asignaciones: [{ contexto: 'restaurante_1', habilitado: true }],
    }));
    expect(await featureFlagService.isEnabled('variantes_productos', 'restaurante_1')).toBe(true);
  });

  it('retorna false para scope=contexto sin asignación específica', async () => {
    (featureFlagRepository.findByNombre as any).mockResolvedValue(mkFlag({
      scope: 'contexto',
      habilitado: true,
      asignaciones: [],
    }));
    expect(await featureFlagService.isEnabled('variantes_productos', 'restaurante_99')).toBe(false);
  });

  it('retorna false si la asignación específica está deshabilitada', async () => {
    (featureFlagRepository.findByNombre as any).mockResolvedValue(mkFlag({
      scope: 'contexto',
      habilitado: true,
      asignaciones: [{ contexto: 'restaurante_1', habilitado: false }],
    }));
    expect(await featureFlagService.isEnabled('variantes_productos', 'restaurante_1')).toBe(false);
  });
});

// ── getClientFlags ────────────────────────────────────────────────────────────

describe('featureFlagService.getClientFlags', () => {
  beforeEach(() => vi.clearAllMocks());

  it('construye el mapa nombre→boolean correctamente para flags globales', async () => {
    (featureFlagRepository.findAll as any).mockResolvedValue([
      mkFlag({ nombre: 'variantes',  habilitado: true,  scope: 'global' }),
      mkFlag({ nombre: 'reportes',   habilitado: false, scope: 'global' }),
    ]);

    const result = await featureFlagService.getClientFlags();

    expect(result).toEqual({ variantes: true, reportes: false });
  });

  it('resuelve asignaciones de contexto cuando se proporciona contexto', async () => {
    (featureFlagRepository.findAll as any).mockResolvedValue([
      mkFlag({
        nombre: 'multi_restaurante',
        habilitado: true,
        scope: 'contexto',
        asignaciones: [{ contexto: 'restaurante_1', habilitado: true }],
      }),
    ]);

    const result = await featureFlagService.getClientFlags('restaurante_1');
    expect(result['multi_restaurante']).toBe(true);
  });

  it('retorna false para contexto sin asignación', async () => {
    (featureFlagRepository.findAll as any).mockResolvedValue([
      mkFlag({
        nombre: 'multi_restaurante',
        habilitado: true,
        scope: 'contexto',
        asignaciones: [],
      }),
    ]);

    const result = await featureFlagService.getClientFlags('restaurante_99');
    expect(result['multi_restaurante']).toBe(false);
  });
});

// ── crear ─────────────────────────────────────────────────────────────────────

describe('featureFlagService.crear', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea el flag cuando el nombre no existe', async () => {
    (featureFlagRepository.findByNombre as any).mockResolvedValue(null);
    (featureFlagRepository.create as any).mockResolvedValue(mkFlag());

    const result = await featureFlagService.crear({ nombre: 'variantes_productos', habilitado: true });

    expect(featureFlagRepository.create).toHaveBeenCalledOnce();
    expect(cacheDel).toHaveBeenCalledWith('ff:all');
    expect((socketGateway as any).emitFeatureFlagChanged).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'crear' })
    );
    expect(result.nombre).toBe('variantes_productos');
  });

  it('lanza ConflictError si el nombre ya existe', async () => {
    (featureFlagRepository.findByNombre as any).mockResolvedValue(mkFlag());

    await expect(featureFlagService.crear({ nombre: 'variantes_productos' }))
      .rejects.toThrow(ConflictError);

    expect(featureFlagRepository.create).not.toHaveBeenCalled();
    expect((socketGateway as any).emitFeatureFlagChanged).not.toHaveBeenCalled();
  });
});

// ── actualizar ────────────────────────────────────────────────────────────────

describe('featureFlagService.actualizar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('actualiza el flag e invalida caché', async () => {
    (featureFlagRepository.findById as any).mockResolvedValue(mkFlag());
    (featureFlagRepository.update as any).mockResolvedValue(mkFlag({ habilitado: false }));

    await featureFlagService.actualizar(1, { habilitado: false });

    expect(cacheDel).toHaveBeenCalledWith(
      expect.stringContaining('ff:all'),
      expect.stringContaining('ff:variantes_productos'),
    );
    expect((socketGateway as any).emitFeatureFlagChanged).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'actualizar' })
    );
  });

  it('invalida caches de contextos cuando se renombra el flag', async () => {
    const flagConAsignaciones = mkFlag({
      asignaciones: [
        { contexto: 'restaurante_1', habilitado: true },
        { contexto: 'restaurante_2', habilitado: false },
      ],
    });
    (featureFlagRepository.findById as any).mockResolvedValue(flagConAsignaciones);
    (featureFlagRepository.update as any).mockResolvedValue(mkFlag({ nombre: 'nuevo_nombre' }));

    await featureFlagService.actualizar(1, { nombre: 'nuevo_nombre' });

    const deletedKeys = (cacheDel as any).mock.calls[0];
    expect(deletedKeys).toContain('ff:variantes_productos:restaurante_1');
    expect(deletedKeys).toContain('ff:variantes_productos:restaurante_2');
    expect(deletedKeys).toContain('ff:nuevo_nombre');
  });

  it('lanza NotFoundError si el flag no existe', async () => {
    (featureFlagRepository.findById as any).mockResolvedValue(null);

    await expect(featureFlagService.actualizar(99, { habilitado: false }))
      .rejects.toThrow(NotFoundError);
  });
});

// ── eliminar ──────────────────────────────────────────────────────────────────

describe('featureFlagService.eliminar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('elimina el flag, invalida caché y emite evento', async () => {
    (featureFlagRepository.findById as any).mockResolvedValue(mkFlag());
    (featureFlagRepository.delete as any).mockResolvedValue(undefined);

    await featureFlagService.eliminar(1);

    expect(featureFlagRepository.delete).toHaveBeenCalledWith(1);
    expect(cacheDel).toHaveBeenCalledWith('ff:all', 'ff:variantes_productos');
    expect((socketGateway as any).emitFeatureFlagChanged).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'variantes_productos', accion: 'eliminar' })
    );
  });
});

// ── resolución de dos niveles (restaurante → grupo → global) ──────────────────

describe('featureFlagService — resolución de dos niveles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asignación de restaurante presente → gana restaurante', async () => {
    (featureFlagRepository.findByNombre as any).mockResolvedValue(mkFlag({
      scope: 'contexto',
      habilitado: true,
      asignaciones: [
        { contexto: 'restaurante_1', habilitado: true },
        { contexto: 'grupo_10',      habilitado: false },
      ],
    }));
    expect(await featureFlagService.isEnabled('variantes_productos', 'restaurante_1', 'grupo_10')).toBe(true);
  });

  it('sin asignación de restaurante, con asignación de grupo → gana grupo', async () => {
    (featureFlagRepository.findByNombre as any).mockResolvedValue(mkFlag({
      scope: 'contexto',
      habilitado: true,
      asignaciones: [
        { contexto: 'grupo_10', habilitado: true },
      ],
    }));
    expect(await featureFlagService.isEnabled('variantes_productos', 'restaurante_99', 'grupo_10')).toBe(true);
  });

  it('sin ninguna asignación → cae al valor global del flag (false para scope=contexto)', async () => {
    (featureFlagRepository.findByNombre as any).mockResolvedValue(mkFlag({
      scope: 'contexto',
      habilitado: true,
      asignaciones: [],
    }));
    expect(await featureFlagService.isEnabled('variantes_productos', 'restaurante_99', 'grupo_10')).toBe(false);
  });
});

// ── setAsignacion ─────────────────────────────────────────────────────────────

describe('featureFlagService.setAsignacion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea/actualiza la asignación e invalida caché de contexto', async () => {
    (featureFlagRepository.findById as any).mockResolvedValue(mkFlag());
    (featureFlagRepository.setAsignacion as any).mockResolvedValue({
      id_feature_flag: 1, contexto: 'restaurante_1', habilitado: true,
    });

    await featureFlagService.setAsignacion(1, 'restaurante_1', true);

    expect(cacheDel).toHaveBeenCalledWith(
      'ff:all',
      'ff:variantes_productos',
      'ff:variantes_productos:restaurante_1',
    );
    expect((socketGateway as any).emitFeatureFlagChanged).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'asignacion' })
    );
  });
});
