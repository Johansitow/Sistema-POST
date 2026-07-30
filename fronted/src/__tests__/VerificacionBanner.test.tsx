/**
 * Tests de VerificacionBanner — visibilidad según el estado de verificación.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockAuth = { user: null as { es_super_admin: boolean; email_verificado?: boolean } | null };
vi.mock('../store/useStore', () => ({
  useAuthStore: () => mockAuth,
}));

vi.mock('../services/auth.service', () => ({
  authService: { reenviarVerificacion: vi.fn().mockResolvedValue({ message: 'ok' }) },
}));

import { VerificacionBanner } from '../components/common/VerificacionBanner';

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.user = null;
});

describe('VerificacionBanner', () => {
  it('se muestra cuando el correo NO está verificado', () => {
    mockAuth.user = { es_super_admin: false, email_verificado: false };
    render(<VerificacionBanner />);
    expect(screen.getByText(/Verifica tu correo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reenviar/i })).toBeInTheDocument();
  });

  it('NO se muestra cuando el correo ya está verificado', () => {
    mockAuth.user = { es_super_admin: false, email_verificado: true };
    const { container } = render(<VerificacionBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('NO se muestra para el superadmin', () => {
    mockAuth.user = { es_super_admin: true, email_verificado: false };
    const { container } = render(<VerificacionBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('NO se muestra si el campo viene indefinido (token viejo)', () => {
    mockAuth.user = { es_super_admin: false };
    const { container } = render(<VerificacionBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
