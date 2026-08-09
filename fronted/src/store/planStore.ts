/**
 * planStore — plan y uso del grupo del usuario (paralelo a featureFlagStore).
 * Alimenta la pantalla "Mi plan" y los avisos de tope de recursos.
 */

import { create } from 'zustand';
import { planesService, type PlanYUso, type ModuloPlan } from '../services/planes.service';

interface PlanState {
  planYUso: PlanYUso | null;
  loading: boolean;
  loaded: boolean;
  /** Carga el plan del grupo (idempotente si ya está cargando). */
  loadMiPlan: () => Promise<void>;
  /** Fuerza recarga (p. ej. tras un cambio de plan). */
  reloadMiPlan: () => Promise<void>;
  reset: () => void;
}

async function fetchInto(set: (p: Partial<PlanState>) => void) {
  set({ loading: true });
  try {
    const data = await planesService.miPlan();
    set({ planYUso: data, loaded: true });
  } catch {
    // Falla suave: sin plan resuelto (usuario sin grupo activo, etc.)
    set({ planYUso: null, loaded: true });
  } finally {
    set({ loading: false });
  }
}

export const usePlanStore = create<PlanState>((set, get) => ({
  planYUso: null,
  loading: false,
  loaded: false,
  loadMiPlan: async () => {
    if (get().loading || get().loaded) return;
    await fetchInto(set);
  },
  reloadMiPlan: async () => { await fetchInto(set); },
  reset: () => set({ planYUso: null, loaded: false }),
}));

/**
 * ¿El módulo está habilitado por el plan del grupo?
 * - Sin plan cargado aún → true (evita parpadeo/ocultar de más mientras carga).
 * - Grupo grandfathered (gating_activo=false) → true (ve todo).
 * - Si no, depende de si el plan lo incluye.
 */
export function moduloHabilitado(planYUso: PlanYUso | null, modulo: ModuloPlan): boolean {
  if (!planYUso || !planYUso.gating_activo) return true;
  return planYUso.modulos_incluidos.includes(modulo);
}

/** Selector-hook para gatear UI por módulo del plan. */
export const useModuloHabilitado = (modulo: ModuloPlan): boolean =>
  usePlanStore(s => moduloHabilitado(s.planYUso, modulo));
