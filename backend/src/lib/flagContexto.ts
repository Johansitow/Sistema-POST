/**
 * flagContexto.ts — única fuente de verdad para armar strings de contexto de feature flags.
 *
 * Convención:
 *   restaurante_<id>  — contexto de sede (asignación específica por restaurante)
 *   grupo_<id>        — contexto de grupo (default para todas las sedes del grupo)
 *
 * Nunca construyas estos strings a mano; usa siempre este helper.
 */

export function buildContexto(tipo: 'restaurante' | 'grupo', id: number): string {
  return `${tipo}_${id}`;
}

/**
 * resolveAsignacion — lógica de resolución de dos niveles para scope=contexto.
 *
 * Precedencia: restaurante → grupo → false (no hay asignación explícita).
 *
 * Exportada como función pura para poder testearla de forma aislada y reutilizarla
 * tanto en isEnabled como en getClientFlags.
 */
export function resolveAsignacion(
  asignaciones: { contexto: string; habilitado: boolean }[],
  restauranteCtx?: string,
  grupoCtx?: string,
): boolean {
  if (restauranteCtx) {
    const a = asignaciones.find(x => x.contexto === restauranteCtx);
    if (a !== undefined) return a.habilitado;
  }
  if (grupoCtx) {
    const a = asignaciones.find(x => x.contexto === grupoCtx);
    if (a !== undefined) return a.habilitado;
  }
  return false;
}
