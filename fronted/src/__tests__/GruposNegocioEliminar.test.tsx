/**
 * Test de GruposNegocio — flujo de borrado de un negocio.
 * El botón abre el diálogo; el checkbox habilita "Eliminar"; confirmar llama al servicio.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Íconos MUI → vacíos (evita EMFILE en Windows).
vi.mock('@mui/icons-material', () => {
  const n = () => null;
  return { Add: n, AccountTree: n, Check: n, Close: n, Delete: n, DeleteForever: n, Edit: n, ManageAccounts: n, People: n };
});

const { GRUPO, eliminar } = vi.hoisted(() => ({
  GRUPO: {
    id: 7, uuid: 'u7', nombre: 'Negocio Prueba', nit: null, plan: 'starter', activo: true,
    fecha_creacion: '2026-07-28', restaurantes: [], _count: { restaurantes: 1, usuarios: 1 },
  },
  eliminar: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/grupo-negocio.service', () => ({
  grupoNegocioService: {
    listar:   vi.fn().mockResolvedValue({ data: [GRUPO], total: 1, page: 1, totalPages: 1 }),
    eliminar,
    crear: vi.fn(), actualizar: vi.fn(), listarMiembros: vi.fn(), asignarMiembro: vi.fn(), removerMiembro: vi.fn(),
  },
}));

vi.mock('../services/usuarios.service', () => ({
  usuariosService: { listar: vi.fn().mockResolvedValue({ data: [] }) },
}));

// Superadmin sin grupos propios → el botón de borrar SÍ se muestra para el negocio de prueba.
vi.mock('../store/useStore', () => ({
  useAuthStore: (sel: (s: { user: { restaurantes: { id_grupo: number }[] } }) => unknown) =>
    sel({ user: { restaurantes: [] } }),
}));

// Stubs de los comunes; ConfirmDialog fiel al contrato (disabled + children + onConfirm).
vi.mock('../components/common', () => ({
  LoadingScreen: () => null,
  EmptyState: () => null,
  ConfirmDialog: ({ open, title, confirmText, disabled, children, onConfirm }: any) =>
    open ? (
      <div role="dialog">
        <h2>{title}</h2>
        {children}
        <button disabled={disabled} onClick={() => onConfirm()}>{confirmText}</button>
      </div>
    ) : null,
}));

import GruposNegocio from '../pages/admin/GruposNegocio';

beforeEach(() => vi.clearAllMocks());

describe('GruposNegocio — eliminar negocio', () => {
  it('el botón abre el diálogo, el checkbox habilita y confirmar llama al servicio', async () => {
    render(<GruposNegocio />);

    // La tarjeta del negocio aparece tras cargar
    await waitFor(() => expect(screen.getByText('Negocio Prueba')).toBeInTheDocument());

    // Abrir el diálogo de borrado
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar negocio' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // El botón de confirmar arranca deshabilitado (falta marcar el checkbox)
    const confirmar = screen.getByRole('button', { name: 'Eliminar definitivamente' });
    expect(confirmar).toBeDisabled();

    // Marcar "Entiendo que es permanente" habilita el botón
    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirmar).toBeEnabled();

    // Confirmar → llama al servicio con el id correcto
    fireEvent.click(confirmar);
    await waitFor(() => expect(eliminar).toHaveBeenCalledWith(7));
  });
});
