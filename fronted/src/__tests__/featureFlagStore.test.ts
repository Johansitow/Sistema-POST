import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de axios (api) ANTES de importar el store
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

import { useFeatureFlagStore } from '../store/featureFlagStore';
import api from '../services/api';

const apiMock = api as unknown as { get: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  useFeatureFlagStore.setState({ flags: {}, loaded: false, loading: false });
});

// ── loadFlags ─────────────────────────────────────────────────────────────────

describe('loadFlags', () => {
  it('carga flags desde la API y marca loaded=true', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: { success: true, data: { variantes_productos: true, modo_oscuro: false } },
    });

    await useFeatureFlagStore.getState().loadFlags();
    const s = useFeatureFlagStore.getState();

    expect(s.loaded).toBe(true);
    expect(s.loading).toBe(false);
    expect(s.flags.variantes_productos).toBe(true);
    expect(s.flags.modo_oscuro).toBe(false);
  });

  it('no hace segunda llamada si ya está cargado (guard loaded)', async () => {
    useFeatureFlagStore.setState({ loaded: true });
    await useFeatureFlagStore.getState().loadFlags();
    expect(apiMock.get).not.toHaveBeenCalled();
  });

  it('no hace segunda llamada si ya está cargando (guard loading)', async () => {
    useFeatureFlagStore.setState({ loading: true });
    await useFeatureFlagStore.getState().loadFlags();
    expect(apiMock.get).not.toHaveBeenCalled();
  });

  it('maneja error silenciosamente y no marca loaded', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('Network error'));
    await useFeatureFlagStore.getState().loadFlags();
    const s = useFeatureFlagStore.getState();
    expect(s.loaded).toBe(false);
    expect(s.loading).toBe(false);
    expect(s.flags).toEqual({});
  });
});

// ── reloadFlags ───────────────────────────────────────────────────────────────

describe('reloadFlags', () => {
  it('fuerza recarga aunque ya esté cargado', async () => {
    useFeatureFlagStore.setState({ loaded: true, flags: { old_flag: true } });
    apiMock.get.mockResolvedValueOnce({
      data: { success: true, data: { new_flag: true } },
    });

    await useFeatureFlagStore.getState().reloadFlags();
    expect(apiMock.get).toHaveBeenCalledTimes(1);
    expect(useFeatureFlagStore.getState().flags.new_flag).toBe(true);
  });

  it('no llama a la API si loading=true', async () => {
    useFeatureFlagStore.setState({ loading: true });
    await useFeatureFlagStore.getState().reloadFlags();
    expect(apiMock.get).not.toHaveBeenCalled();
  });
});

// ── useFeatureFlag (selector) ─────────────────────────────────────────────────

describe('useFeatureFlag selector', () => {
  it('retorna true si el flag está activo', () => {
    useFeatureFlagStore.setState({ flags: { mi_flag: true } });
    // Llamada directa al selector (sin renderizar un componente)
    const result = useFeatureFlagStore.getState().flags['mi_flag'] ?? false;
    expect(result).toBe(true);
  });

  it('retorna false si el flag no existe', () => {
    useFeatureFlagStore.setState({ flags: {} });
    const result = useFeatureFlagStore.getState().flags['inexistente'] ?? false;
    expect(result).toBe(false);
  });
});
