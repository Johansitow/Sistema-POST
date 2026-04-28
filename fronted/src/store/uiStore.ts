import { create } from 'zustand';

// ── Toast / Notificaciones ───────────────────────────────────────────────────

export type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

export interface ToastState {
  open:     boolean;
  message:  string;
  severity: ToastSeverity;
  duration: number;
}

// ── Store ────────────────────────────────────────────────────────────────────

interface UIState {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;

  // Toast global
  toast: ToastState;
  showToast:  (message: string, severity?: ToastSeverity, duration?: number) => void;
  closeToast: () => void;
}

const DEFAULT_TOAST: ToastState = {
  open:     false,
  message:  '',
  severity: 'info',
  duration: 4000,
};

export const useUIStore = create<UIState>(set => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

  toast: DEFAULT_TOAST,

  showToast: (message, severity = 'info', duration = 4000) =>
    set({ toast: { open: true, message, severity, duration } }),

  closeToast: () =>
    set(s => ({ toast: { ...s.toast, open: false } })),
}));

/**
 * Acceso directo fuera de componentes React (ej. interceptors de Axios, services).
 *
 * Ejemplo:
 *   import { toast } from '../store/uiStore';
 *   toast.success('Guardado correctamente');
 *   toast.error('Error al conectar');
 */
export const toast = {
  success: (msg: string, duration?: number) =>
    useUIStore.getState().showToast(msg, 'success', duration),
  error: (msg: string, duration?: number) =>
    useUIStore.getState().showToast(msg, 'error', duration),
  warning: (msg: string, duration?: number) =>
    useUIStore.getState().showToast(msg, 'warning', duration),
  info: (msg: string, duration?: number) =>
    useUIStore.getState().showToast(msg, 'info', duration),
};
