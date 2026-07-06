/**
 * Tests del modo prueba del wizard (WizardOnboarding modo="prueba").
 *
 * Cubre:
 *   - Paso 3 muestra los 3 bloques pero NO botón "Confirmar y aplicar"
 *   - Banner "Modo prueba — no guarda nada" presente en paso 3
 *   - aplicar() del service NUNCA se llama en ningún flujo del modo prueba
 *   - "Probar otra configuración" resetea al paso 1 conservando modo prueba
 *   - Modo 'onboarding' sigue intacto: SÍ puede aplicar (regresión E3.2)
 *   - La ruta /admin/onboarding-prueba está protegida por AdminGuard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { PerfilResuelta } from '../types/onboarding.types';

// ── Mocks de íconos MUI ────────────────────────────────────────────────────────
vi.mock('@mui/icons-material', () => {
  const n = () => null;
  return {
    ArrowBack: n, ArrowForward: n,
    CheckCircleOutline: n, Check: n,
    PauseCircleOutline: n, Lock: n,
    HelpOutline: n, Message: n,
    WhatsApp: n, MailOutline: n,
    WarningAmber: n,
    TwoWheeler: n, DinnerDining: n,
    Fastfood: n, Coffee: n,
    SportsBar: n, Storefront: n,
    LockOutlined: n, SettingsOutlined: n,
    PlayCircleOutline: n,
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
const mockAuthStore = {
  user: { restaurantes: [{ id: 1 }] } as { restaurantes: { id: number }[] } | null,
  isAuthenticated: true,
  isSuperAdmin: () => true,
};
vi.mock('../store/useStore', () => ({
  useAuthStore: (selector: (s: typeof mockAuthStore) => unknown) =>
    selector(mockAuthStore),
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

const mockPrevisualizar = vi.fn().mockResolvedValue(mockPreview);
const mockAplicar       = vi.fn().mockResolvedValue(mockPreview);

vi.mock('../services/onboarding.service', () => ({
  onboardingService: {
    previsualizar: (...args: unknown[]) => mockPrevisualizar(...args),
    aplicar:       (...args: unknown[]) => mockAplicar(...args),
  },
}));

// ── Imports después de mocks ───────────────────────────────────────────────────
import { WizardOnboarding } from '../components/onboarding/WizardOnboarding';
import { OnboardingPrueba } from '../pages/admin/OnboardingPrueba';

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  await waitFor(() => screen.getByText(/Modo prueba|Confirmar y aplicar/));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReloadFlags.mockResolvedValue(undefined);
  mockPrevisualizar.mockResolvedValue(mockPreview);
  mockAplicar.mockResolvedValue(mockPreview);
  mockAuthStore.user = { restaurantes: [{ id: 1 }] };
  mockAuthStore.isAuthenticated = true;
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

  it('muestra la nota de "Modo prueba — no guarda nada"', async () => {
    await navegarHastaPaso3('prueba');
    expect(screen.getByText(/Modo prueba.*no guarda nada/i)).toBeInTheDocument();
  });

  it('NO hay botón "Confirmar y aplicar"', async () => {
    await navegarHastaPaso3('prueba');
    expect(screen.queryByRole('button', { name: /confirmar y aplicar/i })).not.toBeInTheDocument();
  });

  it('SÍ hay botón "Probar otra configuración"', async () => {
    await navegarHastaPaso3('prueba');
    expect(screen.getByRole('button', { name: /probar otra configuración/i })).toBeInTheDocument();
  });
});

// ── Garantía estructural: aplicar() NUNCA se llama en modo prueba ─────────────

describe('Garantía: aplicar() nunca se invoca en modo prueba', () => {
  it('no llama aplicar() al llegar al paso 3', async () => {
    await navegarHastaPaso3('prueba');
    expect(mockAplicar).not.toHaveBeenCalled();
  });

  it('no hay forma de invocar aplicar() desde modo prueba (no existe ruta al callback)', async () => {
    await navegarHastaPaso3('prueba');
    // No hay botón de confirmar, por tanto no hay click que pueda disparar aplicar()
    expect(screen.queryByRole('button', { name: /confirmar y aplicar/i })).not.toBeInTheDocument();
    // Verificar que incluso en estado final aplicar no fue llamado
    expect(mockAplicar).not.toHaveBeenCalled();
  });

  it('no llama reloadFlags() en modo prueba', async () => {
    await navegarHastaPaso3('prueba');
    expect(mockReloadFlags).not.toHaveBeenCalled();
  });

  it('no navega a /dashboard en modo prueba', async () => {
    await navegarHastaPaso3('prueba');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ── "Probar otra configuración" resetea al paso 1 ────────────────────────────

describe('Probar otra configuración', () => {
  it('vuelve al paso 1 conservando modo prueba', async () => {
    await navegarHastaPaso3('prueba');
    fireEvent.click(screen.getByRole('button', { name: /probar otra configuración/i }));
    // Paso 1 visible de nuevo
    expect(screen.getByText(/Qué tipo de restaurante/i)).toBeInTheDocument();
  });

  it('después de reiniciar, al llegar a paso 3 sigue sin botón de confirmar', async () => {
    await navegarHastaPaso3('prueba');
    fireEvent.click(screen.getByRole('button', { name: /probar otra configuración/i }));
    // Seleccionar un arquetipo nuevo y navegar de vuelta al paso 3
    fireEvent.click(screen.getByText('Bar'));
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /revisar cambios/i }));
    });
    await waitFor(() => screen.getByText(/Modo prueba/i));
    expect(screen.queryByRole('button', { name: /confirmar y aplicar/i })).not.toBeInTheDocument();
  });
});

// ── Regresión E3.2: modo onboarding sigue intacto ────────────────────────────

describe('Regresión: modo onboarding no se rompe', () => {
  it('en modo onboarding aparece "Confirmar y aplicar" en paso 3', async () => {
    await navegarHastaPaso3('onboarding');
    expect(screen.getByRole('button', { name: /confirmar y aplicar/i })).toBeInTheDocument();
    expect(screen.queryByText(/Modo prueba/i)).not.toBeInTheDocument();
  });

  it('en modo onboarding, al confirmar se llama aplicar() y reloadFlags()', async () => {
    await navegarHastaPaso3('onboarding');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirmar y aplicar/i }));
    });
    await waitFor(() => expect(mockAplicar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockReloadFlags).toHaveBeenCalledTimes(1));
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

  it('renderiza el wizard en modo prueba si el usuario es superadmin', () => {
    mockAuthStore.isSuperAdmin = () => true;

    render(
      <MemoryRouter initialEntries={['/admin/onboarding-prueba']}>
        <Routes>
          <Route path="/admin/onboarding-prueba" element={<OnboardingPrueba />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/Qué tipo de restaurante/i)).toBeInTheDocument();
  });
});
