/**
 * Tests del scope multi-tenant para admins de grupo:
 *   - usuarioService: anti-IDOR (usuarios de otro grupo → NotFound), roles
 *     superadmin prohibidos, membresía automática al crear.
 *   - restauranteService: límite de sedes del plan, whitelist de campos,
 *     anti-IDOR de sedes (absorbido del antiguo módulo Mi Grupo).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/usuario.repository', () => ({
  usuarioRepository: {
    findAll:                vi.fn(),
    findById:               vi.fn(),
    findByEmail:            vi.fn(),
    findByUsuario:          vi.fn(),
    findRolById:            vi.fn(),
    findUsuarioActivoConRol: vi.fn(),
    findRoles:              vi.fn(),
    create:                 vi.fn(),
    update:                 vi.fn(),
    count:                  vi.fn(),
    countByEstado:          vi.fn(),
    perteneceAGrupo:        vi.fn(),
    findPermisosDirectos:   vi.fn(),
    findPermisosByIds:      vi.fn(),
    syncPermisosDirectos:   vi.fn(),
    findAdminsDeGrupo:      vi.fn(),
    findNomina:             vi.fn(),
    upsertNomina:           vi.fn(),
  },
}));

vi.mock('../../repositories/grupo-negocio.repository', () => ({
  grupoNegocioRepository: {
    findById:                 vi.fn(),
    upsertMiembro:            vi.fn(),
    countRestaurantesActivos: vi.fn(),
    findMiembro:              vi.fn(),
  },
}));

vi.mock('../../repositories/restaurante.repository', () => ({
  restauranteRepository: {
    findAll:               vi.fn(),
    findAllIncludeInactive: vi.fn(),
    findByGrupo:           vi.fn(),
    findById:              vi.fn(),
    findDefault:           vi.fn(),
    count:                 vi.fn(),
    create:                vi.fn(),
    update:                vi.fn(),
    toggleActivo:          vi.fn(),
    findUsuarios:          vi.fn(),
    asignarUsuario:        vi.fn(),
    removerUsuario:        vi.fn(),
  },
}));

vi.mock('../../repositories/configuracion-restaurante.repository', () => ({
  configuracionRestauranteRepository: {},
}));

vi.mock('../../config/redis', () => ({
  cacheGetOrSet: vi.fn((_k: string, _ttl: number, fn: () => unknown) => fn()),
  cacheDel:      vi.fn(),
}));

vi.mock('../../middlewares/tenantIsolation.middleware', () => ({
  invalidateTenantCache: vi.fn(),
}));

vi.mock('../../config/env', () => ({
  config: { superAdmin: { uuid: 'sa-uuid-fijo' } },
}));

vi.mock('bcrypt', () => ({
  default: { hash: vi.fn(() => 'hashed'), compare: vi.fn() },
}));

// ── Imports después de los mocks ──────────────────────────────────────────────

import { usuarioService } from '../usuario.service';
import { restauranteService } from '../restaurante.service';
import { usuarioRepository } from '../../repositories/usuario.repository';
import { grupoNegocioRepository } from '../../repositories/grupo-negocio.repository';
import { restauranteRepository } from '../../repositories/restaurante.repository';
import { NotFoundError, ForbiddenError } from '../../exceptions/HttpErrors';

const GRUPO = 7;

beforeEach(() => {
  vi.clearAllMocks();
});

// ── usuarioService — scope de grupo ──────────────────────────────────────────

describe('usuarioService — scope de admin de grupo', () => {
  it('obtenerPorId con scope: usuario de OTRO grupo → NotFound (anti-IDOR)', async () => {
    vi.mocked(usuarioRepository.perteneceAGrupo).mockResolvedValueOnce(null);
    await expect(usuarioService.obtenerPorId(99, GRUPO)).rejects.toThrow(NotFoundError);
    // Nunca llega a leer el usuario real
    expect(usuarioRepository.findById).not.toHaveBeenCalled();
  });

  it('obtenerPorId sin scope (superadmin): no valida pertenencia', async () => {
    vi.mocked(usuarioRepository.findById).mockResolvedValueOnce({ id: 99 } as any);
    await usuarioService.obtenerPorId(99);
    expect(usuarioRepository.perteneceAGrupo).not.toHaveBeenCalled();
  });

  it('asignarRol con scope: prohíbe asignar un rol superadmin', async () => {
    vi.mocked(usuarioRepository.perteneceAGrupo).mockResolvedValueOnce({ id: 6 } as any);
    vi.mocked(usuarioRepository.findById).mockResolvedValueOnce({
      id: 6, uuid: 'u-6', es_super_admin: false, rol: { id: 2, es_super_admin: false },
    } as any);
    vi.mocked(usuarioRepository.findRolById).mockResolvedValueOnce({
      id: 1, nombre: 'Administrador', es_super_admin: true,
    } as any);

    await expect(usuarioService.asignarRol(6, 1, 5, GRUPO)).rejects.toThrow(ForbiddenError);
  });

  it('crear con scope: vincula al nuevo usuario como operador del grupo', async () => {
    vi.mocked(usuarioRepository.findByEmail).mockResolvedValueOnce(null);
    vi.mocked(usuarioRepository.findByUsuario).mockResolvedValueOnce(null);
    vi.mocked(usuarioRepository.findRolById).mockResolvedValueOnce({
      id: 3, nombre: 'Cajero', es_super_admin: false,
    } as any);
    vi.mocked(usuarioRepository.create).mockResolvedValueOnce({ id: 42 } as any);

    await usuarioService.crear(
      { nombre_completo: 'Nuevo', email: 'n@x.com', usuario: 'nuevo', password: '12345678', id_rol: 3 },
      1,
      GRUPO,
    );
    expect(grupoNegocioRepository.upsertMiembro).toHaveBeenCalledWith(42, GRUPO, 'operador');
  });

  it('listarRoles con scope: oculta los roles superadmin', async () => {
    vi.mocked(usuarioRepository.findRoles).mockResolvedValueOnce([
      { id: 1, nombre: 'Administrador', es_super_admin: true },
      { id: 3, nombre: 'Cajero',        es_super_admin: false },
    ] as any);
    const roles = await usuarioService.listarRoles(GRUPO);
    expect(roles).toHaveLength(1);
    expect(roles[0].nombre).toBe('Cajero');
  });
});

// ── restauranteService — scope de grupo ──────────────────────────────────────

describe('restauranteService — scope de admin de grupo', () => {
  it('crear con scope: rechaza cuando el plan ya está al límite de sedes', async () => {
    vi.mocked(grupoNegocioRepository.findById).mockResolvedValueOnce({
      id: GRUPO, plan: 'starter', plan_max_restaurantes: 3,
    } as any);
    vi.mocked(grupoNegocioRepository.countRestaurantesActivos).mockResolvedValueOnce(3);

    await expect(restauranteService.crear({ nombre: 'Sede 4' } as any, GRUPO))
      .rejects.toThrow(ForbiddenError);
    expect(restauranteRepository.create).not.toHaveBeenCalled();
  });

  it('crear con scope: fuerza id_grupo del admin e ignora es_default/tipo_tenant/config', async () => {
    vi.mocked(grupoNegocioRepository.findById).mockResolvedValueOnce({
      id: GRUPO, plan: 'starter', plan_max_restaurantes: 3,
    } as any);
    vi.mocked(grupoNegocioRepository.countRestaurantesActivos).mockResolvedValueOnce(1);
    vi.mocked(restauranteRepository.count).mockResolvedValueOnce(5);
    vi.mocked(restauranteRepository.create).mockResolvedValueOnce({ id: 10 } as any);

    await restauranteService.crear(
      { nombre: 'Sede 2', id_grupo: 999, es_default: true, tipo_tenant: 'aislado', config: {} } as any,
      GRUPO,
    );
    const enviado = vi.mocked(restauranteRepository.create).mock.calls[0][0] as any;
    expect(enviado.id_grupo).toBe(GRUPO);
    expect(enviado.es_default).toBeUndefined();
    expect(enviado.tipo_tenant).toBeUndefined();
    expect(enviado.config).toBeUndefined();
  });

  it('actualizar con scope: sede de OTRO grupo → NotFound (anti-IDOR)', async () => {
    vi.mocked(restauranteRepository.findById).mockResolvedValueOnce({ id: 9, id_grupo: 999 } as any);
    await expect(restauranteService.actualizar(9, { nombre: 'Hackeada' } as any, GRUPO))
      .rejects.toThrow(NotFoundError);
    expect(restauranteRepository.update).not.toHaveBeenCalled();
  });

  it('actualizar con scope: aplica whitelist (descarta id_grupo/es_default/config)', async () => {
    vi.mocked(restauranteRepository.findById).mockResolvedValueOnce({ id: 9, id_grupo: GRUPO } as any);
    vi.mocked(restauranteRepository.update).mockResolvedValueOnce({ id: 9 } as any);

    await restauranteService.actualizar(
      9, { nombre: 'Nueva', id_grupo: 999, es_default: true, config: { x: 1 } } as any, GRUPO,
    );
    expect(restauranteRepository.update).toHaveBeenCalledWith(9, { nombre: 'Nueva' });
  });

  it('asignarUsuario con scope: rechaza usuarios que no pertenecen al grupo', async () => {
    vi.mocked(restauranteRepository.findById).mockResolvedValueOnce({ id: 1, id_grupo: GRUPO } as any);
    vi.mocked(usuarioRepository.findById).mockResolvedValueOnce({ id: 66 } as any);
    vi.mocked(usuarioRepository.perteneceAGrupo).mockResolvedValueOnce(null);

    await expect(restauranteService.asignarUsuario(1, 66, GRUPO)).rejects.toThrow(NotFoundError);
    expect(restauranteRepository.asignarUsuario).not.toHaveBeenCalled();
  });
});
