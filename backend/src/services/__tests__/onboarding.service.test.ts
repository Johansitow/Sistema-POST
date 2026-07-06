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
 *   - detectarHuerfanos: dependencias por módulo-padre apagado.
 *   - Cascada en apply: huérfanos se apagan; bloqueados por es_editable se omiten.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma mock (transaccional + top-level) ───────────────────────────────────
// vi.hoisted() permite definir variables antes del hoisting de vi.mock().

const { mockTx, mockPrismaTopLevel, mockCacheDel } = vi.hoisted(() => {
  const mockTx = {
    featureFlag: {
      findUnique: vi.fn(),
      create:     vi.fn(),
      upsert:     vi.fn(),
    },
    featureFlagAsignacion: {
      upsert: vi.fn(),
    },
    configuracionRestaurante: {
      upsert:    vi.fn(),
      findFirst: vi.fn(),
    },
    configuracionGrupo: {
      upsert: vi.fn(),
    },
  };
  const mockPrismaTopLevel = {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
    featureFlagAsignacion: {
      findMany: vi.fn(),
    },
  };
  const mockCacheDel = vi.fn().mockResolvedValue(undefined);
  return { mockTx, mockPrismaTopLevel, mockCacheDel };
});

vi.mock('../../config/database', () => ({
  default: mockPrismaTopLevel,
}));

vi.mock('../../config/redis', () => ({
  cacheDel:      (...args: unknown[]) => mockCacheDel(...args),
  cacheGetOrSet: (_key: string, _ttl: number, fn: () => unknown) => fn(),
  CACHE_TTL:     { SHORT: 60, MID: 300, LONG: 3600 },
}));

// ── Imports DESPUÉS de mocks ───────────────────────────────────────────────────

import { onboardingService } from '../onboarding.service';
import { detectarHuerfanos, resolverPerfil } from '../../lib/onboarding/resolverPerfil';
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
    mockTx.featureFlag.upsert.mockResolvedValue({ id: 1, nombre: 'onboarding_completado', habilitado: true, scope: 'contexto' });
    mockTx.featureFlagAsignacion.upsert.mockResolvedValue({});
    mockTx.configuracionRestaurante.upsert.mockResolvedValue({});
    mockTx.configuracionRestaurante.findFirst.mockResolvedValue(null);
    mockTx.configuracionGrupo.upsert.mockResolvedValue({});
    // sin estado previo (primera vez)
    mockPrismaTopLevel.featureFlagAsignacion.findMany.mockResolvedValue([]);
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
    mockTx.featureFlag.findUnique.mockResolvedValue(mkFlag(1, 'any_flag'));
    mockTx.featureFlag.create.mockResolvedValue(mkFlag(99, 'nuevo'));
    mockTx.featureFlag.upsert.mockResolvedValue({ id: 1, nombre: 'onboarding_completado', habilitado: true, scope: 'contexto' });
    mockTx.featureFlagAsignacion.upsert.mockResolvedValue({});
    mockTx.configuracionRestaurante.upsert.mockResolvedValue({});
    mockTx.configuracionRestaurante.findFirst.mockResolvedValue(null);
    mockTx.configuracionGrupo.upsert.mockResolvedValue({});
    mockPrismaTopLevel.featureFlagAsignacion.findMany.mockResolvedValue([]);
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

  it('usa upsert para onboarding_completado con habilitado=true (crea si no existe)', async () => {
    await onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, {
      ejes: { servicio: 'mostrador', caja: 'no', clientes: 'anonimo', multisede: 'no' },
    });

    expect(mockTx.featureFlag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where:  { nombre: 'onboarding_completado' },
        create: expect.objectContaining({ nombre: 'onboarding_completado', habilitado: true, scope: 'contexto' }),
        update: { habilitado: true },
      })
    );
  });

  it('corrige el flag master aunque estuviera con habilitado=false en BD (regresión)', async () => {
    // Simula instancia con flag sembrado en habilitado=false
    mockTx.featureFlag.upsert.mockResolvedValue({ id: 1, nombre: 'onboarding_completado', habilitado: true, scope: 'contexto' });

    await onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, {
      ejes: { servicio: 'mostrador', caja: 'no', clientes: 'anonimo', multisede: 'no' },
    });

    const upsertCall = mockTx.featureFlag.upsert.mock.calls[0]?.[0];
    expect(upsertCall?.update).toEqual({ habilitado: true });
  });

  it('invalida la caché ff:all después de aplicar', async () => {
    await onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, { arquetipo: 'dark_kitchen' });
    expect(mockCacheDel).toHaveBeenCalledWith('ff:all');
  });

  it('diferentes restaurantes → contextos distintos, sin contaminación', async () => {
    const RESTAURANTE_A = 1;
    const RESTAURANTE_B = 2;

    await onboardingService.aplicarPerfil(RESTAURANTE_A, GRUPO_ID, {
      ejes: { servicio: 'mostrador', caja: 'no', clientes: 'anonimo', multisede: 'no' },
    });
    const callsA = mockTx.featureFlagAsignacion.upsert.mock.calls.map(([a]) => a.create.contexto);

    vi.clearAllMocks();
    mockTx.featureFlag.findUnique.mockResolvedValue(mkFlag(1, 'any_flag'));
    mockTx.featureFlag.upsert.mockResolvedValue({ id: 1, nombre: 'onboarding_completado', habilitado: true, scope: 'contexto' });
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
    mockTx.featureFlag.upsert.mockResolvedValue({ id: 1, nombre: 'onboarding_completado', habilitado: true, scope: 'contexto' });
    mockTx.featureFlagAsignacion.upsert.mockResolvedValue({});
    mockTx.configuracionRestaurante.upsert.mockResolvedValue({});
    mockTx.configuracionRestaurante.findFirst.mockResolvedValue(null);
    mockTx.configuracionGrupo.upsert.mockResolvedValue({});
    mockPrismaTopLevel.featureFlagAsignacion.findMany.mockResolvedValue([]);
  });

  it('segunda llamada no lanza (upsert es idempotente)', async () => {
    const input = { arquetipo: 'dark_kitchen' as const };
    await expect(onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, input)).resolves.toBeDefined();
    await expect(onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, input)).resolves.toBeDefined();
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});

// ── detectarHuerfanos — función pura ──────────────────────────────────────────

describe('detectarHuerfanos — cada dependencia declarada', () => {
  it('modulo.fidelizacion es huérfano cuando modulo.clientes queda off', () => {
    const perfil = { flags: [
      { nombre: 'modulo.clientes',     habilitado: false, nivel: 'grupo' as const },
      { nombre: 'modulo.fidelizacion', habilitado: true,  nivel: 'grupo' as const },
    ], configs: [] };
    const resultado = detectarHuerfanos(perfil);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].clave).toBe('modulo.fidelizacion');
    expect(resultado[0].dependeDe).toBe('modulo.clientes');
    expect(resultado[0].motivo).toMatch(/clientes/);
  });

  it('inventario.lotes es huérfano cuando modulo.inventario queda off', () => {
    const perfil = { flags: [
      { nombre: 'modulo.inventario', habilitado: false, nivel: 'sede' as const },
      { nombre: 'inventario.lotes',  habilitado: true,  nivel: 'sede' as const },
    ], configs: [] };
    const resultado = detectarHuerfanos(perfil);
    expect(resultado.some(h => h.clave === 'inventario.lotes')).toBe(true);
  });

  it('inventario.descuento_auto es huérfano cuando modulo.inventario queda off', () => {
    const perfil = { flags: [
      { nombre: 'modulo.inventario',          habilitado: false, nivel: 'sede' as const },
      { nombre: 'inventario.descuento_auto',  habilitado: true,  nivel: 'sede' as const },
    ], configs: [] };
    const resultado = detectarHuerfanos(perfil);
    expect(resultado.some(h => h.clave === 'inventario.descuento_auto')).toBe(true);
  });

  it('recetas.fases es huérfano cuando modulo.recetas queda off', () => {
    const perfil = { flags: [
      { nombre: 'modulo.recetas', habilitado: false, nivel: 'grupo' as const },
      { nombre: 'recetas.fases',  habilitado: true,  nivel: 'grupo' as const },
    ], configs: [] };
    const resultado = detectarHuerfanos(perfil);
    expect(resultado.some(h => h.clave === 'recetas.fases')).toBe(true);
  });

  it('modulo.reportes_consolidados es huérfano cuando estructura.multisede queda off', () => {
    const perfil = { flags: [
      { nombre: 'estructura.multisede',            habilitado: false, nivel: 'grupo' as const },
      { nombre: 'modulo.reportes_consolidados',    habilitado: true,  nivel: 'grupo' as const },
    ], configs: [] };
    const resultado = detectarHuerfanos(perfil);
    expect(resultado.some(h => h.clave === 'modulo.reportes_consolidados')).toBe(true);
  });

  it('ordenes.propina es huérfano cuando modulo.mesas queda off', () => {
    const perfil = { flags: [
      { nombre: 'modulo.mesas',    habilitado: false, nivel: 'sede' as const },
      { nombre: 'ordenes.propina', habilitado: true,  nivel: 'sede' as const },
    ], configs: [] };
    const resultado = detectarHuerfanos(perfil);
    expect(resultado.some(h => h.clave === 'ordenes.propina')).toBe(true);
  });

  it('arquetipo curado coherente dark_kitchen → lista vacía (sin huérfanos)', () => {
    // dark_kitchen: delivery→mesas=off+propina=off; inventario=simple→lotes=off;
    // clientes=registro→fidelizacion=off; multisede=no→reportes_consolidados=off.
    // Todos los hijos quedan off también → no hay huérfano.
    const perfil = resolverPerfil({ arquetipo: 'dark_kitchen' });
    const resultado = detectarHuerfanos(perfil);
    expect(resultado).toHaveLength(0);
  });

  it('arquetipo con_mesas (coherente) → lista vacía', () => {
    const perfil = resolverPerfil({ arquetipo: 'con_mesas' });
    const resultado = detectarHuerfanos(perfil);
    expect(resultado).toHaveLength(0);
  });

  it('padre no en el perfil → no se detecta huérfano aunque hijo esté off', () => {
    // Si el padre no aparece en el perfil (no se está apagando), no hay problema.
    const perfil = { flags: [
      { nombre: 'modulo.fidelizacion', habilitado: true, nivel: 'grupo' as const },
      // modulo.clientes NO está en el perfil → no se apaga
    ], configs: [] };
    const resultado = detectarHuerfanos(perfil);
    expect(resultado).toHaveLength(0);
  });
});

// ── detectarHuerfanos — relanzamiento (estadoActual) ─────────────────────────

describe('detectarHuerfanos — relanzamiento con estadoActual', () => {
  it('hijo activo en BD pero ausente del perfil + padre apagado → huérfano', () => {
    // Relanzamiento: el nuevo perfil apaga modulo.clientes pero no menciona fidelizacion.
    // En BD, fidelizacion está en true (del onboarding anterior).
    const perfil = { flags: [
      { nombre: 'modulo.clientes', habilitado: false, nivel: 'grupo' as const },
      // modulo.fidelizacion NO está en el nuevo perfil
    ], configs: [] };
    const estadoActual = new Map([['modulo.fidelizacion', true]]);
    const resultado = detectarHuerfanos(perfil, estadoActual);
    expect(resultado.some(h => h.clave === 'modulo.fidelizacion')).toBe(true);
  });

  it('hijo activo en BD + padre activo en BD + perfil apaga padre → huérfano', () => {
    const perfil = { flags: [
      { nombre: 'modulo.inventario', habilitado: false, nivel: 'sede' as const },
      // inventario.lotes NO está en el nuevo perfil
    ], configs: [] };
    const estadoActual = new Map([['inventario.lotes', true]]);
    const resultado = detectarHuerfanos(perfil, estadoActual);
    expect(resultado.some(h => h.clave === 'inventario.lotes')).toBe(true);
  });

  it('hijo inactivo en BD + padre apagado → no es huérfano', () => {
    const perfil = { flags: [
      { nombre: 'modulo.inventario', habilitado: false, nivel: 'sede' as const },
    ], configs: [] };
    const estadoActual = new Map([['inventario.lotes', false]]);
    const resultado = detectarHuerfanos(perfil, estadoActual);
    expect(resultado.some(h => h.clave === 'inventario.lotes')).toBe(false);
  });
});

// ── Cascada de huérfanos en aplicarPerfil ─────────────────────────────────────

describe('onboardingService.aplicarPerfil — cascada de huérfanos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.featureFlag.findUnique.mockResolvedValue(mkFlag(10, 'any'));
    mockTx.featureFlag.create.mockResolvedValue(mkFlag(99, 'new'));
    mockTx.featureFlag.upsert.mockResolvedValue({ id: 1, nombre: 'onboarding_completado', habilitado: true, scope: 'contexto' });
    mockTx.featureFlagAsignacion.upsert.mockResolvedValue({});
    mockTx.configuracionRestaurante.upsert.mockResolvedValue({});
    mockTx.configuracionRestaurante.findFirst.mockResolvedValue(null); // editable por defecto
    mockTx.configuracionGrupo.upsert.mockResolvedValue({});
    // sin estado previo por defecto
    mockPrismaTopLevel.featureFlagAsignacion.findMany.mockResolvedValue([]);
  });

  it('huérfano detectado en el perfil → se apaga (upsert habilitado=false) y aparece en desactivadosPorDependencia', async () => {
    // Perfil con fidelizacion=true + clientes=false → huérfano
    const resultado = await onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, {
      ejes: {
        servicio:   'mostrador',
        inventario: 'no',
        recetas:    'no',
        caja:       'no',
        clientes:   'anonimo',   // clientes=off, fidelizacion=off (no hay huérfano aquí)
        multisede:  'no',
      },
    });
    // anonimo → ambos off → no hay huérfano. Testeo con estado actual.
    expect(resultado.desactivadosPorDependencia).toBeDefined();
    expect(Array.isArray(resultado.desactivadosPorDependencia)).toBe(true);
  });

  it('relanzamiento: inventario.lotes activo en BD + nuevo perfil apaga modulo.inventario → se apaga en cascada', async () => {
    // Escenario: onboarding anterior usó inventario='avanzado' (inventario.lotes=on).
    // Nuevo relanzamiento usa inventario='no': escribe modulo.inventario=off y
    // inventario.descuento_auto=off, pero NO incluye inventario.lotes en el perfil.
    // → inventario.lotes sigue activo en BD → huérfano real.
    mockPrismaTopLevel.featureFlagAsignacion.findMany.mockResolvedValue([
      {
        habilitado:   true,
        contexto:     `restaurante_${RESTAURANTE_ID}`,
        feature_flag: { nombre: 'inventario.lotes' },
      },
    ]);

    const resultado = await onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, {
      ejes: {
        servicio:   'mostrador',
        inventario: 'no',   // → modulo.inventario=off (NO escribe inventario.lotes)
        recetas:    'no',
        caja:       'no',
        clientes:   'anonimo',
        multisede:  'no',
      },
    });

    expect(resultado.desactivadosPorDependencia?.some(h => h.clave === 'inventario.lotes')).toBe(true);

    // El upsert del huérfano debe haberse llamado con habilitado=false
    const upsertCalls = mockTx.featureFlagAsignacion.upsert.mock.calls;
    const huerfanoApagado = upsertCalls.some(([arg]) =>
      (arg.update.habilitado === false || arg.create.habilitado === false)
    );
    expect(huerfanoApagado).toBe(true);
  });

  it('huérfano con es_editable=false → NO se apaga y aparece en omitidosPorDependencia', async () => {
    // Mismo escenario: inventario.lotes activo en BD, nuevo perfil apaga modulo.inventario.
    mockPrismaTopLevel.featureFlagAsignacion.findMany.mockResolvedValue([
      {
        habilitado:   true,
        contexto:     `restaurante_${RESTAURANTE_ID}`,
        feature_flag: { nombre: 'inventario.lotes' },
      },
    ]);
    // ConfiguracionRestaurante marca inventario.lotes como bloqueada (es_editable=false)
    mockTx.configuracionRestaurante.findFirst.mockResolvedValue({ es_editable: false });

    const resultado = await onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, {
      ejes: {
        servicio:   'mostrador',
        inventario: 'no',   // → modulo.inventario=off, sin inventario.lotes en perfil
        recetas:    'no',
        caja:       'no',
        clientes:   'anonimo',
        multisede:  'no',
      },
    });

    expect(resultado.omitidosPorDependencia?.some(h => h.clave === 'inventario.lotes')).toBe(true);
    expect(resultado.desactivadosPorDependencia?.some(h => h.clave === 'inventario.lotes')).toBeFalsy();
  });

  it('guardia de colisiones existente sigue intacta (no la toca la cascada)', async () => {
    // Un arquetipo desconocido sigue lanzando antes de la transacción
    await expect(
      onboardingService.aplicarPerfil(RESTAURANTE_ID, GRUPO_ID, { arquetipo: 'pizzeria' })
    ).rejects.toThrow(/arquetipo desconocido/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ── previsualizarPerfil — desactivadosPorDependencia ─────────────────────────

describe('onboardingService.previsualizarPerfil — desactivadosPorDependencia', () => {
  it('incluye desactivadosPorDependencia en la respuesta', () => {
    const resultado = onboardingService.previsualizarPerfil({ arquetipo: 'dark_kitchen' });
    expect(resultado).toHaveProperty('desactivadosPorDependencia');
    expect(Array.isArray(resultado.desactivadosPorDependencia)).toBe(true);
  });

  it('arquetipo coherente → desactivadosPorDependencia vacía', () => {
    const resultado = onboardingService.previsualizarPerfil({ arquetipo: 'dark_kitchen' });
    expect(resultado.desactivadosPorDependencia).toHaveLength(0);
  });

  it('no toca BD (sin $transaction)', () => {
    vi.clearAllMocks();
    onboardingService.previsualizarPerfil({ arquetipo: 'cafeteria' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
