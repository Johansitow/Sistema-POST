/**
 * Tests del modo prueba del wizard (WizardOnboarding modo="prueba") y del panel
 * de pruebas activas (OnboardingPrueba).
 *
 * Cubre:
 *   - Paso 3 muestra los 3 bloques de preview
 *   - Botón "Crear … de prueba y entrar" (label según multisede)
 *   - Crear llama sandbox.crear() y entra (setAuth + navega a /dashboard)
 *   - aplicar() del onboarding NUNCA se llama desde modo prueba
 *   - "Probar otra configuración" resetea al paso 1 conservando modo prueba
 *   - Modo 'onboarding' sigue intacto: SÍ aplica (regresión E3.2)
 *   - La ruta /admin/onboarding-prueba está protegida por AdminGuard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { PerfilResuelta, SandboxCreado } from '../types/onboarding.types';

// ── Mock de íconos MUI ─────────────────────────────────────────────────────────
vi.mock('@mui/icons-material', () => {
  const n = () => null;
  return {
    ArrowBack: n, ArrowForward: n, CheckCircleOutline: n, Check: n,
    PauseCircleOutline: n, Lock: n, HelpOutline: n, Message: n,
    WhatsApp: n, MailOutline: n, WarningAmber: n, PlayArrow: n,
    TwoWheeler: n, DinnerDining: n, Fastfood: n, Coffee: n,
    SportsBar: n, Storefront: n,
    // OnboardingPrueba + common
    DeleteOutline: n, Science: n, Store: n, AccountTree: n, Inbox: n,
    LockOutlined: n, SettingsOutlined: n, PlayCircleOutline: n,
  };
});
vi.mock('@mui/icons-material/LockOutlined', () => ({ default: () => null }));

// ── Mock react-router-dom (useNavigate) ───────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Mock featureFlagStore ──────────────────────────────────────────────────────
const mockReloadFlags = vi.fn().mockResolvedValue(undefined);
const mockFlagStore = {
  loaded: true,
  flags: {} as Record<string, boolean>,
  reloadFlags: mockReloadFlags,
};
vi.mock('../store/featureFlagStore', () => ({
  useFeatureFlagStore: (selector: (s: typeof mockFlagStore) => unknown) =>
    selector(mockFlagStore),
  useFeatureFlag: (nombre: string) => mockFlagStore.flags[nombre] ?? false,
}));

// ── Mock useAuthStore ──────────────────────────────────────────────────────────
const mockSetAuth = vi.fn();
const mockAuthStore = {
  user: { restaurantes: [{ id: 1 }] } as { restaurantes: { id: number }[] } | null,
  isAuthenticated: true,
  isSuperAdmin: () => true,
  setAuth: mockSetAuth,
};
vi.mock('../store/useStore', () => ({
  useAuthStore: (selector: (s: typeof mockAuthStore) => unknown) =>
    selector(mockAuthStore),
}));

// ── Mock restauranteStore (usado por useEntrarSandbox) ─────────────────────────
const mockInitFromToken  = vi.fn();
const mockSetActivo      = vi.fn();
const mockSetGrupoActivo = vi.fn();
const mockRestStore = {
  initFromToken:  mockInitFromToken,
  setActivo:      mockSetActivo,
  setGrupoActivo: mockSetGrupoActivo,
};
vi.mock('../store/restauranteStore', () => ({
  useRestauranteStore: (selector: (s: typeof mockRestStore) => unknown) =>
    selector(mockRestStore),
}));

// ── Mock onboardingService ─────────────────────────────────────────────────────
const mockPreview: PerfilResuelta = {
  flags: [
    { nombre: 'modulo.mesas',    habilitado: true,  nivel: 'sede' },
    { nombre: 'modulo.inventario', habilitado: false, nivel: 'sede' },
  ],
  configs: [
    { clave: 'facturacion.tipo', valor: 'ticket', nivel: 'sede' },
  ],
  desactivadosPorDependencia: [
    { clave: 'inventario.lotes', dependeDe: 'modulo.inventario',
      motivo: 'lotes se desactivará porque el módulo de inventario quedó apagado' },
  ],
  omitidosPorDependencia: [
    { clave: 'modulo.fidelizacion', dependeDe: 'modulo.clientes',
      motivo: 'bloqueado' },
  ],
};

const mockSandboxCreado: SandboxCreado = {
  sandbox: {
    id_grupo:       7,
    nombre:         'Prueba: comida_rapida',
    arquetipo:      'comida_rapida',
    multisede:      false,
    fecha_creacion: new Date().toISOString(),
    sedes:          [{ id: 99, nombre: 'Sede de prueba', es_default: false }],
  },
  session: {
    user: {
      id: 1, uuid: 'u', usuario: 'admin', email: 'a@a.co', nombre_completo: 'Admin',
      es_super_admin: true, permisos: [],
      rol: { id: 1, nombre: 'Admin', es_super_admin: true },
      restaurantes: [{ id: 99, nombre: 'Sede de prueba', es_default: false, id_grupo: 7 }],
    },
    tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: '15m' },
  },
};

const mockPrevisualizar = vi.fn().mockResolvedValue(mockPreview);
const mockAplicar       = vi.fn().mockResolvedValue(mockPreview);
const mockCrear         = vi.fn().mockResolvedValue(mockSandboxCreado);
const mockListar        = vi.fn().mockResolvedValue([]);
const mockEntrar        = vi.fn().mockResolvedValue(mockSandboxCreado);
const mockEliminar      = vi.fn().mockResolvedValue(undefined);

vi.mock('../services/onboarding.service', () => ({
  onboardingService: {
    previsualizar: (...args: unknown[]) => mockPrevisualizar(...args),
    aplicar:       (...args: unknown[]) => mockAplicar(...args),
    sandbox: {
      crear:    (...args: unknown[]) => mockCrear(...args),
      listar:   (...args: unknown[]) => mockListar(...args),
      entrar:   (...args: unknown[]) => mockEntrar(...args),
      eliminar: (...args: unknown[]) => mockEliminar(...args),
    },
  },
}));

// ── Imports después de mocks ───────────────────────────────────────────────────
import { WizardOnboarding } from '../components/onboarding/WizardOnboarding';
import { OnboardingPrueba } from '../pages/admin/OnboardingPrueba';

// ── Helpers ───────────────────────────────────────────────────────────────────

const btnCrearRe = /de prueba y entrar/i;

function renderWizard(modo: 'onboarding' | 'prueba' = 'prueba') {
  return render(
    <MemoryRouter initialEntries={['/wizard']}>
      <Routes>
        <Route path="/wizard"     element={<WizardOnboarding modo={modo} />} />
        <Route path="/dashboard"  element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function navegarHastaPaso3(modo: 'onboarding' | 'prueba' = 'prueba') {
  renderWizard(modo);
  // Paso 1: seleccionar arquetipo
  fireEvent.click(screen.getByText('Comida rápida'));
  fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
  // Paso 2: ir a paso 3 (llama previsualizar)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /revisar cambios/i }));
  });
  await waitFor(() =>
    screen.getByRole('button', { name: modo === 'prueba' ? btnCrearRe : /confirmar y aplicar/i })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReloadFlags.mockResolvedValue(undefined);
  mockPrevisualizar.mockResolvedValue(mockPreview);
  mockAplicar.mockResolvedValue(mockPreview);
  mockCrear.mockResolvedValue(mockSandboxCreado);
  mockListar.mockResolvedValue([]);
  mockEntrar.mockResolvedValue(mockSandboxCreado);
  mockAuthStore.user = { restaurantes: [{ id: 1 }] };
  mockAuthStore.isAuthenticated = true;
  mockAuthStore.isSuperAdmin = () => true;
  mockFlagStore.flags = {};
});

// ── Modo prueba — paso 3 ──────────────────────────────────────────────────────

describe('Modo prueba — Paso 3', () => {
  it('muestra los 3 bloques de información del preview', async () => {
    await navegarHastaPaso3('prueba');
    expect(screen.getByText('Se activará')).toBeInTheDocument();
    expect(screen.getByText(/quedaría sin uso/i)).toBeInTheDocument();
    expect(screen.getByText(/bloqueado por un administrador/i)).toBeInTheDocument();
  });

  it('muestra el botón "Crear restaurante de prueba y entrar" (no multisede)', async () => {
    await navegarHastaPaso3('prueba');
    expect(screen.getByRole('button', { name: /crear restaurante de prueba y entrar/i })).toBeInTheDocument();
  });

  it('NO hay botón "Confirmar y aplicar" en modo prueba', async () => {
    await navegarHastaPaso3('prueba');
    expect(screen.queryByRole('button', { name: /confirmar y aplicar/i })).not.toBeInTheDocument();
  });

  it('SÍ hay botón "Probar otra configuración"', async () => {
    await navegarHastaPaso3('prueba');
    expect(screen.getByRole('button', { name: /probar otra configuración/i })).toBeInTheDocument();
  });
});

// ── Crear sandbox y entrar ────────────────────────────────────────────────────

describe('Crear sandbox y entrar', () => {
  it('llama sandbox.crear() con arquetipo y ejes, NO aplicar()', async () => {
    await navegarHastaPaso3('prueba');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: btnCrearRe }));
    });
    await waitFor(() => expect(mockCrear).toHaveBeenCalledTimes(1));
    const arg = mockCrear.mock.calls[0][0];
    expect(arg.arquetipo).toBe('comida_rapida');
    expect(arg.ejes).toBeDefined();
    expect(mockAplicar).not.toHaveBeenCalled();
  });

  it('tras crear, aplica la sesión y navega a /dashboard', async () => {
    await navegarHastaPaso3('prueba');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: btnCrearRe }));
    });
    await waitFor(() => expect(mockSetAuth).toHaveBeenCalledWith(
      mockSandboxCreado.session.user, 'a', 'r',
    ));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
  });
});

// ── Garantía: aplicar() (onboarding) nunca se invoca en modo prueba ───────────

describe('Garantía: aplicar() nunca se invoca en modo prueba', () => {
  it('no llama aplicar() al llegar al paso 3', async () => {
    await navegarHastaPaso3('prueba');
    expect(mockAplicar).not.toHaveBeenCalled();
  });
});

// ── "Probar otra configuración" resetea al paso 1 ────────────────────────────

describe('Probar otra configuración', () => {
  it('vuelve al paso 1 conservando modo prueba', async () => {
    await navegarHastaPaso3('prueba');
    fireEvent.click(screen.getByRole('button', { name: /probar otra configuración/i }));
    expect(screen.getByText(/Qué tipo de restaurante/i)).toBeInTheDocument();
  });

  it('después de reiniciar, al llegar a paso 3 sigue el botón de crear (no confirmar/aplicar)', async () => {
    await navegarHastaPaso3('prueba');
    fireEvent.click(screen.getByRole('button', { name: /probar otra configuración/i }));
    fireEvent.click(screen.getByText('Bar'));
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /revisar cambios/i }));
    });
    await waitFor(() => screen.getByRole('button', { name: btnCrearRe }));
    expect(screen.queryByRole('button', { name: /confirmar y aplicar/i })).not.toBeInTheDocument();
  });
});

// ── Regresión E3.2: modo onboarding sigue intacto ────────────────────────────

describe('Regresión: modo onboarding no se rompe', () => {
  it('en modo onboarding aparece "Confirmar y aplicar" en paso 3', async () => {
    await navegarHastaPaso3('onboarding');
    expect(screen.getByRole('button', { name: /confirmar y aplicar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: btnCrearRe })).not.toBeInTheDocument();
  });

  it('en modo onboarding, al confirmar se llama aplicar() y reloadFlags()', async () => {
    await navegarHastaPaso3('onboarding');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirmar y aplicar/i }));
    });
    await waitFor(() => expect(mockAplicar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockReloadFlags).toHaveBeenCalledTimes(1));
    expect(mockCrear).not.toHaveBeenCalled();
  });
});

// ── AdminGuard protege /admin/onboarding-prueba ───────────────────────────────

describe('Ruta /admin/onboarding-prueba', () => {
  it('redirige a /dashboard si el usuario no es superadmin', () => {
    mockAuthStore.isSuperAdmin = () => false;

    render(
      <MemoryRouter initialEntries={['/admin/onboarding-prueba']}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
          <Route
            path="/admin/onboarding-prueba"
            element={
              mockAuthStore.isAuthenticated && mockAuthStore.isSuperAdmin()
                ? <OnboardingPrueba />
                : <Navigate to="/dashboard" replace />
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText(/Qué tipo de restaurante/i)).not.toBeInTheDocument();
  });

  it('renderiza el wizard en modo prueba si el usuario es superadmin', async () => {
    mockAuthStore.isSuperAdmin = () => true;

    render(
      <MemoryRouter initialEntries={['/admin/onboarding-prueba']}>
        <Routes>
          <Route path="/admin/onboarding-prueba" element={<OnboardingPrueba />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/Qué tipo de restaurante/i)).toBeInTheDocument();
    // El panel de pruebas activas se carga al montar.
    await waitFor(() => expect(mockListar).toHaveBeenCalled());
  });
});
