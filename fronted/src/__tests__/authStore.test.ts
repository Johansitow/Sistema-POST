import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../store/useStore';
import type { UsuarioAuth } from '../types';

const mockUser: UsuarioAuth = {
  id:              1,
  uuid:            'uuid-1234',
  nombre_completo: 'Admin Test',
  usuario:         'admin',
  email:           'admin@test.com',
  // Fuente de verdad: campo del usuario, NO del rol
  es_super_admin:  true,
  rol: {
    id:             1,
    nombre:         'Super Admin',
    es_super_admin: true, // solo display
  },
  restaurantes: [{ id: 1, nombre: 'Sede Principal', es_default: true, id_grupo: 1 }],
};

beforeEach(() => {
  useAuthStore.setState({
    user:            null,
    usuario:         null,
    accessToken:     null,
    refreshToken:    null,
    isAuthenticated: false,
  });
});

// ── setAuth ───────────────────────────────────────────────────────────────────

describe('setAuth', () => {
  it('guarda user, tokens y marca isAuthenticated=true', () => {
    useAuthStore.getState().setAuth(mockUser, 'access-abc', 'refresh-xyz');
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.user).toBe(mockUser);
    expect(s.usuario).toBe(mockUser); // alias
    expect(s.accessToken).toBe('access-abc');
    expect(s.refreshToken).toBe('refresh-xyz');
  });
});

// ── setAccessToken ────────────────────────────────────────────────────────────

describe('setAccessToken', () => {
  it('actualiza solo el accessToken', () => {
    useAuthStore.getState().setAuth(mockUser, 'old-token', 'refresh');
    useAuthStore.getState().setAccessToken('new-token');
    expect(useAuthStore.getState().accessToken).toBe('new-token');
    expect(useAuthStore.getState().refreshToken).toBe('refresh'); // sin cambios
  });
});

// ── logout ────────────────────────────────────────────────────────────────────

describe('logout', () => {
  it('limpia todo el estado de auth', () => {
    useAuthStore.getState().setAuth(mockUser, 'tok', 'ref');
    useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.usuario).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.isAuthenticated).toBe(false);
  });
});

// ── isSuperAdmin ──────────────────────────────────────────────────────────────

describe('isSuperAdmin', () => {
  it('retorna true cuando es_super_admin=true', () => {
    useAuthStore.getState().setAuth(mockUser, 'tok', 'ref');
    expect(useAuthStore.getState().isSuperAdmin()).toBe(true);
  });

  it('retorna false cuando no hay usuario', () => {
    expect(useAuthStore.getState().isSuperAdmin()).toBe(false);
  });

  it('retorna false cuando es_super_admin=false', () => {
    // El campo que importa es el del usuario, no el del rol
    const regular: UsuarioAuth = { ...mockUser, es_super_admin: false };
    useAuthStore.getState().setAuth(regular, 'tok', 'ref');
    expect(useAuthStore.getState().isSuperAdmin()).toBe(false);
  });

  it('retorna false cuando rol.es_super_admin=true pero user.es_super_admin=false', () => {
    // Garantiza que el campo del rol no influye en la decisión de acceso
    const tramposo: UsuarioAuth = {
      ...mockUser,
      es_super_admin: false,
      rol: { ...mockUser.rol, es_super_admin: true },
    };
    useAuthStore.getState().setAuth(tramposo, 'tok', 'ref');
    expect(useAuthStore.getState().isSuperAdmin()).toBe(false);
  });
});
