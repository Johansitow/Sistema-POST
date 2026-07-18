/**
 * menuStore — Zustand store para las subdivisiones del menú lateral
 *
 * Mismo patrón que featureFlagStore/brandingStore: se carga una vez al iniciar
 * el Layout, con guard contra llamadas duplicadas. Si el fetch falla o la tabla
 * está vacía, `grupos` queda [] y quien lo consuma (Layout.tsx) cae a
 * DEFAULT_GROUPS de menuCatalog.tsx — el sidebar nunca se queda en blanco.
 */

import { create } from 'zustand';
import { menuService, type MenuGrupoDTO } from '../services/menu.service';

interface MenuState {
  grupos:  MenuGrupoDTO[];
  loaded:  boolean;
  loading: boolean;
  /** Carga inicial con guard: no ejecuta si ya está cargado o en curso */
  loadMenu:   () => Promise<void>;
  /** Fuerza recarga ignorando guards — usar tras guardar cambios en Apariencia */
  reloadMenu: () => Promise<void>;
}

const fetchMenu = async (set: (s: Partial<MenuState>) => void) => {
  set({ loading: true });
  try {
    const grupos = await menuService.listar();
    set({ grupos, loaded: true });
  } catch {
    // Silencioso — Layout.tsx cae a DEFAULT_GROUPS. loaded no se marca, permite retry.
  } finally {
    set({ loading: false });
  }
};

export const useMenuStore = create<MenuState>((set, get) => ({
  grupos:  [],
  loaded:  false,
  loading: false,

  loadMenu: async () => {
    if (get().loading || get().loaded) return;
    await fetchMenu(set);
  },

  reloadMenu: async () => {
    if (get().loading) return;
    await fetchMenu(set);
  },
}));
