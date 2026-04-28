/**
 * featureFlagStore — Zustand store para feature flags
 *
 * Los flags se cargan al iniciar la app y se actualizan periódicamente.
 * Uso:
 *   const isEnabled = useFeatureFlag('variantes_productos');
 *   const { flags, loadFlags } = useFeatureFlagStore();
 */

import { create } from 'zustand';
import api from '../services/api';

interface FeatureFlagState {
  flags:       Record<string, boolean>;
  loaded:      boolean;
  loading:     boolean;
  /** Carga inicial con guard: no ejecuta si ya está cargado o en curso */
  loadFlags:   () => Promise<void>;
  /** Fuerza recarga ignorando guards — usar al recibir FEATURE_FLAG_CHANGED */
  reloadFlags: () => Promise<void>;
}

/** Lógica de fetch compartida por loadFlags y reloadFlags */
const fetchFlags = async (set: (s: Partial<FeatureFlagState>) => void) => {
  set({ loading: true });
  try {
    const { data } = await api.get<{ success: boolean; data: Record<string, boolean> }>(
      '/feature-flags/client'
    );
    if (data.success) {
      set({ flags: data.data, loaded: true });
    }
  } catch {
    // Silencioso — flags quedan en false (conservador). loaded no se marca para permitir retry.
  } finally {
    set({ loading: false });
  }
};

export const useFeatureFlagStore = create<FeatureFlagState>((set, get) => ({
  flags:   {},
  loaded:  false,
  loading: false,

  loadFlags: async () => {
    // Guard: evita llamadas paralelas o redundantes
    if (get().loading || get().loaded) return;
    await fetchFlags(set);
  },

  reloadFlags: async () => {
    // Sin guard — fuerza refetch aunque ya estén cargados
    // Previene doble fetch si ya hay uno en curso
    if (get().loading) return;
    await fetchFlags(set);
  },
}));

/** Hook para verificar un flag individual */
export const useFeatureFlag = (nombre: string): boolean =>
  useFeatureFlagStore((state) => state.flags[nombre] ?? false);
