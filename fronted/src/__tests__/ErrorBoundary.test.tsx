import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// En Windows, @mui/icons-material tiene miles de archivos individuales y provoca EMFILE.
// Mockeamos solo los íconos que usa ErrorBoundary para evitar el problema.
vi.mock('@mui/icons-material/BugReport', () => ({ default: () => null }));
vi.mock('@mui/icons-material/Refresh',   () => ({ default: () => null }));
vi.mock('@mui/icons-material', () => ({
  BugReport: () => null,
  Refresh:   () => null,
}));

import { ErrorBoundary } from '../components/common/ErrorBoundary';

// Silencia console.error de React para mantener el output limpio en tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Componente helper que lanza un error de render
function BombaError({ throw: shouldThrow }: { throw?: boolean }) {
  if (shouldThrow) throw new Error('Error de prueba');
  return <p>Contenido correcto</p>;
}

// ── render normal ─────────────────────────────────────────────────────────────

describe('ErrorBoundary — sin error', () => {
  it('renderiza los children normalmente', () => {
    render(
      <ErrorBoundary>
        <BombaError />
      </ErrorBoundary>
    );
    expect(screen.getByText('Contenido correcto')).toBeInTheDocument();
  });
});

// ── captura de error ──────────────────────────────────────────────────────────

describe('ErrorBoundary — con error', () => {
  it('muestra la pantalla de error cuando un hijo falla', () => {
    render(
      <ErrorBoundary>
        <BombaError throw />
      </ErrorBoundary>
    );
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('muestra el fallback personalizado si se proporciona', () => {
    render(
      <ErrorBoundary fallback={<p>Fallback personalizado</p>}>
        <BombaError throw />
      </ErrorBoundary>
    );
    expect(screen.getByText('Fallback personalizado')).toBeInTheDocument();
    expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument();
  });

  it('el botón Reintentar resetea el estado y vuelve a los children', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <BombaError throw />
      </ErrorBoundary>
    );
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();

    // Primero cambiamos el child para que ya no lance error,
    // luego clickeamos Reintentar para que el boundary lo renderice
    rerender(
      <ErrorBoundary>
        <BombaError />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(screen.getByText('Contenido correcto')).toBeInTheDocument();
  });
});
