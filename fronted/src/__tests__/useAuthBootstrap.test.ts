/**
 * Tests de useAuthBootstrap — validación de la sesión al arrancar.
 *
 * Cubre:
 *   - Sin token → ready inmediato, sin llamar al backend.
 *   - Token válido → ready, la sesión se mantiene.
 *   - Token inválido (401) → cierra sesión y queda ready.
 *   - Error transitorio (red/5xx) → NO cierra sesión y queda ready.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const getProfile = vi.fn();
vi.mock('../services/auth.service', () => ({
  authService: { getProfile: () => getProfile() },
}));

import { useAuthBootstrap } from '../hooks/useAuthBootstrap';
import { useAuthStore } from '../store/useStore';

const conSesion = () =>
  useAuthStore.setState({
    user: { id: 1 } as never,
    usuario: { id: 1 } as never,
    accessToken: 'tok',
    refreshToken: 'ref',
    isAuthenticated: true,
  });

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    user: null, usuario: null, accessToken: null, refreshToken: null, isAuthenticated: false,
  });
});

describe('useAuthBootstrap', () => {
  it('sin token → ready sin llamar al backend', async () => {
    const { result } = renderHook(() => useAuthBootstrap());
    await waitFor(() => expect(result.current).toBe(true));
    expect(getProfile).not.toHaveBeenCalled();
  });

  it('token válido → ready y mantiene la sesión', async () => {
    conSesion();
    getProfile.mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useAuthBootstrap());
    await waitFor(() => expect(result.current).toBe(true));
    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('token inválido (401) → cierra sesión', async () => {
    conSesion();
    getProfile.mockRejectedValue({ response: { status: 401 } });
    const { result } = renderHook(() => useAuthBootstrap());
    await waitFor(() => expect(result.current).toBe(true));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('error transitorio (sin response) → NO cierra sesión', async () => {
    conSesion();
    getProfile.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useAuthBootstrap());
    await waitFor(() => expect(result.current).toBe(true));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
