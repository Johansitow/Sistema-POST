/**
 * restauranteStore — Zustand store para contexto de restaurante activo
 *
 * Dos formas de inicializar la lista de restaurantes accesibles:
 *   1. initFromToken(restaurantes) — llamado tras login/refresh con la lista del JWT
 *   2. cargar() — carga desde la API /restaurantes (para superadmins o re-sync)
 *
 * El restaurante activo se persiste en localStorage para mantener la selección
 * entre recargas de página.
 *
 * El hook useRestauranteActivo() retorna el id activo para enviarlo como
 * header X-Restaurante-Id en el interceptor de Axios.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import { useStore } from './useStore';

export interface RestauranteMini {
  id:        number;
  nombre:    string;
  es_default: boolean;
  logo_url?: string | null;
}

export interface GrupoMini {
  id:     number;
  nombre: string;
  logo_url?: string | null;
}

interface RestauranteState {
  restaurantes: RestauranteMini[];
  activo:       RestauranteMini | null;
  loaded:       boolean;
  loading:      boolean;

  /** Grupo activo seleccionado — solo relevante para super admin */
  grupoActivo:    GrupoMini | null;
  setGrupoActivo: (g: GrupoMini | null) => void;

  /**
   * Inicializa la lista desde el JWT (sin red).
   * Reconcilia el activo persisted: lo mantiene si sigue en la nueva lista,
   * si no, usa el default o el primero disponible.
   */
  initFromToken: (list: RestauranteMini[]) => void;

  /** Carga desde la API (para superadmins con acceso a todos) */
  cargar:     (idGrupo?: number) => Promise<void>;
  recargar:   (idGrupo?: number) => Promise<void>;

  /** Cambia el restaurante activo */
  setActivo:  (r: RestauranteMini) => void;

  /** Limpia el store al cerrar sesión */
  clear:      () => void;
}

export const useRestauranteStore = create<RestauranteState>()(
  persist(
    (set, get) => ({
      restaurantes: [],
      activo:       null,
      loaded:       false,
      loading:      false,
      grupoActivo:  null,

      setGrupoActivo: (g) => {
        set({ grupoActivo: g, loaded: false });
        // Forzar recarga de restaurantes del nuevo grupo
        get().recargar(g?.id);
      },

      initFromToken: (list) => {
        const prev = get().activo;
        const activo =
          (prev && list.find(r => r.id === prev.id)) ??
          list.find(r => r.es_default)              ??
          list[0]                                   ??
          null;
        set({ restaurantes: list, activo, loaded: true });
      },

      cargar: async (idGrupo?: number) => {
        if (get().loaded || get().loading) return;
        await get().recargar(idGrupo);
      },

      recargar: async (idGrupo?: number) => {
        set({ loading: true });
        try {
          const params = new URLSearchParams();
          if (idGrupo) params.set('id_grupo', String(idGrupo));
          const { data } = await api.get<{ success: boolean; data: (RestauranteMini & { activo: boolean })[] }>(
            `/restaurantes${params.size ? `?${params}` : ''}`
          );
          if (data.success) {
            const list    = data.data.filter(r => r.activo).map(({ id, nombre, es_default, logo_url }) => ({ id, nombre, es_default, logo_url }));
            const prev    = get().activo;
            const activo  =
              (prev && list.find(r => r.id === prev.id)) ??
              list.find(r => r.es_default)              ??
              list[0]                                   ??
              null;
            set({ restaurantes: list, activo, loaded: true });
          }
        } catch {
          set({ loaded: true });
        } finally {
          set({ loading: false });
        }
      },

      setActivo: (r) => {
        const anterior = get().activo;
        set({ activo: r });
        // Los datos por sede (productos, órdenes, inventario) no viven en el subárbol
        // que se re-monta con key={sede} — hay que limpiarlos explícitamente.
        if (anterior?.id !== r.id) useStore.getState().resetSedeData();
      },

      clear: () => set({ restaurantes: [], activo: null, loaded: false, grupoActivo: null }),
    }),
    {
      name:        'restaurante-activo',
      partialize:  (state) => ({ activo: state.activo, grupoActivo: state.grupoActivo }),
    },
  ),
);

/** Hook shortcut → id del restaurante activo (undefined si no hay ninguno) */
export const useRestauranteActivo = (): number | undefined =>
  useRestauranteStore((s) => s.activo?.id ?? undefined);
