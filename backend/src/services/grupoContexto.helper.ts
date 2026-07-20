/**
 * grupoContexto.helper — contextos de tenant que un admin de grupo puede tocar.
 *
 * Convención de contextos (ver src/lib/flagContexto.ts):
 *   grupo_<id>        — el grupo administrado
 *   restaurante_<id>  — cada sede de ese grupo
 *
 * Compartido por feature-flags (asignaciones) y ui-config (personalización),
 * que usan la misma convención de contexto por tenant.
 */

import { restauranteRepository } from '../repositories/restaurante.repository';
import { ForbiddenError } from '../exceptions/HttpErrors';
import { buildContexto } from '../lib/flagContexto';

/** Set de contextos visibles/gestionables por el admin del grupo: su grupo y sus sedes. */
export const contextosDelGrupo = async (grupoId: number): Promise<Set<string>> => {
  const sedes = await restauranteRepository.findByGrupo(grupoId);
  return new Set([
    buildContexto('grupo', grupoId),
    ...sedes.map((s: { id: number }) => buildContexto('restaurante', s.id)),
  ]);
};

/**
 * Anti cross-tenant: si hay scope de grupo (no superadmin), el contexto debe
 * pertenecer al grupo administrado o a una de sus sedes.
 */
export async function assertContextoDelGrupo(contexto: string | undefined, grupoId?: number) {
  if (!grupoId) return; // superadmin — sin restricción
  if (!contexto || !(await contextosDelGrupo(grupoId)).has(contexto)) {
    throw new ForbiddenError('Solo puedes gestionar configuraciones de tu propio grupo y sus sedes');
  }
}
