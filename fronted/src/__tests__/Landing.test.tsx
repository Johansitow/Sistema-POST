/**
 * Tests de Landing — home público de marketing.
 *
 * Cubre:
 *   - Sin sesión → renderiza hero, sección de planes y las tarjetas del catálogo.
 *   - Con sesión válida → redirige a /dashboard (no muestra el material de venta).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Íconos MUI → componentes vacíos (evita EMFILE en Windows y acelera el render).
vi.mock('@mui/icons-material', () => {
  const n = () => null;
  return {
    RestaurantMenu: n, PointOfSale: n, SoupKitchen: n, Inventory2: n, MenuBook: n,
    LocalShipping: n, Loyalty: n, QueryStats: n, Payments: n, Storefront: n, Badge: n,
    Bolt: n, VerifiedUser: n, Palette: n, RocketLaunch: n,
    CheckCircleOutline: n, ShieldOutlined: n, CheckCircle: n,
  };
});

// Catálogo de planes servido por PlanesGrid.
const listar = vi.fn();
vi.mock('../services/planes.service', () => ({
  planesService: { listar: () => listar() },
  formatoCOP: (v: number) => `$ ${v}`,
  esIlimitado: (v: number) => v < 0,
  ILIMITADO: -1,
}));

// Marca (sin sesión).
vi.mock('../store/brandingStore', () => ({
  useBrandingStore: () => ({ nombreSistema: 'Krezco', logoUrl: '' }),
}));

// Auth store: se sobreescribe por test.
const mockAuth = { isAuthenticated: false, accessToken: null as string | null };
vi.mock('../store/useStore', () => ({
  useAuthStore: () => mockAuth,
}));

import { Landing } from '../pages/Landing';

const PLANES = [
  { codigo: 'starter', nombre: 'Gratis', precio_mensual_cop: 0, descripcion: 'd', destacado: false, limites: {}, modulos: ['Punto de venta'] },
  { codigo: 'professional', nombre: 'Pro', precio_mensual_cop: 19900, descripcion: 'd', destacado: true, limites: {}, modulos: ['Recetas'] },
  { codigo: 'enterprise', nombre: 'Negocio', precio_mensual_cop: 49900, descripcion: 'd', destacado: false, limites: {}, modulos: ['Nómina'] },
];

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<div>Panel</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.isAuthenticated = false;
  mockAuth.accessToken = null;
  listar.mockResolvedValue(PLANES);
});

describe('Landing — visitante sin sesión', () => {
  it('muestra el hero, los módulos y la sección de planes', () => {
    renderLanding();
    expect(screen.getByText(/hace crecer tu restaurante/i)).toBeInTheDocument();
    expect(screen.getByText('Un sistema, todo tu restaurante')).toBeInTheDocument();
    expect(screen.getByText('Cocina en tiempo real (KDS)')).toBeInTheDocument();
    expect(screen.getByText('Equipo y nómina (Colombia)')).toBeInTheDocument();
    expect(screen.getByText('Planes y precios')).toBeInTheDocument();
  });

  it('renderiza las tarjetas de planes del catálogo', async () => {
    renderLanding();
    await waitFor(() => expect(screen.getByText('Pro')).toBeInTheDocument());
    expect(screen.getByText('Negocio')).toBeInTheDocument();
    // "Gratis" aparece como nombre y como precio del plan starter.
    expect(screen.getAllByText('Gratis').length).toBeGreaterThan(0);
  });
});

describe('Landing — cliente con sesión válida', () => {
  it('redirige al panel', () => {
    mockAuth.isAuthenticated = true;
    mockAuth.accessToken = 'tok';
    renderLanding();
    expect(screen.getByText('Panel')).toBeInTheDocument();
    expect(screen.queryByText('Planes y precios')).not.toBeInTheDocument();
  });
});
