/**
 * Tests para configuracionService.resolverParaRestaurante
 *
 * Cubre los tres casos de la precedencia sede → grupo → global:
 *   1. Solo grupo tiene valor → retorna grupo
 *   2. Solo sede tiene valor → retorna sede
 *   3. Ambos tienen valor   → gana sede
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/configuracion.repository', () => ({
  configuracionRepository: {
    findByClave: vi.fn(),
    findAll:     vi.fn(),
    update:      vi.fn(),
    updateMany:  vi.fn(),
    create:      vi.fn(),
    parseValor:  vi.fn((c: { valor: string }) => c.valor),
  },
}));

vi.mock('../../repositories/configuracion-restaurante.repository', () => ({
  configuracionRestauranteRepository: {
    findByClave: vi.fn(),
    findAll:     vi.fn(),
    upsert:      vi.fn(),
    upsertMany:  vi.fn(),
    delete:      vi.fn(),
  },
}));

vi.mock('../../repositories/configuracion-grupo.repository', () => ({
  configuracionGrupoRepository: {
    findByClave: vi.fn(),
    findAll:     vi.fn(),
    upsert:      vi.fn(),
    upsertMany:  vi.fn(),
    delete:      vi.fn(),
    parseValor:  vi.fn((c: { valor: string }) => c.valor),
  },
}));

vi.mock('../../config/database', () => ({ default: { permiso: { findMany: vi.fn() }, rol: { findUnique: vi.fn() }, rolPermiso: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() } } }));

// ── Imports ───────────────────────────────────────────────────────────────────

import { configuracionService } from '../configuracion.service';
import { configuracionRepository } from '../../repositories/configuracion.repository';
import { configuracionRestauranteRepository } from '../../repositories/configuracion-restaurante.repository';
import { configuracionGrupoRepository } from '../../repositories/configuracion-grupo.repository';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mkConfig = (valor: string) => ({ valor, tipo_dato: 'string' as const });

// ── resolverParaRestaurante ───────────────────────────────────────────────────

describe('configuracionService.resolverParaRestaurante', () => {
  const RESTAURANTE_ID = 1;
  const GRUPO_ID = 10;
  const CLAVE = 'general.moneda';

  beforeEach(() => vi.clearAllMocks());

  it('caso 1: solo grupo tiene valor → retorna valor de grupo con origen=grupo', async () => {
    (configuracionRestauranteRepository.findByClave as any).mockResolvedValue(null);
    (configuracionGrupoRepository.findByClave as any).mockResolvedValue(mkConfig('COP'));
    (configuracionRepository.findByClave as any).mockResolvedValue(null);

    const result = await configuracionService.resolverParaRestaurante(CLAVE, RESTAURANTE_ID, GRUPO_ID);

    expect(result).toEqual({ valor: 'COP', origen: 'grupo' });
    expect(configuracionRestauranteRepository.findByClave).toHaveBeenCalledWith(RESTAURANTE_ID, CLAVE);
    expect(configuracionGrupoRepository.findByClave).toHaveBeenCalledWith(GRUPO_ID, CLAVE);
    expect(configuracionRepository.findByClave).not.toHaveBeenCalled();
  });

  it('caso 2: solo sede tiene valor → retorna valor de sede con origen=sede', async () => {
    (configuracionRestauranteRepository.findByClave as any).mockResolvedValue(mkConfig('USD'));
    (configuracionGrupoRepository.findByClave as any).mockResolvedValue(null);

    const result = await configuracionService.resolverParaRestaurante(CLAVE, RESTAURANTE_ID, GRUPO_ID);

    expect(result).toEqual({ valor: 'USD', origen: 'sede' });
    expect(configuracionGrupoRepository.findByClave).not.toHaveBeenCalled();
    expect(configuracionRepository.findByClave).not.toHaveBeenCalled();
  });

  it('caso 3: sede y grupo tienen valor → gana sede (mayor precedencia)', async () => {
    (configuracionRestauranteRepository.findByClave as any).mockResolvedValue(mkConfig('EUR'));
    (configuracionGrupoRepository.findByClave as any).mockResolvedValue(mkConfig('COP'));

    const result = await configuracionService.resolverParaRestaurante(CLAVE, RESTAURANTE_ID, GRUPO_ID);

    expect(result).toEqual({ valor: 'EUR', origen: 'sede' });
    expect(configuracionGrupoRepository.findByClave).not.toHaveBeenCalled();
  });

  it('ninguna capa tiene el valor → retorna null', async () => {
    (configuracionRestauranteRepository.findByClave as any).mockResolvedValue(null);
    (configuracionGrupoRepository.findByClave as any).mockResolvedValue(null);
    (configuracionRepository.findByClave as any).mockResolvedValue(null);

    const result = await configuracionService.resolverParaRestaurante(CLAVE, RESTAURANTE_ID, GRUPO_ID);

    expect(result).toBeNull();
  });

  it('cae a global cuando ni sede ni grupo tienen valor', async () => {
    (configuracionRestauranteRepository.findByClave as any).mockResolvedValue(null);
    (configuracionGrupoRepository.findByClave as any).mockResolvedValue(null);
    (configuracionRepository.findByClave as any).mockResolvedValue(mkConfig('COP'));

    const result = await configuracionService.resolverParaRestaurante(CLAVE, RESTAURANTE_ID, GRUPO_ID);

    expect(result).toEqual({ valor: 'COP', origen: 'global' });
  });
});
