/**
 * Tests de TourTooltip — la tarjeta de un paso del tour.
 * Verifica la numeración, el texto del botón según sea o no el último paso, y que
 * los controles disparan sus callbacks.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TourTooltip } from '../components/tour/TourTooltip';
import type { PasoTour } from '../lib/tour/pasos';

const paso: PasoTour = { id: 'x', titulo: 'Órdenes', contenido: 'Gestiona pedidos.' };

afterEach(cleanup);

function props(over: Partial<React.ComponentProps<typeof TourTooltip>> = {}) {
  return {
    paso, numero: 2, total: 5, esPrimero: false, esUltimo: false,
    onAnterior: vi.fn(), onSiguiente: vi.fn(), onOmitir: vi.fn(),
    ...over,
  };
}

describe('TourTooltip', () => {
  it('muestra título, contenido y progreso', () => {
    render(<TourTooltip {...props()} />);
    expect(screen.getByText('Órdenes')).toBeInTheDocument();
    expect(screen.getByText('Gestiona pedidos.')).toBeInTheDocument();
    expect(screen.getByText('Paso 2 de 5')).toBeInTheDocument();
  });

  it('en un paso intermedio muestra Anterior y Siguiente', () => {
    render(<TourTooltip {...props()} />);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
  });

  it('en el primer paso oculta Anterior', () => {
    render(<TourTooltip {...props({ esPrimero: true, numero: 1 })} />);
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument();
  });

  it('en el último paso el botón dice Finalizar', () => {
    render(<TourTooltip {...props({ esUltimo: true, numero: 5 })} />);
    expect(screen.getByRole('button', { name: 'Finalizar' })).toBeInTheDocument();
  });

  it('los botones disparan sus callbacks', async () => {
    const p = props();
    render(<TourTooltip {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    await userEvent.click(screen.getByRole('button', { name: 'Omitir' }));
    expect(p.onSiguiente).toHaveBeenCalledOnce();
    expect(p.onAnterior).toHaveBeenCalledOnce();
    expect(p.onOmitir).toHaveBeenCalledOnce();
  });
});
