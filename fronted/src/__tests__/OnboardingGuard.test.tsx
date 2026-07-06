/**
 * Tests para OnboardingGuard y la página Onboarding.
 *
 * Cubre:
 *   - Guard redirige a /onboarding cuando onboarding_completado=false
 *   - Guard deja pasar cuando onboarding_completado=true
 *   - Guard muestra spinner mientras los flags no están cargados
 *   - Usuario sin restaurantes asignados (sin permiso) → ve pantalla "pide admin"
 *   - Usuario con restaurantes asignados (con permiso) → ve shell del wizard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ── Mocks de íconos MUI (evita EMFILE en Windows) ─────────────────────────────
vi.mock('@mui/icons-material', () => {
  const n = () => null;
  return {
    SettingsOutlined: n, LockOutlined: n,
    ArrowBack: n, ArrowForward: n,
    CheckCircleOutline: n, Check: n,
    PauseCircleOutline: n, Lock: n,
    HelpOutline: n, Message: n,
    WhatsApp: n, MailOutline: n,
    WarningAmber: n,
    TwoWheeler: n, DinnerDining: n,
    Fastfood: n, Coffee: n,
    SportsBar: n, Storefront: n,
  };
});
vi.mock('@mui/icons-material/SettingsOutlined', () => ({ default: () => null }));
vi.mock('@mui/icons-material/LockOutlined',     () => ({ default: () => null }));

// ── Mocks de stores ────────────────────────────────────────────────────────────
const mockFlagStore = { loaded: false, flags: {} as Record<string, boolean> };
vi.mock('../store/featureFlagStore', () => ({
  useFeatureFlagStore: (selector: (s: typeof mockFlagStore) => unknown) =>
    selector(mockFlagStore),
  useFeatureFlag: (nombre: string) => mockFlagStore.flags[nombre] ?? false,
}));

const mockAuthStore = { user: null as { restaurantes: { id: number }[] } | null };
vi.mock('../store/useStore', () => ({
  useAuthStore: (selector: (s: typeof mockAuthStore) => unknown) =>
    selector(mockAuthStore),
}));

import { OnboardingGuard } from '../components/common/OnboardingGuard';
import { Onboarding }      from '../pages/Onboarding';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const PaginaNormal = () => <div>Contenido normal</div>;
const PaginaOnboarding = () => <Onboarding />;

/**
 * Árbol de prueba que replica la estructura de App.tsx:
 *   /normal   → dentro de OnboardingGuard
 *   /onboarding → fuera de OnboardingGuard (para no crear loop)
 */
function renderGuard(initialPath = '/normal') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/onboarding" element={<PaginaOnboarding />} />
        <Route element={<OnboardingGuard />}>
          <Route path="/normal" element={<PaginaNormal />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFlagStore.loaded = false;
  mockFlagStore.flags  = {};
  mockAuthStore.user   = null;
});

// ── OnboardingGuard ────────────────────────────────────────────────────────────

describe('OnboardingGuard — flags no cargados', () => {
  it('muestra spinner mientras loaded=false', () => {
    mockFlagStore.loaded = false;
    renderGuard('/normal');
    // CircularProgress no tiene texto pero sí el role progressbar
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Contenido normal')).not.toBeInTheDocument();
  });
});

describe('OnboardingGuard — onboarding_completado=true', () => {
  it('deja pasar y renderiza la ruta hija', () => {
    mockFlagStore.loaded = true;
    mockFlagStore.flags  = { onboarding_completado: true };
    renderGuard('/normal');
    expect(screen.getByText('Contenido normal')).toBeInTheDocument();
  });
});

describe('OnboardingGuard — onboarding_completado=false', () => {
  it('redirige a /onboarding', () => {
    mockFlagStore.loaded = true;
    mockFlagStore.flags  = { onboarding_completado: false };
    // Para ver la redirección, renderizamos también el path de destino
    mockAuthStore.user = { restaurantes: [{ id: 1 }] };
    renderGuard('/normal');
    expect(screen.queryByText('Contenido normal')).not.toBeInTheDocument();
    // La página de onboarding se renderizó (fue la redirección)
    expect(screen.getByText(/Qué tipo de restaurante/i)).toBeInTheDocument();
  });

  it('redirige cuando onboarding_completado está ausente (undefined → false)', () => {
    mockFlagStore.loaded = true;
    mockFlagStore.flags  = {}; // sin la clave → false por defecto
    mockAuthStore.user = { restaurantes: [{ id: 1 }] };
    renderGuard('/normal');
    expect(screen.queryByText('Contenido normal')).not.toBeInTheDocument();
  });
});

// ── OnboardingPage — edge case de permiso ─────────────────────────────────────

describe('Onboarding — usuario sin restaurantes (sin permiso)', () => {
  it('muestra pantalla "pide al administrador"', () => {
    mockAuthStore.user = { restaurantes: [] }; // sin restaurantes
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );
    expect(screen.getByText(/Esta sede aún no está configurada/i)).toBeInTheDocument();
    expect(screen.getByText(/pídele que acceda a esta pantalla/i)).toBeInTheDocument();
  });

  it('NO muestra el shell del wizard', () => {
    mockAuthStore.user = { restaurantes: [] };
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );
    expect(screen.queryByText(/Qué tipo de restaurante/i)).not.toBeInTheDocument();
  });
});

describe('Onboarding — usuario con restaurantes (puede configurar)', () => {
  it('muestra el shell del wizard', () => {
    mockAuthStore.user = { restaurantes: [{ id: 5 }] };
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );
    expect(screen.getByText(/Qué tipo de restaurante/i)).toBeInTheDocument();
  });

  it('NO muestra la pantalla de bloqueo', () => {
    mockAuthStore.user = { restaurantes: [{ id: 5 }] };
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );
    expect(screen.queryByText(/Esta sede aún no está configurada/i)).not.toBeInTheDocument();
  });
});

// ── Estado intermedio: usuario null ───────────────────────────────────────────

describe('Onboarding — usuario null (no hidratado aún)', () => {
  it('muestra pantalla de bloqueo (restaurantes vacíos como fallback)', () => {
    mockAuthStore.user = null;
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );
    expect(screen.getByText(/Esta sede aún no está configurada/i)).toBeInTheDocument();
  });
});
