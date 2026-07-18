/**
 * brandingStore — Zustand store para la marca visible de la app (nombre/color/logo)
 *
 * Misma forma que featureFlagStore: se carga una vez al iniciar (login o layout),
 * con guard contra llamadas duplicadas. Usa el endpoint público
 * `GET /ui-config/public/branding` porque el login corre sin sesión.
 *
 * Uso:
 *   const { nombreSistema, colorPrimario, logoUrl, loadBranding } = useBrandingStore();
 */

import { create } from 'zustand';
import api from '../services/api';
import { DEFAULTS } from '../services/ui-config.schema';

interface BrandingState {
  nombreSistema: string;
  colorPrimario: string;
  logoUrl:       string;
  loaded:        boolean;
  loading:       boolean;
  /** Carga inicial con guard: no ejecuta si ya está cargado o en curso */
  loadBranding:   () => Promise<void>;
  /** Fuerza recarga ignorando guards — usar tras guardar cambios en Apariencia */
  reloadBranding: () => Promise<void>;
  /** Actualiza el estado directamente (sin red) — usado por Apariencia tras un guardado exitoso */
  setBranding: (b: Partial<Pick<BrandingState, 'nombreSistema' | 'colorPrimario' | 'logoUrl'>>) => void;
}

const fetchBranding = async (set: (s: Partial<BrandingState>) => void) => {
  set({ loading: true });
  try {
    const { data } = await api.get<{ success: boolean; data: Record<string, unknown> }>(
      '/ui-config/public/branding'
    );
    const valores = data.data ?? {};
    set({
      nombreSistema: typeof valores.nombre_sistema === 'string' && valores.nombre_sistema
        ? valores.nombre_sistema : DEFAULTS.apariencia.nombre_sistema,
      colorPrimario: typeof valores.color_primario === 'string' && valores.color_primario
        ? valores.color_primario : DEFAULTS.apariencia.color_primario,
      logoUrl: typeof valores.logo_url === 'string' ? valores.logo_url : DEFAULTS.apariencia.logo_url,
      loaded: true,
    });
  } catch {
    // Silencioso — se queda con los defaults (loaded no se marca, permite retry)
  } finally {
    set({ loading: false });
  }
};

export const useBrandingStore = create<BrandingState>((set, get) => ({
  nombreSistema: DEFAULTS.apariencia.nombre_sistema,
  colorPrimario: DEFAULTS.apariencia.color_primario,
  logoUrl:       DEFAULTS.apariencia.logo_url,
  loaded:  false,
  loading: false,

  loadBranding: async () => {
    if (get().loading || get().loaded) return;
    await fetchBranding(set);
  },

  reloadBranding: async () => {
    if (get().loading) return;
    await fetchBranding(set);
  },

  setBranding: (b) => set(b),
}));
