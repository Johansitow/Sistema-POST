/**
 * Tests para requirePermission (RolPermiso ∪ UsuarioPermiso) y
 * requireAdminAccess (jerarquía superadmin → admin de grupo → resto).
 *
 * Se mockean:
 *   - prisma (config/database) para las consultas de permisos
 *   - grupoNegocioRepository para las membresías owner/admin
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../config/database', () => ({
  default: {
    rolPermiso:     { findFirst: vi.fn() },
    usuarioPermiso: { findFirst: vi.fn() },
  },
}));

vi.mock('../../repositories/grupo-negocio.repository', () => ({
  grupoNegocioRepository: {
    findMembresiasAdmin: vi.fn(),
  },
}));

// ── Imports después de los mocks ──────────────────────────────────────────────

import prisma from '../../config/database';
import { grupoNegocioRepository } from '../../repositories/grupo-negocio.repository';
import { requirePermission } from '../permission.middleware';
import { requireAdminAccess } from '../adminAccess.middleware';
import { ForbiddenError } from '../../exceptions/HttpErrors';

// ── Helpers ───────────────────────────────────────────────────────────────────

const buildReq = (over: Partial<Request> = {}): Request =>
  ({ user: { id: 5, rol: { id: 2 } }, esSuperAdmin: false, ...over } as unknown as Request);

const res = {} as Response;

/** Ejecuta el middleware y devuelve con qué se llamó a next() */
const run = async (mw: (req: Request, res: Response, next: NextFunction) => unknown, req: Request) =>
  new Promise<unknown>((resolve) => {
    void mw(req, res, ((err?: unknown) => resolve(err)) as NextFunction);
  });

beforeEach(() => {
  vi.clearAllMocks();
});

// ── requirePermission ─────────────────────────────────────────────────────────

describe('requirePermission — RolPermiso ∪ UsuarioPermiso', () => {
  it('deja pasar al superadmin sin consultar la DB', async () => {
    const err = await run(requirePermission('sedes.gestionar'), buildReq({ esSuperAdmin: true } as any));
    expect(err).toBeUndefined();
    expect(prisma.rolPermiso.findFirst).not.toHaveBeenCalled();
  });

  it('acepta un permiso que viene del rol', async () => {
    vi.mocked(prisma.rolPermiso.findFirst).mockResolvedValueOnce({ id: 1 } as any);
    vi.mocked(prisma.usuarioPermiso.findFirst).mockResolvedValueOnce(null);
    const err = await run(requirePermission('sedes.gestionar'), buildReq());
    expect(err).toBeUndefined();
  });

  it('acepta un permiso directo del usuario (UsuarioPermiso) aunque el rol no lo tenga', async () => {
    vi.mocked(prisma.rolPermiso.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.usuarioPermiso.findFirst).mockResolvedValueOnce({ id: 9 } as any);
    const err = await run(requirePermission('sedes.gestionar'), buildReq());
    expect(err).toBeUndefined();
    expect(prisma.usuarioPermiso.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id_usuario: 5 }),
    }));
  });

  it('rechaza cuando ni el rol ni el usuario tienen el permiso', async () => {
    vi.mocked(prisma.rolPermiso.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.usuarioPermiso.findFirst).mockResolvedValueOnce(null);
    const err = await run(requirePermission('sedes.gestionar'), buildReq());
    expect(err).toBeInstanceOf(ForbiddenError);
  });
});

// ── requireAdminAccess ────────────────────────────────────────────────────────

describe('requireAdminAccess — superadmin | admin de grupo con permiso', () => {
  it('superadmin pasa sin membresías ni permisos', async () => {
    const err = await run(requireAdminAccess('sedes.gestionar'), buildReq({ esSuperAdmin: true } as any));
    expect(err).toBeUndefined();
    expect(grupoNegocioRepository.findMembresiasAdmin).not.toHaveBeenCalled();
  });

  it('admin de grupo con el permiso pasa y recibe req.grupoAdminId', async () => {
    vi.mocked(grupoNegocioRepository.findMembresiasAdmin).mockResolvedValueOnce([
      { id_grupo: 7, rol_en_grupo: 'owner' } as any,
    ]);
    vi.mocked(prisma.rolPermiso.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.usuarioPermiso.findFirst).mockResolvedValueOnce({ id: 3 } as any);

    const req = buildReq();
    const err = await run(requireAdminAccess('sedes.gestionar'), req);
    expect(err).toBeUndefined();
    expect(req.grupoAdminId).toBe(7);
    expect(req.rolEnGrupo).toBe('owner');
  });

  it('admin de grupo SIN el permiso recibe 403', async () => {
    vi.mocked(grupoNegocioRepository.findMembresiasAdmin).mockResolvedValueOnce([
      { id_grupo: 7, rol_en_grupo: 'admin' } as any,
    ]);
    vi.mocked(prisma.rolPermiso.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.usuarioPermiso.findFirst).mockResolvedValueOnce(null);

    const err = await run(requireAdminAccess('sedes.gestionar'), buildReq());
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  it('usuario normal (sin membresías owner/admin) recibe 403 aunque tenga el permiso', async () => {
    vi.mocked(grupoNegocioRepository.findMembresiasAdmin).mockResolvedValueOnce([]);
    const err = await run(requireAdminAccess('sedes.gestionar'), buildReq());
    expect(err).toBeInstanceOf(ForbiddenError);
    // Ni siquiera se consulta el permiso: la membresía es la primera barrera
    expect(prisma.rolPermiso.findFirst).not.toHaveBeenCalled();
  });
});
