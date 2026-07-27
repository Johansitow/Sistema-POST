/**
 * Tests del tourStore — navegación del modo tutorial.
 *
 * Cubre lo que hace único al motor: el SALTO de pasos cuyo elemento data-tour no
 * existe en el DOM (robustez multi-rol), la numeración por extremos, y el marcado
 * "ya visto" al finalizar/omitir (backend + flag en memoria).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../services/tutorial.service', () => ({
  tutorialService: {
    marcarCompletado: vi.fn().mockResolvedValue(true),
    reiniciar: vi.fn().mockResolvedValue(false),
  },
}));

import { useTourStore, indiceVisible, pasoVisible } from '../store/tourStore';
import { tutorialService } from '../services/tutorial.service';
import { useAuthStore } from '../store/useStore';
import type { PasoTour } from '../lib/tour/pasos';

const PASOS: PasoTour[] = [
  { id: 'bienvenida', titulo: 'Bienvenida', contenido: '…' },                       // centrado → visible
  { id: 'con-ancla',  target: '[data-tour="existe"]',    titulo: 'A', contenido: '…' }, // visible (elemento existe)
  { id: 'sin-ancla',  target: '[data-tour="no-existe"]', titulo: 'N', contenido: '…' }, // se SALTA
  { id: 'cierre',     titulo: 'Cierre', contenido: '…' },                            // centrado → visible
];

beforeEach(() => {
  document.body.innerHTML = '<div data-tour="existe"></div>';
  useTourStore.setState({ activo: false, indice: 0, pasos: PASOS });
  // Usuario mínimo con el flag en false para observar el marcado.
  useAuthStore.setState({
    user:    { tutorial_completado: false } as never,
    usuario: { tutorial_completado: false } as never,
  });
  vi.clearAllMocks();
});

describe('visibilidad de pasos', () => {
  it('las tarjetas centradas (sin target) siempre son visibles', () => {
    expect(pasoVisible(PASOS[0])).toBe(true);
    expect(pasoVisible(PASOS[3])).toBe(true);
  });

  it('un paso anclado es visible solo si su elemento existe en el DOM', () => {
    expect(pasoVisible(PASOS[1])).toBe(true);
    expect(pasoVisible(PASOS[2])).toBe(false);
  });

  it('indiceVisible salta los pasos cuyo elemento no existe', () => {
    // Desde el índice 2 (no-existe) avanzando → siguiente visible es el 3 (cierre)
    expect(indiceVisible(PASOS, 2, 1)).toBe(3);
    // Retrocediendo desde el 2 → el 1 (con-ancla)
    expect(indiceVisible(PASOS, 2, -1)).toBe(1);
    // Sin ninguno visible → -1
    expect(indiceVisible(PASOS, 4, 1)).toBe(-1);
  });
});

describe('navegación', () => {
  it('iniciar arranca activo en el primer paso visible', () => {
    useTourStore.getState().iniciar(PASOS);
    expect(useTourStore.getState().activo).toBe(true);
    expect(useTourStore.getState().indice).toBe(0);
  });

  it('siguiente salta el paso sin ancla', () => {
    useTourStore.getState().iniciar(PASOS);
    useTourStore.getState().siguiente();           // 0 → 1
    expect(useTourStore.getState().indice).toBe(1);
    useTourStore.getState().siguiente();           // 1 → (salta 2) → 3
    expect(useTourStore.getState().indice).toBe(3);
  });

  it('anterior también salta el paso sin ancla', () => {
    useTourStore.setState({ activo: true, indice: 3, pasos: PASOS });
    useTourStore.getState().anterior();            // 3 → (salta 2) → 1
    expect(useTourStore.getState().indice).toBe(1);
  });

  it('siguiente en el último paso visible finaliza el tour', () => {
    useTourStore.setState({ activo: true, indice: 3, pasos: PASOS });
    useTourStore.getState().siguiente();
    expect(useTourStore.getState().activo).toBe(false);
    expect(tutorialService.marcarCompletado).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().user?.tutorial_completado).toBe(true);
  });
});

describe('marcado "ya visto"', () => {
  it('omitir cierra el tour y lo marca como completado (backend + memoria)', () => {
    useTourStore.getState().iniciar(PASOS);
    useTourStore.getState().omitir();
    expect(useTourStore.getState().activo).toBe(false);
    expect(tutorialService.marcarCompletado).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().user?.tutorial_completado).toBe(true);
  });
});
