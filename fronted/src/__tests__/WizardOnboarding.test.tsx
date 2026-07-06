/**
 * Tests del wizard de onboarding (WizardOnboarding + Onboarding).
 *
 * Cubre:
 *   - Renderizado de cada paso
 *   - Navegación atrás/adelante conserva selecciones
 *   - Paso 3 muestra los 3 bloques desde un preview mockeado (incluyendo huérfano y omitido)
 *   - "Confirmar y aplicar" llama aplicar() + reloadFlags() + navega a /dashboard
 *   - El flujo sin confirmar NO llama aplicar()
 *   - Link "ninguno encaja" lleva a pantalla de contacto
 *   - Ningún nombre de flag crudo aparece en el DOM renderizado
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { PerfilResuelta } from '../types/onboarding.types';

// ── Mocks de íconos MUI (evita EMFILE en Windows) ─────────────────────────────
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
const mockFlagStore = { loaded: true, flags: {} as Record<string, boolean>, reloadFlags: mockReloadFlags };
vi.mock('../store/featureFlagStore', () => ({
  useFeatureFlagStore: (selector: (s: typeof mockFlagStore) => unknown) =>
    selector(mockFlagStore),
  useFeatureFlag: (nombre: string) => mockFlagStore.flags[nombre] ?? false,
}));

// ── Mock useAuthStore ──────────────────────────────────────────────────────────
const mockAuthStore = { user: { restaurantes: [{ id: 1 }] } as { restaurantes: { id: number }[] } | null };
vi.mock('../store/useStore', () => ({
  useAuthStore: (selector: (s: typeof mockAuthStore) => unknown) =>
    selector(mockAuthStore),
}));

// ── Mock onboardingService ─────────────────────────────────────────────────────
const mockPreview: PerfilResuelta = {
  flags: [
    { nombre: 'modulo.mesas',    habilitado: true,  nivel: 'sede' },
    { nombre: 'ordenes.propina', habilitado: true,  nivel: 'sede' },
    { nombre: 'modulo.inventario', habilitado: false, nivel: 'sede' },
  ],
  configs: [
    { clave: 'facturacion.tipo', valor: 'ambos', nivel: 'sede' },
  ],
  desactivadosPorDependencia: [
    { clave: 'inventario.lotes', dependeDe: 'modulo.inventario',
      motivo: 'lotes se desactivará porque el módulo de inventario quedó apagado' },
  ],
  omitidosPorDependencia: [
    { clave: 'modulo.fidelizacion', dependeDe: 'modulo.clientes',
      motivo: 'bloqueado por administrador' },
  ],
};

const mockPrevisualizar = vi.fn().mockResolvedValue(mockPreview);
const mockAplicar = vi.fn().mockResolvedValue(mockPreview);

vi.mock('../services/onboarding.service', () => ({
  onboardingService: {
    previsualizar: (...args: unknown[]) => mockPrevisualizar(...args),
    aplicar:       (...args: unknown[]) => mockAplicar(...args),
  },
}));

// ── Imports después de todos los mocks ─────────────────────────────────────────
import { WizardOnboarding } from '../components/onboarding/WizardOnboarding';
import { Onboarding }       from '../pages/Onboarding';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<WizardOnboarding />} />
        <Route path="/dashboard"  element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReloadFlags.mockResolvedValue(undefined);
  mockPrevisualizar.mockResolvedValue(mockPreview);
  mockAplicar.mockResolvedValue(mockPreview);
  mockAuthStore.user = { restaurantes: [{ id: 1 }] };
  mockFlagStore.flags = {};
});

// ── Paso 1 — Arquetipo ─────────────────────────────────────────────────────────

describe('Paso 1 — Arquetipo', () => {
  it('renderiza el título y las 6 tarjetas', () => {
    renderWizard();
    expect(screen.getByText(/Qué tipo de restaurante/i)).toBeInTheDocument();
    expect(screen.getByText('Cocina oculta')).toBeInTheDocument();
    expect(screen.getByText('Restaurante con mesas')).toBeInTheDocument();
    expect(screen.getByText('Comida rápida')).toBeInTheDocument();
    expect(screen.getByText('Cafetería / panadería')).toBeInTheDocument();
    expect(screen.getByText('Bar')).toBeInTheDocument();
    expect(screen.getByText('Franquicia')).toBeInTheDocument();
  });

  it('botón "Siguiente" está deshabilitado sin selección', () => {
    renderWizard();
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeDisabled();
  });

  it('al seleccionar un arquetipo muestra el panel "qué incluye" y habilita Siguiente', () => {
    renderWizard();
    fireEvent.click(screen.getByText('Restaurante con mesas'));
    expect(screen.getByText('Restaurante con mesas incluye:')).toBeInTheDocument();
    expect(screen.getByText('Mesas y propina')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /siguiente/i })).not.toBeDisabled();
  });

  it('link "ninguno encaja" navega a pantalla de contacto', () => {
    renderWizard();
    fireEvent.click(screen.getByText(/ninguno encaja/i));
    expect(screen.getByText(/configuración a medida/i)).toBeInTheDocument();
    expect(screen.getByText('Volver a los tipos')).toBeInTheDocument();
  });
});

// ── Paso 2 — Ejes ─────────────────────────────────────────────────────────────

describe('Paso 2 — Ejes', () => {
  function irAPaso2() {
    renderWizard();
    fireEvent.click(screen.getByText('Restaurante con mesas'));
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
  }

  it('renderiza las preguntas de ajuste', () => {
    irAPaso2();
    expect(screen.getByText(/Cuántas sedes/i)).toBeInTheDocument();
    expect(screen.getByText(/Cómo controlas el inventario/i)).toBeInTheDocument();
    expect(screen.getByText(/Operas bajo franquicia/i)).toBeInTheDocument();
    expect(screen.getByText('Moneda')).toBeInTheDocument();
  });

  it('preconfigurado con los defaults del arquetipo (con_mesas → Con lotes y vencimiento activo)', () => {
    irAPaso2();
    // "Con lotes y vencimiento" debe estar en el DOM (toggle activo)
    expect(screen.getByText('Con lotes y vencimiento')).toBeInTheDocument();
  });

  it('volver a Paso 1 conserva el arquetipo seleccionado', () => {
    irAPaso2();
    fireEvent.click(screen.getByRole('button', { name: /atrás/i }));
    // Volvemos al paso 1 y el arquetipo sigue seleccionado (panel incluye visible)
    expect(screen.getByText('Restaurante con mesas incluye:')).toBeInTheDocument();
  });
});

// ── Paso 3 — Revisar y aplicar ────────────────────────────────────────────────

describe('Paso 3 — Revisar y aplicar', () => {
  async function irAPaso3() {
    renderWizard();
    fireEvent.click(screen.getByText('Restaurante con mesas'));
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /revisar cambios/i }));
    });
    await waitFor(() => expect(mockPrevisualizar).toHaveBeenCalledTimes(1));
    await waitFor(() => screen.getByText(/Confirmar y aplicar/i));
  }

  it('llama a previsualizar() al llegar al paso 3', async () => {
    await irAPaso3();
    expect(mockPrevisualizar).toHaveBeenCalledWith({
      arquetipo: 'con_mesas',
      ejes: expect.objectContaining({ inventario: 'avanzado' }),
    });
  });

  it('muestra el bloque "Se activará" con etiquetas humanas', async () => {
    await irAPaso3();
    expect(screen.getByText('Se activará')).toBeInTheDocument();
    expect(screen.getByText('Servicio en mesas')).toBeInTheDocument();
    expect(screen.getByText('Ticket y factura electrónica')).toBeInTheDocument();
  });

  it('muestra el bloque de huérfanos (desactivadosPorDependencia)', async () => {
    await irAPaso3();
    expect(screen.getByText(/quedaría sin uso/i)).toBeInTheDocument();
    expect(screen.getByText('Inventario con lotes y vencimiento')).toBeInTheDocument();
  });

  it('muestra el bloque de omitidos (omitidosPorDependencia)', async () => {
    await irAPaso3();
    expect(screen.getByText(/bloqueado por un administrador/i)).toBeInTheDocument();
    expect(screen.getByText('Fidelización de clientes')).toBeInTheDocument();
  });

  it('NINGÚN nombre de flag crudo aparece en el DOM', async () => {
    await irAPaso3();
    const flags = [
      'modulo.mesas', 'ordenes.propina', 'modulo.inventario',
      'inventario.lotes', 'modulo.fidelizacion',
    ];
    flags.forEach(f => {
      expect(screen.queryByText(f)).not.toBeInTheDocument();
    });
  });

  it('"Confirmar y aplicar" llama aplicar() + reloadFlags() + navega a /dashboard', async () => {
    await irAPaso3();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirmar y aplicar/i }));
    });
    await waitFor(() => expect(mockAplicar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockReloadFlags).toHaveBeenCalledTimes(1));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('sin confirmar, aplicar() NO se llama', async () => {
    await irAPaso3();
    // No hacemos click en "Confirmar y aplicar"
    expect(mockAplicar).not.toHaveBeenCalled();
  });

  it('volver al Paso 2 desde Paso 3 conserva el arquetipo', async () => {
    await irAPaso3();
    fireEvent.click(screen.getByRole('button', { name: /atrás/i }));
    // Paso 2 visible de nuevo con el arquetipo correcto
    expect(screen.getByText(/Ajusta lo que necesites/i)).toBeInTheDocument();
    expect(screen.getByText(/Restaurante con mesas/i)).toBeInTheDocument();
  });

  it('muestra error claro si aplicar() falla con 403', async () => {
    mockAplicar.mockRejectedValueOnce({ response: { status: 403 } });
    await irAPaso3();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirmar y aplicar/i }));
    });
    await waitFor(() =>
      expect(screen.getByText(/No tienes permiso para aplicar/i)).toBeInTheDocument()
    );
  });
});

// ── Pantalla de contacto ───────────────────────────────────────────────────────

describe('Pantalla de contacto', () => {
  it('renderiza info de contacto y botón de volver', () => {
    renderWizard();
    fireEvent.click(screen.getByText(/ninguno encaja/i));
    expect(screen.getByText(/configuración a medida/i)).toBeInTheDocument();
    expect(screen.getByText('+57 300 000 0000')).toBeInTheDocument();
    expect(screen.getByText('soporte@tupos.co')).toBeInTheDocument();
  });

  it('"Volver a los tipos" regresa al paso 1', () => {
    renderWizard();
    fireEvent.click(screen.getByText(/ninguno encaja/i));
    fireEvent.click(screen.getByText('Volver a los tipos'));
    expect(screen.getByText(/Qué tipo de restaurante/i)).toBeInTheDocument();
  });
});

// ── Onboarding — pantalla de bloqueo ──────────────────────────────────────────

describe('Onboarding — usuario sin restaurantes', () => {
  it('muestra pantalla "pide al administrador" en lugar del wizard', () => {
    mockAuthStore.user = { restaurantes: [] };
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );
    expect(screen.getByText(/Esta sede aún no está configurada/i)).toBeInTheDocument();
    expect(screen.queryByText(/Qué tipo de restaurante/i)).not.toBeInTheDocument();
  });
});
