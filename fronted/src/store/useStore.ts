/**
 * useStore.ts - Stores globales con Zustand
 *
 * Dos stores separados:
 * - useStore: estado de la app (productos, órdenes, inventario)
 * - useAuthStore: autenticación persistida en localStorage
 *
 * Por qué persist solo en useAuthStore:
 * - Los datos de auth deben sobrevivir al recargar la página
 * - Los datos de app se recargan desde el backend al montar cada página
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UsuarioAuth } from '../types';

// ─── Store General ────────────────────────────────────────────────────────────

interface Producto {
  id: number; sku: string; nombre: string;
  precio_unitario: number; stock_actual: number; estado: string;
}
interface Orden {
  id: number; numero_orden: string; total: number;
  estado: { nombre: string; codigo: string };
}
interface InventarioItem {
  id: number; nombre: string; stock_actual: number; stock_minimo: number;
}

interface AppState {
  productos: Producto[];
  setProductos: (p: Producto[]) => void;
  ordenes: Orden[];
  setOrdenes: (o: Orden[]) => void;
  ordenActual: Orden | null;
  setOrdenActual: (o: Orden | null) => void;
  inventario: InventarioItem[];
  setInventario: (i: InventarioItem[]) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
  /** Limpia los datos que pertenecen a una sede — llamado al cambiar de restaurante activo */
  resetSedeData: () => void;
}

export const useStore = create<AppState>((set) => ({
  productos:     [],    setProductos:   (productos)   => set({ productos }),
  ordenes:       [],    setOrdenes:     (ordenes)     => set({ ordenes }),
  ordenActual:   null,  setOrdenActual: (ordenActual) => set({ ordenActual }),
  inventario:    [],    setInventario:  (inventario)  => set({ inventario }),
  loading:       false, setLoading:     (loading)     => set({ loading }),
  resetSedeData: () => set({ productos: [], ordenes: [], ordenActual: null, inventario: [] }),
}));

// ─── Auth Store ───────────────────────────────────────────────────────────────

interface AuthState {
  /**
   * 'user' y 'usuario' contienen el mismo dato.
   * - 'user' es el nombre canónico interno
   * - 'usuario' es alias para que Layout.tsx pueda destructurar { usuario }
   * sin renombrar. Ambos se actualizan juntos en setAuth y logout.
   */
  user:            UsuarioAuth | null;
  usuario:         UsuarioAuth | null;
  accessToken:     string | null;
  refreshToken:    string | null;
  isAuthenticated: boolean;

  /** Llamado tras login exitoso — guarda user y tokens */
  setAuth:        (user: UsuarioAuth, accessToken: string, refreshToken: string) => void;

  /** Llamado por el interceptor de axios al renovar el accessToken */
  setAccessToken: (accessToken: string) => void;

  /** Limpia todo el estado — llamado al cerrar sesión */
  logout:         () => void;

  /**
   * Verifica si el usuario actual es super admin.
   * Usa optional chaining defensivo por si el store se rehidrata
   * con datos de una versión anterior del token (sin campo rol)
   */
  isSuperAdmin:   () => boolean;

  /**
   * Verifica si el usuario actual tiene un permiso puntual (código `recurso.accion`).
   * El superadmin siempre pasa (bypass), igual que en el backend
   * (ver requirePermission en permission.middleware.ts).
   */
  hasPermission:  (codigo: string) => boolean;

  /**
   * Verifica si el usuario es owner/admin de algún grupo de negocio
   * (claim grupos_admin del JWT). Junto con los permisos del módulo
   * administracion, habilita el panel /admin para dueños de restaurante.
   */
  esAdminGrupo:   () => boolean;

  /** ¿Tiene al menos uno de los permisos dados? (superadmin siempre pasa) */
  hasAnyPermission: (codigos: string[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:            null,
      usuario:         null,
      accessToken:     null,
      refreshToken:    null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) =>
        // user y usuario apuntan al mismo objeto intencionalmente
        set({ user, usuario: user, accessToken, refreshToken, isAuthenticated: true }),

      setAccessToken: (accessToken) => set({ accessToken }),

      logout: () =>
        set({ user: null, usuario: null, accessToken: null, refreshToken: null, isAuthenticated: false }),

      isSuperAdmin: () => {
        const user = get().user;
        // Leer es_super_admin del usuario directamente (no del rol).
        // El campo en el rol es @deprecated y no debe usarse para decisiones de acceso.
        return user?.es_super_admin ?? false;
      },

      hasPermission: (codigo) => {
        const user = get().user;
        if (user?.es_super_admin) return true;
        return user?.permisos?.includes(codigo) ?? false;
      },

      esAdminGrupo: () => {
        const user = get().user;
        return (user?.grupos_admin?.length ?? 0) > 0;
      },

      hasAnyPermission: (codigos) => {
        const { hasPermission } = get();
        return codigos.some(c => hasPermission(c));
      },
    }),
    {
      name: 'auth-storage', // clave en localStorage
      // Solo persistir lo necesario — excluir funciones y estado derivado
      partialize: (state) => ({
        user:            state.user,
        usuario:         state.usuario,
        accessToken:     state.accessToken,
        refreshToken:    state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);