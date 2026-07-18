/**
 * Tests para grupoMenuService — subdivisiones editables del menú lateral
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/redis', () => ({
  cacheGetOrSet: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()),
  cacheDel:      vi.fn(),
}));

vi.mock('../../repositories/grupoMenu.repository', () => ({
  grupoMenuRepository: {
    findAll:        vi.fn(),
    reemplazarTodo: vi.fn(),
  },
}));

import { grupoMenuService } from '../grupoMenu.service';
import { grupoMenuRepository } from '../../repositories/grupoMenu.repository';
import { cacheDel } from '../../config/redis';

const mkGrupo = (nombre: string, items: string[]) => ({
  nombre,
  orden: 0,
  items: items.map((path, i) => ({ path, orden: i, visible: true })),
});

describe('grupoMenuService.listar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delega en el repositorio', async () => {
    const data = [{ id: 1, nombre: 'Principal', orden: 0, items: [] }];
    (grupoMenuRepository.findAll as any).mockResolvedValue(data);

    const result = await grupoMenuService.listar();

    expect(result).toBe(data);
    expect(grupoMenuRepository.findAll).toHaveBeenCalled();
  });
});

describe('grupoMenuService.guardar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reemplaza la estructura e invalida el caché', async () => {
    const grupos = [mkGrupo('Principal', ['/dashboard'])];
    const guardado = [{ id: 1, ...grupos[0] }];
    (grupoMenuRepository.reemplazarTodo as any).mockResolvedValue(guardado);

    const result = await grupoMenuService.guardar(grupos);

    expect(grupoMenuRepository.reemplazarTodo).toHaveBeenCalledWith(grupos);
    expect(cacheDel).toHaveBeenCalledWith('menu:grupos');
    expect(result).toBe(guardado);
  });

  it('rechaza un payload sin grupos', async () => {
    await expect(grupoMenuService.guardar([])).rejects.toThrow('Debe haber al menos un grupo');
    expect(grupoMenuRepository.reemplazarTodo).not.toHaveBeenCalled();
  });

  it('rechaza un grupo sin nombre', async () => {
    const grupos = [mkGrupo('   ', ['/dashboard'])];
    await expect(grupoMenuService.guardar(grupos)).rejects.toThrow('Todos los grupos deben tener nombre');
  });

  it('rechaza un módulo asignado a más de un grupo', async () => {
    const grupos = [mkGrupo('Ventas', ['/ordenes']), mkGrupo('Inventario', ['/ordenes'])];
    await expect(grupoMenuService.guardar(grupos)).rejects.toThrow(
      'Un módulo no puede estar en más de un grupo a la vez'
    );
  });
});
