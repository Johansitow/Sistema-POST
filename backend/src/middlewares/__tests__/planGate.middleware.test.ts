/**
 * Tests de requireModulo — gating de módulos por plan.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/plan.service', () => ({
  planService: { getPlanDeGrupo: vi.fn() },
}));

import { requireModulo } from '../planGate.middleware';
import { planService } from '../../services/plan.service';

const getPlanDeGrupo = planService.getPlanDeGrupo as any;

function mkRes() {
  return {
    statusCode: 0,
    body: null as any,
    status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this.body = b; return this; },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('requireModulo', () => {
  it('superadmin siempre pasa (sin consultar el plan)', async () => {
    const next = vi.fn();
    await requireModulo('recetas')({ esSuperAdmin: true } as any, mkRes() as any, next);
    expect(next).toHaveBeenCalledOnce();
    expect(getPlanDeGrupo).not.toHaveBeenCalled();
  });

  it('sin grupo resuelto → pasa (no aplica gating aquí)', async () => {
    const next = vi.fn();
    await requireModulo('recetas')({ esSuperAdmin: false } as any, mkRes() as any, next);
    expect(next).toHaveBeenCalledOnce();
    expect(getPlanDeGrupo).not.toHaveBeenCalled();
  });

  it('grupo grandfathered (gatingActivo=false) → pasa aunque el plan no incluya el módulo', async () => {
    getPlanDeGrupo.mockResolvedValue({ plan: 'starter', gatingActivo: false });
    const next = vi.fn();
    await requireModulo('recetas')({ esSuperAdmin: false, grupoId: 7 } as any, mkRes() as any, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('plan incluye el módulo → pasa', async () => {
    getPlanDeGrupo.mockResolvedValue({ plan: 'professional', gatingActivo: true });
    const next = vi.fn();
    await requireModulo('recetas')({ esSuperAdmin: false, grupoId: 7 } as any, mkRes() as any, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('plan NO incluye el módulo → 403 MODULE_LOCKED con plan_requerido', async () => {
    getPlanDeGrupo.mockResolvedValue({ plan: 'starter', gatingActivo: true });
    const next = vi.fn();
    const res = mkRes();
    await requireModulo('nomina')({ esSuperAdmin: false, grupoId: 7 } as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('MODULE_LOCKED');
    expect(res.body.modulo).toBe('nomina');
    expect(res.body.plan_requerido).toBe('enterprise');
  });

  it('resuelve el grupo desde grupoAdminId si no hay grupoId', async () => {
    getPlanDeGrupo.mockResolvedValue({ plan: 'professional', gatingActivo: true });
    const next = vi.fn();
    await requireModulo('clientes')({ esSuperAdmin: false, grupoAdminId: 9 } as any, mkRes() as any, next);
    expect(getPlanDeGrupo).toHaveBeenCalledWith(9);
    expect(next).toHaveBeenCalledOnce();
  });
});
