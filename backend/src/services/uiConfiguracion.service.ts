/**
 * UiConfiguracionService — Configuraciones de UI dinámicas
 */

import { uiConfiguracionRepository } from '../repositories/uiConfiguracion.repository';
import { cacheGetOrSet, cacheDel }    from '../config/redis';

const KEY_ALL       = 'ui:all';
const keyScope      = (scope: string)                          => `ui:scope:${scope}`;
const keyConfig     = (scope: string, clave: string, ctx?: string) =>
  `ui:${scope}:${clave}:${ctx || 'global'}`;

export const uiConfiguracionService = {

  /** Retorna TODAS las configs (cacheado para evitar N queries en peticiones admin) */
  getAll: () =>
    cacheGetOrSet(KEY_ALL, 120, () => uiConfiguracionRepository.findAll()),

  /** Retorna todas las configs de un scope (cacheado por scope) */
  getByScope: (scope: string) =>
    cacheGetOrSet(keyScope(scope), 300, () =>
      uiConfiguracionRepository.findByScope(scope)
    ),

  /** Retorna una config específica por scope+clave+contexto */
  getConfig: async (scope: string, clave: string, contexto?: string) =>
    cacheGetOrSet(keyConfig(scope, clave, contexto), 300, () =>
      uiConfiguracionRepository.findByScopeClave(scope, clave, contexto)
    ),

  /**
   * Crea o actualiza una config e invalida:
   *   - La key individual (scope+clave+contexto)
   *   - El agregado del scope
   *   - El listado global
   */
  setConfig: async (scope: string, clave: string, valor: unknown, contexto?: string) => {
    const result = await uiConfiguracionRepository.upsert({ scope, clave, valor, contexto });
    await cacheDel(
      keyConfig(scope, clave, contexto),
      keyScope(scope),
      KEY_ALL,
    );
    return result;
  },

  /** Elimina una config por ID e invalida todos los caches afectados */
  deleteConfig: async (id: number) => {
    try {
      // Prisma.delete devuelve el registro eliminado — lo usamos para saber qué cachés invalidar
      // sin necesidad de hacer una query extra de lectura
      const deleted = await uiConfiguracionRepository.deleteById(id);
      await cacheDel(
        keyConfig(deleted.scope, deleted.clave, deleted.contexto || undefined),
        keyScope(deleted.scope),
        KEY_ALL,
      );
    } catch (e: any) {
      if (e.code === 'P2025') return; // Registro no encontrado — ya fue eliminado
      throw e;
    }
  },
};
