/**
 * Tests para sandboxOnboardingService.
 *
 * Cubre:
 *   - crearSandbox: 1 sede si el perfil no es multisede; SEDES_MULTISEDE si lo es.
 *   - crearSandbox: el grupo nace con es_sandbox=true y se aplica el perfil por sede.
 *   - eliminarSandbox: rechaza grupos que no son sandbox (jamás borra datos reales).
 *   - eliminarSandbox: borra asignaciones por contexto + sedes + grupo.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { tx, prismaTopLevel, mockAplicarPerfil, mockCacheDel } = vi.hoisted(() => {
  const makeModel = () => ({
    create:     vi.fn(),
    delete:     vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    findMany:   vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  });

  const modelNames = [
    'grupoNegocio', 'configuracionGrupo', 'restaurante', 'usuarioRestaurante',
    'orden', 'pago', 'factura', 'clientePunto', 'movimiento', 'alerta',
    'cierreCaja', 'turnoCaja', 'listaCompras', 'lote', 'productoStock', 'receta',
    'productoVariante', 'proveedorProducto', 'producto', 'categoria', 'cliente',
    'proveedor', 'plantillaImpresion', 'documentoEmitido', 'periodoNomina',
    'auditoria', 'featureFlagAsignacion', 'usuario',
  ] as const;

  const tx = Object.fromEntries(modelNames.map(n => [n, makeModel()])) as Record<string, ReturnType<typeof makeModel>>;

  const prismaTopLevel = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    // eliminar/listar/obtener usan el cliente top-level para leer el grupo
    grupoNegocio: tx.grupoNegocio,
  };

  const mockAplicarPerfil = vi.fn().mockResolvedValue({});
  const mockCacheDel      = vi.fn().mockResolvedValue(undefined);
  return { tx, prismaTopLevel, mockAplicarPerfil, mockCacheDel };
});

vi.mock('../../config/database', () => ({ default: prismaTopLevel }));
vi.mock('../onboarding.service', () => ({
  onboardingService: { aplicarPerfil: (...a: unknown[]) => mockAplicarPerfil(...a) },
}));
vi.mock('../../config/redis', () => ({
  cacheDel:      (...a: unknown[]) => mockCacheDel(...a),
  cacheGetOrSet: (_k: string, _t: number, fn: () => unknown) => fn(),
}));

import { sandboxOnboardingService } from '../sandboxOnboarding.service';

beforeEach(() => {
  vi.clearAllMocks();
  prismaTopLevel.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
  tx.grupoNegocio.create.mockResolvedValue({ id: 7, nombre: 'Prueba', fecha_creacion: new Date() });
  tx.configuracionGrupo.create.mockResolvedValue({});
  tx.usuarioRestaurante.create.mockResolvedValue({});
  let sedeId = 100;
  tx.restaurante.create.mockImplementation(async ({ data }: any) => ({
    id: sedeId++, nombre: data.nombre, es_default: false,
  }));
  tx.restaurante.deleteMany.mockResolvedValue({ count: 0 });
  tx.orden.findMany.mockResolvedValue([]);
  tx.grupoNegocio.delete.mockResolvedValue({});
});

// ── crearSandbox ────────────────────────────────────────────────────────────────

describe('sandboxOnboardingService.crearSandbox', () => {
  it('crea 1 sede cuando el perfil NO es multisede', async () => {
    const res = await sandboxOnboardingService.crearSandbox(1, { arquetipo: 'dark_kitchen' });

    expect(tx.restaurante.create).toHaveBeenCalledTimes(1);
    expect(tx.usuarioRestaurante.create).toHaveBeenCalledTimes(1);
    expect(mockAplicarPerfil).toHaveBeenCalledTimes(1);
    expect(res.multisede).toBe(false);
    expect(res.sedes).toHaveLength(1);

    // El grupo nace marcado como sandbox
    expect(tx.grupoNegocio.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ es_sandbox: true }) }),
    );
  });

  it('crea 2 sedes (SEDES_MULTISEDE) cuando el perfil es multisede', async () => {
    const res = await sandboxOnboardingService.crearSandbox(1, { arquetipo: 'franquicia' });

    expect(tx.restaurante.create).toHaveBeenCalledTimes(2);
    expect(tx.usuarioRestaurante.create).toHaveBeenCalledTimes(2);
    expect(mockAplicarPerfil).toHaveBeenCalledTimes(2);
    expect(res.multisede).toBe(true);
    expect(res.sedes).toHaveLength(2);
  });

  it('aplica el perfil scopeado a la sede y el grupo creados', async () => {
    await sandboxOnboardingService.crearSandbox(9, { arquetipo: 'dark_kitchen' });
    // aplicarPerfil(sedeId, grupoId, input)
    expect(mockAplicarPerfil).toHaveBeenCalledWith(100, 7, { arquetipo: 'dark_kitchen' });
  });
});

// ── eliminarSandbox ─────────────────────────────────────────────────────────────

describe('sandboxOnboardingService.eliminarSandbox', () => {
  it('rechaza un grupo que NO es sandbox (no borra nada)', async () => {
    tx.grupoNegocio.findUnique.mockResolvedValue({ id: 3, es_sandbox: false, restaurantes: [] });

    await expect(sandboxOnboardingService.eliminarSandbox(3)).rejects.toThrow(/sandbox/i);
    expect(tx.grupoNegocio.delete).not.toHaveBeenCalled();
  });

  it('borra asignaciones por contexto, sedes y grupo cuando es sandbox', async () => {
    tx.grupoNegocio.findUnique.mockResolvedValue({ id: 7, es_sandbox: true, restaurantes: [{ id: 99 }] });

    await sandboxOnboardingService.eliminarSandbox(7);

    expect(tx.featureFlagAsignacion.deleteMany).toHaveBeenCalledWith({
      where: { contexto: { in: ['grupo_7', 'restaurante_99'] } },
    });
    expect(tx.restaurante.deleteMany).toHaveBeenCalledWith({ where: { id_grupo: 7 } });
    expect(tx.grupoNegocio.delete).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(mockCacheDel).toHaveBeenCalled();
  });
});
