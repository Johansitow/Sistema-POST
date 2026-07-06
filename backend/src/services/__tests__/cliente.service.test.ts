/**
 * Tests para clienteService
 *
 * Oleada 3b-ii: añade tenant guards (assertGrupoCtx + findByIdScoped con id_grupo).
 * Cubre:
 *   - crear: assertGrupoCtx, id_grupo inyectado desde ctx, unicidad, puntos bienvenida
 *   - actualizar, cambiarEstado: findByIdScoped cross-tenant → 404, superadmin → ok
 *   - getDirecciones, addDireccion, updateDireccion, deleteDireccion: guard vía cliente padre
 *   - getOrdenes, getPuntos: guard vía cliente padre
 *   - canjearPuntos: guard + lógica de saldo
 *   - obtenerPorId: sin cambios (read público sin scope)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantCtx } from '../../lib/tenantCtx';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/cliente.repository', () => ({
  clienteRepository: {
    findAll:           vi.fn(),
    findById:          vi.fn(),
    findByIdScoped:    vi.fn(),
    findByEmail:       vi.fn(),
    findByDocumento:   vi.fn(),
    create:            vi.fn(),
    update:            vi.fn(),
    registrarPuntos:   vi.fn(),
    actualizarPuntos:  vi.fn(),
    estadisticas:      vi.fn(),
    findOrdenes:       vi.fn(),
    findDirecciones:   vi.fn(),
    findDireccionById: vi.fn(),
    addDireccion:      vi.fn(),
    updateDireccion:   vi.fn(),
    deleteDireccion:   vi.fn(),
    findPuntos:        vi.fn(),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { clienteService } from '../cliente.service';
import { clienteRepository } from '../../repositories/cliente.repository';
import { ConflictError, NotFoundError, BadRequestError, ForbiddenError } from '../../exceptions/HttpErrors';

const repo = clienteRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CTX_GRUPO_1: TenantCtx   = { grupoId: 1, restauranteId: 10 };
const CTX_GRUPO_2: TenantCtx   = { grupoId: 2, restauranteId: 20 };
const CTX_SIN_GRUPO: TenantCtx = { restauranteId: 10 };
const CTX_SUPER: TenantCtx     = { esSuperAdmin: true };

const mockCliente = {
  id:                 1,
  id_grupo:           1,
  nombre_completo:    'Ana García',
  email:              'ana@test.com',
  numero_documento:   '12345678',
  puntos_acumulados:  200,
  estado:             'activo',
  tipo_cliente:       'regular',
};

const makeCreateDTO = (overrides: Record<string, unknown> = {}): Parameters<typeof clienteService.crear>[0] => ({
  nombre_completo:  'Nuevo Cliente',
  tipo_documento:   'cc' as never,
  tipo_cliente:     'regular' as never,
  puntos_bienvenida: false,
  email:            'nuevo@test.com',
  numero_documento: '99999999',
  ...overrides,
} as never);

// ── obtenerPorId — sin cambios (lectura pública) ──────────────────────────────

describe('clienteService.obtenerPorId', () => {
  beforeEach(() => vi.resetAllMocks());

  it('retorna el cliente si existe', async () => {
    repo.findById.mockResolvedValue(mockCliente);
    const result = await clienteService.obtenerPorId(1);
    expect(result.id).toBe(1);
  });

  it('lanza NotFoundError si el cliente no existe', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(clienteService.obtenerPorId(999)).rejects.toThrow(NotFoundError);
  });
});

// ── crear — assertGrupoCtx + id_grupo desde ctx ───────────────────────────────

describe('clienteService.crear — tenant guard', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lanza ForbiddenError si ctx no tiene grupoId y no es superadmin', async () => {
    await expect(clienteService.crear(makeCreateDTO(), CTX_SIN_GRUPO))
      .rejects.toThrow(ForbiddenError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('el cliente nace con id_grupo del contexto (no del body)', async () => {
    repo.findByEmail.mockResolvedValue(null);
    repo.findByDocumento.mockResolvedValue(null);
    repo.create.mockResolvedValue({ id: 2 });
    repo.findById.mockResolvedValue({ ...mockCliente, id: 2, id_grupo: 1 });

    await clienteService.crear(makeCreateDTO(), CTX_GRUPO_1);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ id_grupo: 1 })
    );
  });

  it('crea cliente exitosamente sin puntos de bienvenida', async () => {
    repo.findByEmail.mockResolvedValue(null);
    repo.findByDocumento.mockResolvedValue(null);
    repo.create.mockResolvedValue({ id: 2 });
    repo.findById.mockResolvedValue({ ...mockCliente, id: 2 });

    await clienteService.crear(makeCreateDTO(), CTX_GRUPO_1);

    expect(repo.create).toHaveBeenCalledOnce();
    expect(repo.registrarPuntos).not.toHaveBeenCalled();
    expect(repo.actualizarPuntos).not.toHaveBeenCalled();
  });

  it('registra 100 puntos de bienvenida cuando se solicita', async () => {
    repo.findByEmail.mockResolvedValue(null);
    repo.findByDocumento.mockResolvedValue(null);
    repo.create.mockResolvedValue({ id: 3 });
    repo.findById.mockResolvedValue({ ...mockCliente, id: 3, puntos_acumulados: 100 });

    await clienteService.crear(makeCreateDTO({ puntos_bienvenida: true }), CTX_GRUPO_1);

    expect(repo.registrarPuntos).toHaveBeenCalledOnce();
    const puntoArgs = repo.registrarPuntos.mock.calls[0][0];
    expect(puntoArgs.puntos).toBe(100);
    expect(puntoArgs.tipo).toBe('bienvenida');
    expect(puntoArgs.saldo_antes).toBe(0);
    expect(puntoArgs.saldo_despues).toBe(100);
    expect(repo.actualizarPuntos).toHaveBeenCalledWith(3, 100);
  });

  it('lanza ConflictError si el email ya está registrado', async () => {
    repo.findByEmail.mockResolvedValue(mockCliente);

    await expect(clienteService.crear(makeCreateDTO({ email: 'ana@test.com' }), CTX_GRUPO_1))
      .rejects.toThrow(ConflictError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('lanza ConflictError si el número de documento ya está registrado', async () => {
    repo.findByEmail.mockResolvedValue(null);
    repo.findByDocumento.mockResolvedValue(mockCliente);

    await expect(clienteService.crear(makeCreateDTO({ numero_documento: '12345678' }), CTX_GRUPO_1))
      .rejects.toThrow(ConflictError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('superadmin puede crear clientes', async () => {
    repo.findByEmail.mockResolvedValue(null);
    repo.findByDocumento.mockResolvedValue(null);
    repo.create.mockResolvedValue({ id: 10 });
    repo.findById.mockResolvedValue({ ...mockCliente, id: 10 });

    await expect(clienteService.crear(makeCreateDTO(), CTX_SUPER)).resolves.toBeDefined();
  });
});

// ── actualizar — tenant guard ─────────────────────────────────────────────────

describe('clienteService.actualizar — tenant guard', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lanza NotFoundError cross-tenant (cadena A → cliente de cadena B)', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 1'));

    await expect(clienteService.actualizar(1, { nombre_completo: 'X' }, CTX_GRUPO_2))
      .rejects.toThrow(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('lanza ConflictError si el email ya pertenece a otro cliente', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(mockCliente);
    repo.findByEmail.mockResolvedValue({ id: 99, email: 'otro@test.com' });

    await expect(clienteService.actualizar(1, { email: 'otro@test.com' }, CTX_GRUPO_1))
      .rejects.toThrow(ConflictError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('happy path: dueño legítimo actualiza su cliente', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(mockCliente);
    repo.findByEmail.mockResolvedValue(null);
    repo.findByDocumento.mockResolvedValue(null);
    repo.update.mockResolvedValue({});
    repo.findById.mockResolvedValue({ ...mockCliente, nombre_completo: 'Ana G.' });

    const result = await clienteService.actualizar(1, { nombre_completo: 'Ana G.' }, CTX_GRUPO_1);
    expect(result).toMatchObject({ nombre_completo: 'Ana G.' });
    expect(repo.findByIdScoped).toHaveBeenCalledWith(1, CTX_GRUPO_1);
  });

  it('superadmin puede actualizar cualquier cliente', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(mockCliente);
    repo.update.mockResolvedValue({});
    repo.findById.mockResolvedValue(mockCliente);

    await expect(
      clienteService.actualizar(1, { nombre_completo: 'Y' }, CTX_SUPER)
    ).resolves.toBeDefined();
  });

  it('lanza NotFoundError si el cliente no existe', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Cliente'));

    await expect(clienteService.actualizar(999, { nombre_completo: 'X' }, CTX_GRUPO_1))
      .rejects.toThrow(NotFoundError);
  });
});

// ── cambiarEstado — tenant guard ──────────────────────────────────────────────

describe('clienteService.cambiarEstado — tenant guard', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lanza NotFoundError cross-tenant', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 1'));

    await expect(clienteService.cambiarEstado(1, 'inactivo', CTX_GRUPO_2))
      .rejects.toThrow(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('llama update con el nuevo estado', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(mockCliente);
    repo.update.mockResolvedValue({});
    repo.findById.mockResolvedValue({ ...mockCliente, estado: 'inactivo' });

    await clienteService.cambiarEstado(1, 'inactivo', CTX_GRUPO_1);

    expect(repo.update).toHaveBeenCalledWith(1, { estado: 'inactivo' });
  });

  it('superadmin puede cambiar estado de cualquier cliente', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(mockCliente);
    repo.update.mockResolvedValue({});
    repo.findById.mockResolvedValue(mockCliente);

    await expect(clienteService.cambiarEstado(1, 'inactivo', CTX_SUPER)).resolves.toBeDefined();
  });
});

// ── Sub-recursos — guard vía cliente padre ────────────────────────────────────

describe('clienteService sub-recursos — tenant guard', () => {
  beforeEach(() => vi.resetAllMocks());

  it('getDirecciones: cross-tenant → NotFoundError', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 1'));
    await expect(clienteService.getDirecciones(1, CTX_GRUPO_2)).rejects.toThrow(NotFoundError);
    expect(repo.findDirecciones).not.toHaveBeenCalled();
  });

  it('getDirecciones: happy path', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(mockCliente);
    repo.findDirecciones.mockResolvedValueOnce([]);
    await expect(clienteService.getDirecciones(1, CTX_GRUPO_1)).resolves.toEqual([]);
  });

  it('addDireccion: cross-tenant → NotFoundError', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 1'));
    await expect(
      clienteService.addDireccion(1, { alias: 'Casa', direccion: 'Calle 1', es_principal: false }, CTX_GRUPO_2)
    ).rejects.toThrow(NotFoundError);
    expect(repo.addDireccion).not.toHaveBeenCalled();
  });

  it('updateDireccion: cross-tenant → NotFoundError', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 1'));
    await expect(
      clienteService.updateDireccion(1, 10, { alias: 'Oficina' }, CTX_GRUPO_2)
    ).rejects.toThrow(NotFoundError);
    expect(repo.updateDireccion).not.toHaveBeenCalled();
  });

  it('updateDireccion: dirección no encontrada → NotFoundError', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(mockCliente);
    repo.findDireccionById.mockResolvedValueOnce(null);
    await expect(
      clienteService.updateDireccion(1, 99, { alias: 'X' }, CTX_GRUPO_1)
    ).rejects.toThrow(NotFoundError);
    expect(repo.updateDireccion).not.toHaveBeenCalled();
  });

  it('deleteDireccion: cross-tenant → NotFoundError', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 1'));
    await expect(clienteService.deleteDireccion(1, 10, CTX_GRUPO_2)).rejects.toThrow(NotFoundError);
    expect(repo.deleteDireccion).not.toHaveBeenCalled();
  });

  it('getOrdenes: cross-tenant → NotFoundError', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 1'));
    await expect(clienteService.getOrdenes(1, {}, CTX_GRUPO_2)).rejects.toThrow(NotFoundError);
    expect(repo.findOrdenes).not.toHaveBeenCalled();
  });

  it('getPuntos: cross-tenant → NotFoundError', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 1'));
    await expect(clienteService.getPuntos(1, {}, CTX_GRUPO_2)).rejects.toThrow(NotFoundError);
    expect(repo.findPuntos).not.toHaveBeenCalled();
  });

  it('superadmin puede ver sub-recursos de cualquier cliente', async () => {
    repo.findByIdScoped.mockResolvedValueOnce(mockCliente);
    repo.findDirecciones.mockResolvedValueOnce([{ id: 5 }]);
    await expect(clienteService.getDirecciones(1, CTX_SUPER)).resolves.toHaveLength(1);
  });
});

// ── canjearPuntos — tenant guard + lógica de saldo ───────────────────────────

describe('clienteService.canjearPuntos — tenant guard + saldo', () => {
  beforeEach(() => vi.resetAllMocks());

  it('cross-tenant → NotFoundError, no mueve puntos', async () => {
    repo.findByIdScoped.mockRejectedValueOnce(new NotFoundError('Registro 1'));

    await expect(clienteService.canjearPuntos(1, 50, CTX_GRUPO_2))
      .rejects.toThrow(NotFoundError);
    expect(repo.registrarPuntos).not.toHaveBeenCalled();
    expect(repo.actualizarPuntos).not.toHaveBeenCalled();
  });

  it('canjea puntos correctamente cuando el saldo es suficiente', async () => {
    repo.findByIdScoped.mockResolvedValueOnce({ ...mockCliente, puntos_acumulados: 200 });
    repo.registrarPuntos.mockResolvedValue({});
    repo.actualizarPuntos.mockResolvedValue({});

    const result = await clienteService.canjearPuntos(1, 150, CTX_GRUPO_1);

    expect(result.puntos_canjeados).toBe(150);
    expect(result.saldo_actual).toBe(50);
    const puntoArgs = repo.registrarPuntos.mock.calls[0][0];
    expect(puntoArgs.puntos).toBe(-150);
    expect(puntoArgs.tipo).toBe('canjeado');
    expect(puntoArgs.saldo_antes).toBe(200);
    expect(puntoArgs.saldo_despues).toBe(50);
    expect(repo.actualizarPuntos).toHaveBeenCalledWith(1, 50);
  });

  it('permite canjear el saldo exacto', async () => {
    repo.findByIdScoped.mockResolvedValueOnce({ ...mockCliente, puntos_acumulados: 100 });
    repo.registrarPuntos.mockResolvedValue({});
    repo.actualizarPuntos.mockResolvedValue({});

    const result = await clienteService.canjearPuntos(1, 100, CTX_GRUPO_1);
    expect(result.saldo_actual).toBe(0);
  });

  it('lanza BadRequestError cuando los puntos son insuficientes', async () => {
    repo.findByIdScoped.mockResolvedValueOnce({ ...mockCliente, puntos_acumulados: 50 });

    await expect(clienteService.canjearPuntos(1, 100, CTX_GRUPO_1))
      .rejects.toThrow(BadRequestError);
    expect(repo.registrarPuntos).not.toHaveBeenCalled();
  });

  it('el mensaje de error incluye los puntos disponibles y requeridos', async () => {
    repo.findByIdScoped.mockResolvedValueOnce({ ...mockCliente, puntos_acumulados: 30 });

    await expect(clienteService.canjearPuntos(1, 80, CTX_GRUPO_1))
      .rejects.toMatchObject({ message: expect.stringContaining('30') });
  });

  it('usa descripción por defecto si no se proporciona', async () => {
    repo.findByIdScoped.mockResolvedValueOnce({ ...mockCliente, puntos_acumulados: 100 });
    repo.registrarPuntos.mockResolvedValue({});
    repo.actualizarPuntos.mockResolvedValue({});

    await clienteService.canjearPuntos(1, 50, CTX_GRUPO_1);

    const puntoArgs = repo.registrarPuntos.mock.calls[0][0];
    expect(puntoArgs.descripcion).toBe('Canje de puntos');
  });

  it('usa descripción personalizada si se proporciona', async () => {
    repo.findByIdScoped.mockResolvedValueOnce({ ...mockCliente, puntos_acumulados: 100 });
    repo.registrarPuntos.mockResolvedValue({});
    repo.actualizarPuntos.mockResolvedValue({});

    await clienteService.canjearPuntos(1, 50, CTX_GRUPO_1, 'Descuento cumpleaños');

    const puntoArgs = repo.registrarPuntos.mock.calls[0][0];
    expect(puntoArgs.descripcion).toBe('Descuento cumpleaños');
  });

  it('superadmin puede canjear puntos de cualquier cliente', async () => {
    repo.findByIdScoped.mockResolvedValueOnce({ ...mockCliente, puntos_acumulados: 200 });
    repo.registrarPuntos.mockResolvedValue({});
    repo.actualizarPuntos.mockResolvedValue({});

    await expect(clienteService.canjearPuntos(1, 100, CTX_SUPER)).resolves.toBeDefined();
  });
});
