/**
 * Tests del Modal accesible.
 *
 * Cubren exactamente las cuatro carencias que tenían los 10 modales hechos a
 * mano que este componente reemplaza: sin focus trap, sin scroll lock, sin
 * aria-modal y sin devolución del foco al cerrar.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../components/common/Modal';

afterEach(() => {
  cleanup();
  // El scroll lock es un contador a nivel de módulo; si un test deja basura,
  // el siguiente arranca con el body bloqueado.
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
});

describe('Modal — semántica accesible', () => {
  it('se expone como diálogo modal', () => {
    render(<Modal titulo="Registrar pago" onClose={() => {}}><button>Aceptar</button></Modal>);
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
  });

  it('anuncia su título aunque el encabezado visual lo dibuje la pantalla', () => {
    render(<Modal titulo="Registrar pago" onClose={() => {}}><button>Aceptar</button></Modal>);
    expect(screen.getByRole('dialog', { name: 'Registrar pago' })).toBeInTheDocument();
  });
});

describe('Modal — scroll de fondo', () => {
  it('bloquea el scroll de la página mientras está abierto', () => {
    const { unmount } = render(<Modal titulo="X" onClose={() => {}}><button>A</button></Modal>);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('no desbloquea el scroll al cerrar un modal anidado si queda otro abierto', () => {
    // En Órdenes el modal de pago se abre sobre el de detalle. Si cada uno
    // restaurase el overflow, cerrar el de arriba desbloquearía el fondo.
    const base = render(<Modal titulo="Detalle" onClose={() => {}}><button>A</button></Modal>);
    const encima = render(<Modal titulo="Pago" onClose={() => {}} anidado><button>B</button></Modal>);

    expect(document.body.style.overflow).toBe('hidden');
    encima.unmount();
    expect(document.body.style.overflow).toBe('hidden');
    base.unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('Modal — foco', () => {
  it('mueve el foco al primer elemento al abrir', () => {
    render(
      <Modal titulo="X" onClose={() => {}}>
        <button>Primero</button>
        <button>Segundo</button>
      </Modal>,
    );
    expect(document.activeElement).toBe(screen.getByText('Primero'));
  });

  it('devuelve el foco a quien lo tenía al cerrar', () => {
    // Antes, al cerrar un modal el foco caía en <body> y había que tabular
    // desde el principio de la página para volver al botón que lo abrió.
    const disparador = document.createElement('button');
    disparador.textContent = 'Abrir';
    document.body.appendChild(disparador);
    disparador.focus();
    expect(document.activeElement).toBe(disparador);

    const { unmount } = render(<Modal titulo="X" onClose={() => {}}><button>Dentro</button></Modal>);
    expect(document.activeElement).not.toBe(disparador);

    unmount();
    expect(document.activeElement).toBe(disparador);

    disparador.remove();
  });

  it('atrapa el Tab: desde el último vuelve al primero', async () => {
    const usuario = userEvent.setup();
    render(
      <Modal titulo="X" onClose={() => {}}>
        <button>Primero</button>
        <button>Ultimo</button>
      </Modal>,
    );

    const primero = screen.getByText('Primero');
    const ultimo  = screen.getByText('Ultimo');

    ultimo.focus();
    await usuario.tab();
    expect(document.activeElement).toBe(primero);
  });

  it('atrapa el Shift+Tab: desde el primero va al último', async () => {
    const usuario = userEvent.setup();
    render(
      <Modal titulo="X" onClose={() => {}}>
        <button>Primero</button>
        <button>Ultimo</button>
      </Modal>,
    );

    screen.getByText('Primero').focus();
    await usuario.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByText('Ultimo'));
  });
});

describe('Modal — cierre', () => {
  it('cierra con Escape', async () => {
    const onClose = vi.fn();
    const usuario = userEvent.setup();
    render(<Modal titulo="X" onClose={onClose}><button>A</button></Modal>);

    await usuario.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('no cierra al tocar el fondo cuando se desactiva', async () => {
    // Necesario en formularios con datos sin guardar: un clic fuera no debe
    // descartar lo que el usuario lleva escrito.
    const onClose = vi.fn();
    const usuario = userEvent.setup();
    const { container } = render(
      <Modal titulo="X" onClose={onClose} cerrarAlTocarFondo={false}><button>A</button></Modal>,
    );

    const fondo = container.querySelector('[aria-hidden="true"]')!;
    await usuario.click(fondo);
    expect(onClose).not.toHaveBeenCalled();
  });
});
