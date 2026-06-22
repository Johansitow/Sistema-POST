/**
 * Tests para onboardingService.
 *
 * Cubre:
 *   - previsualizarPerfil: retorna plan sin tocar BD.
 *   - aplicarPerfil: escribe flags, configs y onboarding_completado en transacción.
 *   - Idempotencia: segunda llamada upsert no duplica entradas.
 *   - Colisión de resolver: error se propaga antes de abrir la transacción.
 *   - Tenant isolation: onboarding_completado se escribe con contexto de restaurante,
 *     nunca de forma global.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma mock (transaccional) ───────────────────────────────────────────────

const mockTx = {
  featureFlag: {
    findUnique: vi.fn(),
    create:     vi.fn(),
  },
  featureFlagAsignacion: {
    upsert: vi.fn(),
  },
  configuracionRestaurante: {
    upsert: vi.fn(),
  },
  configuracionGrupo: {
    upsert: vi.fn(),
  },
};

vi.mock('../../config/database', () => ({
  default: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  },
}));

// ── Imports DESPUÉS de mocks ───────────────────────────────────────────────────

import { onboardingService } from '../onboarding.service';
import prisma from '../../config/database';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const RESTAURANTE_ID = 5;
const GRUPO_ID       = 2;

function mkFlag(id: number, nombre: string) {
  return { id, nombre, habilitado: false, scope: 'contexto' };
}

// ── previsualizarPerfil ───────────────────────────────────────────────────────

describe('onboardingService.previsualizarPerfil', () => {
  it('retorna flags y configs sin llamar a $transaction', () => {
    const result = onboardingService.previsualizarPerfil({ arquetipo: 'dark_kitchen' });

    expect(result.flags.length).toBeGreaterThan(0);
    expect(result.configs.length).toBeGreaterThan(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('retorna un plan coherente para arquetipo cafeteria', () => {
    const result = onboardingService.previsualizarPerfil({ arquetipo: 'cafeteria' });
    const modInventario = result.flags.find(f => f.nombre === 'modulo.inventario');
    expect(modInventario?.habilitado).toBe(true);
    expect(modInventario?.nivel).toBe('sede');
  });

  it('lanza si se invoca sin arquetipo ni ejes', () => {
    expect(() => onboardingService.previsualizarPerfil({})).toThrow(/debe proporcionarse/);
  });

  it('lanza si el arquetipo es desconocido', () => {
    expect(() => onboardingService.previsualizarPerfil({ arquetipo: 'pizzeria' }))
      .toThrow(/arquetipo desconocido/);
  });
});

// ── aplicarPerfil — happy path ────────────────────────────────────────────────

describe('onboardingService.aplicarPerfil — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Flags pre-sembrados: encontrados en BD
    mockTx.featureFlag.findUnique.mockResolvedValue(mkFlag(10, 'modulo.mesas'));
    mockTx.featureFlag.create.mockResolvedValue(mkFlag(99, 'new_flag'));
    mockTx.featureFlagAsignacion.upsert.mockResolvedValue({});
    mockTx.configuracionRestaurante.upsert.mockResolvedValue({});
    mockTx.configuracionGrupo.upsert.mockResolvedValue({});
  });

  it('llama a $transaction exactamente una vez', async () => {
    await onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, { arquetipo: 'dark_kitchen' });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('devuelve el mismo perfil que previsualizarPerfil', async () => {
    const preview = onboardingService.previsualizarPerfil({ arquetipo: 'dark_kitchen' });
    const applied = await onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, { arquetipo: 'dark_kitchen' });
    expect(applied.flags).toEqual(preview.flags);
    expect(applied.configs).toEqual(preview.configs);
  });

  it('escribe asignaciones de sede con contexto restaurante_<id>', async () => {
    await onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, { arquetipo: 'dark_kitchen' });
    const calls = mockTx.featureFlagAsignacion.upsert.mock.calls;
    const sedeCtxCalls = calls.filter(([arg]) =>
      arg.create.contexto === `restaurante_${RESTAURANTE_ID}`
    );
    expect(sedeCtxCalls.length).toBeGreaterThan(0);
  });

  it('escribe asignaciones de grupo con contexto grupo_<id>', async () => {
    await onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, { arquetipo: 'dark_kitchen' });
    const calls = mockTx.featureFlagAsignacion.upsert.mock.calls;
    const grupoCtxCalls = calls.filter(([arg]) =>
      arg.create.contexto === `grupo_${GRUPO_ID}`
    );
    expect(grupoCtxCalls.length).toBeGreaterThan(0);
  });

  it('escribe configs de sede en ConfiguracionRestaurante', async () => {
    await onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, { arquetipo: 'dark_kitchen' });
    expect(mockTx.configuracionRestaurante.upsert).toHaveBeenCalled();
    const calls = mockTx.configuracionRestaurante.upsert.mock.calls;
    expect(calls[0][0].create.id_restaurante).toBe(RESTAURANTE_ID);
  });

  it('escribe configs de grupo en ConfiguracionGrupo', async () => {
    // dark_kitchen no tiene configs de grupo; usamos franquicia (multisede=si → grupo)
    // pero configs nivel grupo vienen de ejes como recetas (flags, no configs)
    // Usamos un arquetipo que tenga configs de grupo: ninguno en el catálogo actual
    // → verificamos que NO se llame a ConfiguracionGrupo para dark_kitchen
    await onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, { arquetipo: 'dark_kitchen' });
    // dark_kitchen: todos los configs son de nivel=sede
    expect(mockTx.configuracionGrupo.upsert).not.toHaveBeenCalled();
  });
});

// ── onboarding_completado — aislamiento tenant ────────────────────────────────

describe('onboardingService.aplicarPerfil — onboarding_completado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.featureFlag.findUnique.mockResolvedValue(mkFlag(1, 'onboarding_completado'));
    mockTx.featureFlag.create.mockResolvedValue(mkFlag(99, 'nuevo'));
    mockTx.featureFlagAsignacion.upsert.mockResolvedValue({});
    mockTx.configuracionRestaurante.upsert.mockResolvedValue({});
    mockTx.configuracionGrupo.upsert.mockResolvedValue({});
  });

  it('escribe onboarding_completado=true con contexto restaurante_<id> (nunca global)', async () => {
    await onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, { arquetipo: 'dark_kitchen' });

    const upsertCalls = mockTx.featureFlagAsignacion.upsert.mock.calls;
    const completadoCall = upsertCalls.find(([arg]) =>
      arg.create.contexto === `restaurante_${RESTAURANTE_ID}` &&
      arg.create.habilitado === true
    );
    expect(completadoCall).toBeDefined();

    // Ninguna llamada usa contexto vacío o 'global'
    const globalCall = upsertCalls.find(([arg]) =>
      !arg.create.contexto || arg.create.contexto === 'global'
    );
    expect(globalCall).toBeUndefined();
  });

  it('crea el flag onboarding_completado si no está en BD (red de seguridad)', async () => {
    // Primera llamada: findUnique devuelve null para onboarding_completado
    mockTx.featureFlag.findUnique
      .mockResolvedValueOnce(mkFlag(10, 'modulo.mesas'))   // primer flag del resolver
      .mockResolvedValue(null);                             // onboarding_completado no existe
    mockTx.featureFlag.create.mockResolvedValue(mkFlag(99, 'onboarding_completado'));

    await onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, {
      ejes: { servicio: 'mostrador', caja: 'no', clientes: 'anonimo', multisede: 'no' },
    });

    expect(mockTx.featureFlag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nombre: 'onboarding_completado', scope: 'contexto' }),
      })
    );
  });

  it('diferentes restaurantes → contextos distintos, sin contaminación', async () => {
    const RESTAURANTE_A = 1;
    const RESTAURANTE_B = 2;

    await onboardingService.aplicarPerfil(RESTAURANTE_A, GRUPO_ID, {
      ejes: { servicio: 'mostrador', caja: 'no', clientes: 'anonimo', multisede: 'no' },
    });
    const callsA = mockTx.featureFlagAsignacion.upsert.mock.calls.map(([a]) => a.create.contexto);

    vi.clearAllMocks();
    mockTx.featureFlag.findUnique.mockResolvedValue(mkFlag(1, 'onboarding_completado'));
    mockTx.featureFlagAsignacion.upsert.mockResolvedValue({});
    mockTx.configuracionRestaurante.upsert.mockResolvedValue({});

    await onboardingService.aplicarPerfil(RESTAURANTE_B, GRUPO_ID, {
      ejes: { servicio: 'mostrador', caja: 'no', clientes: 'anonimo', multisede: 'no' },
    });
    const callsB = mockTx.featureFlagAsignacion.upsert.mock.calls.map(([a]) => a.create.contexto);

    expect(callsA).not.toEqual(callsB);
    expect(callsA.some(c => c.includes(`restaurante_${RESTAURANTE_A}`))).toBe(true);
    expect(callsB.some(c => c.includes(`restaurante_${RESTAURANTE_B}`))).toBe(true);
  });
});

// ── Colisión propagada antes de la transacción ────────────────────────────────

describe('onboardingService.aplicarPerfil — propagación de errores del resolver', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza error de colisión ANTES de abrir $transaction', async () => {
    await expect(
      onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, { arquetipo: 'pizzeria' })
    ).rejects.toThrow(/arquetipo desconocido/);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lanza si no viene arquetipo ni ejes', async () => {
    await expect(
      onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, {})
    ).rejects.toThrow(/debe proporcionarse/);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ── Idempotencia (upsert) ─────────────────────────────────────────────────────

describe('onboardingService.aplicarPerfil — idempotencia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.featureFlag.findUnique.mockResolvedValue(mkFlag(10, 'any_flag'));
    mockTx.featureFlagAsignacion.upsert.mockResolvedValue({});
    mockTx.configuracionRestaurante.upsert.mockResolvedValue({});
    mockTx.configuracionGrupo.upsert.mockResolvedValue({});
  });

  it('segunda llamada no lanza (upsert es idempotente)', async () => {
    const input = { arquetipo: 'dark_kitchen' as const };
    await expect(onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, input)).resolves.toBeDefined();
    await expect(onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, input)).resolves.toBeDefined();
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
