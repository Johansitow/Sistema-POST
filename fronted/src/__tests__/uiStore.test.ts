import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore, toast } from '../store/uiStore';

// Reinicia el store antes de cada test
beforeEach(() => {
  useUIStore.setState({
    sidebarCollapsed: false,
    toast: { open: false, message: '', severity: 'info', duration: 4000 },
  });
});

// ── sidebarCollapsed ──────────────────────────────────────────────────────────

describe('sidebarCollapsed', () => {
  it('inicia en false', () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('setSidebarCollapsed cambia el valor', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });
});

// ── showToast ─────────────────────────────────────────────────────────────────

describe('showToast', () => {
  it('abre el toast con defaults de severity e duration', () => {
    useUIStore.getState().showToast('Hola');
    const t = useUIStore.getState().toast;
    expect(t.open).toBe(true);
    expect(t.message).toBe('Hola');
    expect(t.severity).toBe('info');
    expect(t.duration).toBe(4000);
  });

  it('acepta severity y duration personalizados', () => {
    useUIStore.getState().showToast('Error grave', 'error', 8000);
    const t = useUIStore.getState().toast;
    expect(t.severity).toBe('error');
    expect(t.duration).toBe(8000);
  });
});

// ── closeToast ────────────────────────────────────────────────────────────────

describe('closeToast', () => {
  it('cierra el toast sin borrar el mensaje', () => {
    useUIStore.getState().showToast('Guardado', 'success');
    useUIStore.getState().closeToast();
    const t = useUIStore.getState().toast;
    expect(t.open).toBe(false);
    expect(t.message).toBe('Guardado'); // mensaje persiste (para animación de salida)
  });
});

// ── helper toast.* ───────────────────────────────────────────────────────────

describe('toast helpers (fuera de componentes)', () => {
  it('toast.success abre con severity=success', () => {
    toast.success('Operación exitosa');
    const t = useUIStore.getState().toast;
    expect(t.open).toBe(true);
    expect(t.severity).toBe('success');
    expect(t.message).toBe('Operación exitosa');
  });

  it('toast.error abre con severity=error', () => {
    toast.error('Error de red');
    expect(useUIStore.getState().toast.severity).toBe('error');
  });

  it('toast.warning abre con severity=warning', () => {
    toast.warning('Stock bajo');
    expect(useUIStore.getState().toast.severity).toBe('warning');
  });

  it('toast.info acepta duration personalizada', () => {
    toast.info('Cargando…', 2000);
    const t = useUIStore.getState().toast;
    expect(t.severity).toBe('info');
    expect(t.duration).toBe(2000);
  });
});
