/**
 * Tests para miGrupoService — administración del grupo por owner/admin
 *
 * Foco de seguridad:
 * - Anti-IDOR: una sede de OTRO grupo produce NotFoundError (no Forbidden).
 * - Solo miembros del grupo pueden vincularse a sedes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../restaurante.service', () => ({
  restauranteService: {
    obtenerPorId:   vi.fn(),
    listarUsuarios: vi.fn(),
    asignarUsuario: vi.fn(),
    removerUsuario: vi.fn(),
    actualizar:     vi.fn(),
  },
}));

vi.mock('../grupo-negocio.service', () => ({
  grupoNegocioService: {
    obtenerPorId:   vi.fn(),
    listarMiembros: vi.fn(),
  },
}));

vi.mock('../../repositories/restaurante.repository', () => ({
  restauranteRepository: {
    findByGrupo: vi.fn(),
  },
}));

vi.mock('../../repositories/grupo-negocio.repository', () => ({
  grupoNegocioRepository: {
    findMiembro: vi.fn(),
  },
}));

import { miGrupoService } from '../mi-grupo.service';
import { restauranteService } from '../restaurante.service';
import { grupoNegocioService } from '../grupo-negocio.service';
import { restauranteRepository } from '../../repositories/restaurante.repository';
import { grupoNegocioRepository } from '../../repositories/grupo-negocio.repository';
import { NotFoundError, BadRequestError } from '../../exceptions/HttpErrors';

const sedeDelGrupo  = { id: 1, nombre: 'Vylonia Burguer', id_grupo: 2 };
const sedeDeOtro    = { id: 9, nombre: 'Ajena',           id_grupo: 5 };

beforeEach(() => vi.clearAllMocks());

describe('miGrupoService.resumen', () => {
  it('devuelve datos públicos del grupo y sus sedes (sin campos de conexión DB)', async () => {
    (grupoNegocioService.obtenerPorId as any).mockResolvedValue({
      id: 2, nombre: 'Vylonia', nit: null, logo_url: null,
      plan: 'starter', plan_max_restaurantes: 3, activo: true,
      db_schema: 'secreto', db_connection_url: 'postgres://secreto',
    });
    (restauranteRepository.findByGrupo as any).mockResolvedValue([sedeDelGrupo]);

    const result = await miGrupoService.resumen(2);

    expect(restauranteRepository.findByGrupo).toHaveBeenCalledWith(2);
    expect(result.restaurantes).toHaveLength(1);
    expect((result.grupo as any).db_connection_url).toBeUndefined();
    expect((result.grupo as any).db_schema).toBeUndefined();
  });
});

describe('miGrupoService — anti-IDOR de sedes', () => {
  it('usuariosDeSede lanza NotFoundError si la sede es de otro grupo', async () => {
    (restauranteService.obtenerPorId as any).mockResolvedValue(sedeDeOtro);

    await expect(miGrupoService.usuariosDeSede(2, 9)).rejects.toThrow(NotFoundError);
    expect(restauranteService.listarUsuarios).not.toHaveBeenCalled();
  });

  it('actualizarSede lanza NotFoundError si la sede es de otro grupo', async () => {
    (restauranteService.obtenerPorId as any).mockResolvedValue(sedeDeOtro);

    await expect(miGrupoService.actualizarSede(2, 9, { nombre: 'Hackeada' })).rejects.toThrow(NotFoundError);
    expect(restauranteService.actualizar).not.toHaveBeenCalled();
  });

  it('removerUsuario lanza NotFoundError si la sede es de otro grupo', async () => {
    (restauranteService.obtenerPorId as any).mockResolvedValue(sedeDeOtro);

    await expect(miGrupoService.removerUsuario(2, 9, 6)).rejects.toThrow(NotFoundError);
    expect(restauranteService.removerUsuario).not.toHaveBeenCalled();
  });
});

describe('miGrupoService.asignarUsuario', () => {
  it('vincula cuando el usuario es miembro del grupo', async () => {
    (restauranteService.obtenerPorId as any).mockResolvedValue(sedeDelGrupo);
    (grupoNegocioRepository.findMiembro as any).mockResolvedValue({ id: 1, rol_en_grupo: 'operador' });
    (restauranteService.asignarUsuario as any).mockResolvedValue({ id: 10 });

    await miGrupoService.asignarUsuario(2, 1, 6);

    expect(grupoNegocioRepository.findMiembro).toHaveBeenCalledWith(6, 2);
    expect(restauranteService.asignarUsuario).toHaveBeenCalledWith(1, 6);
  });

  it('rechaza con BadRequestError si el usuario NO es miembro del grupo', async () => {
    (restauranteService.obtenerPorId as any).mockResolvedValue(sedeDelGrupo);
    (grupoNegocioRepository.findMiembro as any).mockResolvedValue(null);

    await expect(miGrupoService.asignarUsuario(2, 1, 999)).rejects.toThrow(BadRequestError);
    expect(restauranteService.asignarUsuario).not.toHaveBeenCalled();
  });
});

describe('miGrupoService.actualizarSede', () => {
  it('actualiza una sede del propio grupo delegando en restauranteService', async () => {
    (restauranteService.obtenerPorId as any).mockResolvedValue(sedeDelGrupo);
    (restauranteService.actualizar as any).mockResolvedValue({ ...sedeDelGrupo, nombre: 'Nueva' });

    const result = await miGrupoService.actualizarSede(2, 1, { nombre: 'Nueva' });

    expect(restauranteService.actualizar).toHaveBeenCalledWith(1, { nombre: 'Nueva' });
    expect(result.nombre).toBe('Nueva');
  });
});
