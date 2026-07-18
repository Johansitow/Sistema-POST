/**
 * GrupoMenuService — subdivisiones editables del menú lateral (grupo + módulos)
 */

import { grupoMenuRepository } from '../repositories/grupoMenu.repository';
import { cacheGetOrSet, cacheDel } from '../config/redis';
import { BadRequestError } from '../exceptions/HttpErrors';

const KEY = 'menu:grupos';

export interface GuardarMenuItemInput {
  path:    string;
  orden:   number;
  visible: boolean;
}

export interface GuardarMenuGrupoInput {
  nombre: string;
  orden:  number;
  items:  GuardarMenuItemInput[];
}

export const grupoMenuService = {

  listar: () => cacheGetOrSet(KEY, 300, () => grupoMenuRepository.findAll()),

  async guardar(grupos: GuardarMenuGrupoInput[]) {
    if (!Array.isArray(grupos) || grupos.length === 0)
      throw new BadRequestError('Debe haber al menos un grupo');

    for (const g of grupos) {
      if (!g.nombre?.trim()) throw new BadRequestError('Todos los grupos deben tener nombre');
    }

    // Un módulo (path) no puede quedar asignado a más de un grupo a la vez
    const paths = grupos.flatMap(g => g.items.map(i => i.path));
    if (new Set(paths).size !== paths.length)
      throw new BadRequestError('Un módulo no puede estar en más de un grupo a la vez');

    const data = await grupoMenuRepository.reemplazarTodo(grupos);
    await cacheDel(KEY);
    return data;
  },
};
