/**
 * Tests de planService — getPlanYUso y aplicarPlan.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/grupo-negocio.repository', () => ({
  grupoNegocioRepository: {
    findById:                 vi.fn(),
    update:                   vi.fn(),
    countRestaurantesActivos: vi.fn(),
  },
}));
vi.mock('../../repositories/usuario.repository', () => ({
  usuarioRepository: { count: vi.fn() },
}));
vi.mock('../../repositories/producto.repository', () => ({
  productoRepository: { countByGrupo: vi.fn() },
}));
vi.mock('../../config/redis', () => ({
  cacheDel:      vi.fn(),
  cacheGetOrSet: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()),
  CACHE_TTL:     { SHORT: 60, MID: 300, LONG: 3600 },
}));

import { planService } from '../plan.service';
import { grupoNegocioRepository } from '../../repositories/grupo-negocio.repository';
import { usuarioRepository } from '../../repositories/usuario.repository';
import { productoRepository } from '../../repositories/producto.repository';
import { cacheDel, cacheGetOrSet } from '../../config/redis';
import { NotFoundError } from '../../exceptions/HttpErrors';

describe('planService.getPlanYUso', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve plan, límites del catálogo y uso real del grupo', async () => {
    (grupoNegocioRepository.findById as any).mockResolvedValue({ id: 5, plan: 'starter', gating_activo: true });
    (grupoNegocioRepository.countRestaurantesActivos as any).mockResolvedValue(1);
    (usuarioRepository.count as any).mockResolvedValue(2);
    (productoRepository.countByGrupo as any).mockResolvedValue(40);

    const res = await planService.getPlanYUso(5);

    expect(res.plan).toBe('starter');
    expect(res.nombre).toBe('Gratis');
    expect(res.limites.max_productos).toBe(60);
    expect(res.uso).toEqual({ sedes: 1, usuarios: 2, productos: 40 });
    expect(res.modulos_incluidos).toEqual([]); // starter: solo núcleo
    expect(res.gating_activo).toBe(true);
  });

  it('lanza NotFoundError si el grupo no existe', async () => {
    (grupoNegocioRepository.findById as any).mockResolvedValue(null);
    await expect(planService.getPlanYUso(999)).rejects.toThrow(NotFoundError);
  });
});

describe('planService.aplicarPlan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fija el plan y sincroniza plan_max_restaurantes con el catálogo', async () => {
    (grupoNegocioRepository.update as any).mockResolvedValue({});

    const def = await planService.aplicarPlan(5, 'enterprise');

    expect(def.codigo).toBe('enterprise');
    const [id, data] = (grupoNegocioRepository.update as any).mock.calls[0];
    expect(id).toBe(5);
    expect(data).toEqual({ plan: 'enterprise', plan_max_restaurantes: 3 });
  });

  it('invalida la caché del plan del grupo (para el gating)', async () => {
    (grupoNegocioRepository.update as any).mockResolvedValue({});

    await planService.aplicarPlan(5, 'professional');

    expect(cacheDel).toHaveBeenCalledWith('grupo:plan:5');
  });
});

describe('planService.getPlanDeGrupo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve plan + gatingActivo del grupo', async () => {
    (grupoNegocioRepository.findById as any).mockResolvedValue({ id: 7, plan: 'professional', gating_activo: true });

    const res = await planService.getPlanDeGrupo(7);

    expect(res).toEqual({ plan: 'professional', gatingActivo: true });
    expect(cacheGetOrSet).toHaveBeenCalledWith('grupo:plan:7', expect.any(Number), expect.any(Function));
  });

  it('lanza NotFoundError si el grupo no existe', async () => {
    (grupoNegocioRepository.findById as any).mockResolvedValue(null);
    await expect(planService.getPlanDeGrupo(999)).rejects.toThrow(NotFoundError);
  });
});
