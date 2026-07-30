/**
 * tourStore — estado de EJECUCIÓN del modo tutorial (product tour).
 *
 * No persiste: la fuente de verdad de "ya lo vio" es el backend
 * (Usuario.tutorial_completado, que llega en el token). Este store solo maneja
 * el recorrido en curso: si está activo y en qué paso va.
 *
 * Robustez multi-rol: la navegación SALTA los pasos cuyo elemento `data-tour` no
 * existe en el DOM (módulo oculto por rol/feature flag, o viewport móvil). Las
 * tarjetas centradas (sin `target`) siempre son visibles.
 */

import { create } from 'zustand';
import { PASOS_TOUR, type PasoTour } from '../lib/tour/pasos';
import { tutorialService } from '../services/tutorial.service';
import { useAuthStore } from './useStore';

/** ¿El paso puede mostrarse ahora mismo? Las tarjetas centradas siempre; las
 *  ancladas solo si su elemento existe en el DOM. */
export function pasoVisible(paso: PasoTour): boolean {
  if (!paso.target) return true;
  return typeof document !== 'undefined' && document.querySelector(paso.target) !== null;
}

/**
 * Primer índice visible desde `desde` (inclusive) avanzando en dirección `dir`.
 * Devuelve -1 si no queda ninguno. Exportada para tests.
 */
export function indiceVisible(pasos: PasoTour[], desde: number, dir: 1 | -1): number {
  for (let i = desde; i >= 0 && i < pasos.length; i += dir) {
    if (pasoVisible(pasos[i])) return i;
  }
  return -1;
}

interface TourState {
  activo: boolean;
  indice: number;
  pasos: PasoTour[];

  /** Arranca el recorrido en el primer paso visible. No hace nada si no hay ninguno. */
  iniciar: (pasos?: PasoTour[]) => void;
  /** Avanza al siguiente paso visible; si no hay más, finaliza. */
  siguiente: () => void;
  /** Retrocede al paso visible anterior; en el primero no hace nada. */
  anterior: () => void;
  /** Sale del tour marcándolo como visto (el usuario decidió omitirlo). */
  omitir: () => void;
  /** Cierra el tour marcándolo como completado. */
  finalizar: () => void;
}

/** Marca el tutorial como visto: primero en memoria (evita re-disparo inmediato),
 *  luego en backend (fuente de verdad, tolerante a fallo de red). */
function marcarVisto(): void {
  useAuthStore.getState().setTutorialCompletado(true);
  void tutorialService.marcarCompletado().catch(() => {
    /* El flag local ya evita el re-disparo esta sesión; el backend se reintenta
       en el próximo cierre/omisión. No interrumpimos al usuario por esto. */
  });
}

export const useTourStore = create<TourState>((set, get) => ({
  activo: false,
  indice: 0,
  pasos: PASOS_TOUR,

  iniciar: (pasos = PASOS_TOUR) => {
    const inicio = indiceVisible(pasos, 0, 1);
    if (inicio === -1) return;
    set({ activo: true, pasos, indice: inicio });
  },

  siguiente: () => {
    const { pasos, indice } = get();
    const sig = indiceVisible(pasos, indice + 1, 1);
    if (sig === -1) {
      get().finalizar();
      return;
    }
    set({ indice: sig });
  },

  anterior: () => {
    const { pasos, indice } = get();
    const prev = indiceVisible(pasos, indice - 1, -1);
    if (prev !== -1) set({ indice: prev });
  },

  omitir: () => {
    set({ activo: false });
    marcarVisto();
  },

  finalizar: () => {
    set({ activo: false });
    marcarVisto();
  },
}));
