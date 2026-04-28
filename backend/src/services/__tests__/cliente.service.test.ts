/**
 * Tests para clienteService
 *
 * Cubre:
 *   - crear: unicidad email/documento, puntos de bienvenida
 *   - actualizar: unicidad excluyendo el cliente actual
 *   - canjearPuntos: saldo suficiente / insuficiente / exacto, registro correcto
 *   - obtenerPorId: found / not found
 *   - cambiarEstado: delega al repo
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/cliente.repository', () => ({
  clienteRepository: {
    findAll:           vi.fn(),
    findById:          vi.fn(),
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
import { ConflictError, NotFoundError, BadRequestError } from '../../exceptions/HttpErrors';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockCliente = {
  id:                 1,
  nombre:             'Ana García',
  email:              'ana@test.com',
  numero_documento:   '12345678',
  puntos_acumulados:  200,
  estado:             'activo',
  tipo_cliente:       'regular',
};

const makeCreateDTO = (overrides: Record<string, any> = {}): any => ({
  nombre_completo:  'Nuevo Cliente',
  tipo_documento:   'cc',
  tipo_cliente:     'regular',
  puntos_bienvenida: false,
  email:            'nuevo@test.com',
  numero_documento: '99999999',
  ...overrides,
});

// ── obtenerPorId ──────────────────────────────────────────────────────────────

describe('clienteService.obtenerPorId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna el cliente si existe', async () => {
    (clienteRepository.findById as any).mockResolvedValue(mockCliente);
    const result = await clienteService.obtenerPorId(1);
    expect(result.id).toBe(1);
  });

  it('lanza NotFoundError si el cliente no existe', async () => {
    (clienteRepository.findById as any).mockResolvedValue(null);
    await expect(clienteService.obtenerPorId(999)).rejects.toThrow(NotFoundError);
  });
});

// ── crear ─────────────────────────────────────────────────────────────────────

describe('clienteService.crear', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea cliente exitosamente sin puntos de bienvenida', async () => {
    (clienteRepository.findByEmail as any).mockResolvedValue(null);
    (clienteRepository.findByDocumento as any).mockResolvedValue(null);
    (clienteRepository.create as any).mockResolvedValue({ id: 2 });
    (clienteRepository.findById as any).mockResolvedValue({ ...mockCliente, id: 2 });

    await clienteService.crear(makeCreateDTO());

    expect(clienteRepository.create).toHaveBeenCalledOnce();
    expect(clienteRepository.registrarPuntos).not.toHaveBeenCalled();
    expect(clienteRepository.actualizarPuntos).not.toHaveBeenCalled();
  });

  it('registra 100 puntos de bienvenida cuando se solicita', async () => {
    (clienteRepository.findByEmail as any).mockResolvedValue(null);
    (clienteRepository.findByDocumento as any).mockResolvedValue(null);
    (clienteRepository.create as any).mockResolvedValue({ id: 3 });
    (clienteRepository.findById as any).mockResolvedValue({ ...mockCliente, id: 3, puntos_acumulados: 100 });

    await clienteService.crear(makeCreateDTO({ puntos_bienvenida: true }));

    expect(clienteRepository.registrarPuntos).toHaveBeenCalledOnce();
    const puntoArgs = (clienteRepository.registrarPuntos as any).mock.calls[0][0];
    expect(puntoArgs.puntos).toBe(100);
    expect(puntoArgs.tipo).toBe('bienvenida');
    expect(puntoArgs.saldo_antes).toBe(0);
    expect(puntoArgs.saldo_despues).toBe(100);

    expect(clienteRepository.actualizarPuntos).toHaveBeenCalledWith(3, 100);
  });

  it('lanza ConflictError si el email ya está registrado', async () => {
    (clienteRepository.findByEmail as any).mockResolvedValue(mockCliente);

    await expect(clienteService.crear(makeCreateDTO({ email: 'ana@test.com' })))
      .rejects.toThrow(ConflictError);
    expect(clienteRepository.create).not.toHaveBeenCalled();
  });

  it('lanza ConflictError si el número de documento ya está registrado', async () => {
    (clienteRepository.findByEmail as any).mockResolvedValue(null);
    (clienteRepository.findByDocumento as any).mockResolvedValue(mockCliente);

    await expect(clienteService.crear(makeCreateDTO({ numero_documento: '12345678' })))
      .rejects.toThrow(ConflictError);
    expect(clienteRepository.create).not.toHaveBeenCalled();
  });

  it('omite verificación de email si no se proporciona', async () => {
    (clienteRepository.findByDocumento as any).mockResolvedValue(null);
    (clienteRepository.create as any).mockResolvedValue({ id: 4 });
    (clienteRepository.findById as any).mockResolvedValue({ ...mockCliente, id: 4 });

    await clienteService.crear(makeCreateDTO({ email: undefined }));

    expect(clienteRepository.findByEmail).not.toHaveBeenCalled();
    expect(clienteRepository.create).toHaveBeenCalledOnce();
  });

  it('omite verificación de documento si no se proporciona', async () => {
    (clienteRepository.findByEmail as any).mockResolvedValue(null);
    (clienteRepository.create as any).mockResolvedValue({ id: 5 });
    (clienteRepository.findById as any).mockResolvedValue({ ...mockCliente, id: 5 });

    await clienteService.crear(makeCreateDTO({ numero_documento: undefined }));

    expect(clienteRepository.findByDocumento).not.toHaveBeenCalled();
    expect(clienteRepository.create).toHaveBeenCalledOnce();
  });
});

// ── actualizar ────────────────────────────────────────────────────────────────

describe('clienteService.actualizar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza ConflictError si el email ya pertenece a otro cliente', async () => {
    (clienteRepository.findById as any).mockResolvedValue(mockCliente);        // cliente actual existe
    (clienteRepository.findByEmail as any).mockResolvedValue({ id: 99, email: 'otro@test.com' }); // otro cliente con ese email

    await expect(clienteService.actualizar(1, { email: 'otro@test.com' }))
      .rejects.toThrow(ConflictError);
    expect(clienteRepository.update).not.toHaveBeenCalled();
  });

  it('pasa excludeId correcto a findByEmail para evitar falso conflicto con el propio email', async () => {
    (clienteRepository.findById as any).mockResolvedValue(mockCliente);
    (clienteRepository.findByEmail as any).mockResolvedValue(null); // ningún OTRO cliente tiene ese email
    (clienteRepository.findByDocumento as any).mockResolvedValue(null);
    (clienteRepository.update as any).mockResolvedValue({});
    (clienteRepository.findById as any).mockResolvedValue(mockCliente);

    await clienteService.actualizar(1, { email: 'ana@test.com' });

    expect(clienteRepository.findByEmail).toHaveBeenCalledWith('ana@test.com', 1); // excludeId = 1
    expect(clienteRepository.update).toHaveBeenCalledOnce();
  });

  it('lanza ConflictError si el número de documento ya pertenece a otro cliente', async () => {
    (clienteRepository.findById as any).mockResolvedValue(mockCliente);
    (clienteRepository.findByEmail as any).mockResolvedValue(null);
    (clienteRepository.findByDocumento as any).mockResolvedValue({ id: 99 });

    await expect(clienteService.actualizar(1, { numero_documento: '99999999' }))
      .rejects.toThrow(ConflictError);
  });

  it('lanza NotFoundError si el cliente no existe', async () => {
    (clienteRepository.findById as any).mockResolvedValue(null);

    await expect(clienteService.actualizar(999, { nombre_completo: 'X' })).rejects.toThrow(NotFoundError);
  });
});

// ── canjearPuntos ─────────────────────────────────────────────────────────────

describe('clienteService.canjearPuntos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('canjea puntos correctamente cuando el saldo es suficiente', async () => {
    (clienteRepository.findById as any).mockResolvedValue({ ...mockCliente, puntos_acumulados: 200 });
    (clienteRepository.registrarPuntos as any).mockResolvedValue({});
    (clienteRepository.actualizarPuntos as any).mockResolvedValue({});

    const result = await clienteService.canjearPuntos(1, 150);

    expect(result.puntos_canjeados).toBe(150);
    expect(result.saldo_actual).toBe(50); // 200 - 150

    const puntoArgs = (clienteRepository.registrarPuntos as any).mock.calls[0][0];
    expect(puntoArgs.puntos).toBe(-150);           // negativo = salida
    expect(puntoArgs.tipo).toBe('canjeado');
    expect(puntoArgs.saldo_antes).toBe(200);
    expect(puntoArgs.saldo_despues).toBe(50);

    expect(clienteRepository.actualizarPuntos).toHaveBeenCalledWith(1, 50);
  });

  it('permite canjear el saldo exacto (saldo == puntos requeridos)', async () => {
    (clienteRepository.findById as any).mockResolvedValue({ ...mockCliente, puntos_acumulados: 100 });
    (clienteRepository.registrarPuntos as any).mockResolvedValue({});
    (clienteRepository.actualizarPuntos as any).mockResolvedValue({});

    const result = await clienteService.canjearPuntos(1, 100);

    expect(result.saldo_actual).toBe(0);
    expect(clienteRepository.actualizarPuntos).toHaveBeenCalledWith(1, 0);
  });

  it('lanza BadRequestError cuando los puntos son insuficientes', async () => {
    (clienteRepository.findById as any).mockResolvedValue({ ...mockCliente, puntos_acumulados: 50 });

    await expect(clienteService.canjearPuntos(1, 100)).rejects.toThrow(BadRequestError);

    expect(clienteRepository.registrarPuntos).not.toHaveBeenCalled();
    expect(clienteRepository.actualizarPuntos).not.toHaveBeenCalled();
  });

  it('el mensaje de error incluye los puntos disponibles y requeridos', async () => {
    (clienteRepository.findById as any).mockResolvedValue({ ...mockCliente, puntos_acumulados: 30 });

    await expect(clienteService.canjearPuntos(1, 80)).rejects.toMatchObject({
      message: expect.stringContaining('30'),
    });
  });

  it('lanza NotFoundError si el cliente no existe', async () => {
    (clienteRepository.findById as any).mockResolvedValue(null);

    await expect(clienteService.canjearPuntos(999, 10)).rejects.toThrow(NotFoundError);
  });

  it('usa descripción por defecto si no se proporciona', async () => {
    (clienteRepository.findById as any).mockResolvedValue({ ...mockCliente, puntos_acumulados: 100 });
    (clienteRepository.registrarPuntos as any).mockResolvedValue({});
    (clienteRepository.actualizarPuntos as any).mockResolvedValue({});

    await clienteService.canjearPuntos(1, 50);

    const puntoArgs = (clienteRepository.registrarPuntos as any).mock.calls[0][0];
    expect(puntoArgs.descripcion).toBe('Canje de puntos');
  });

  it('usa descripción personalizada si se proporciona', async () => {
    (clienteRepository.findById as any).mockResolvedValue({ ...mockCliente, puntos_acumulados: 100 });
    (clienteRepository.registrarPuntos as any).mockResolvedValue({});
    (clienteRepository.actualizarPuntos as any).mockResolvedValue({});

    await clienteService.canjearPuntos(1, 50, 'Descuento cumpleaños');

    const puntoArgs = (clienteRepository.registrarPuntos as any).mock.calls[0][0];
    expect(puntoArgs.descripcion).toBe('Descuento cumpleaños');
  });
});

// ── cambiarEstado ─────────────────────────────────────────────────────────────

describe('clienteService.cambiarEstado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza NotFoundError si el cliente no existe', async () => {
    (clienteRepository.findById as any).mockResolvedValue(null);

    await expect(clienteService.cambiarEstado(999, 'inactivo')).rejects.toThrow(NotFoundError);
    expect(clienteRepository.update).not.toHaveBeenCalled();
  });

  it('llama update con el nuevo estado', async () => {
    (clienteRepository.findById as any)
      .mockResolvedValueOnce(mockCliente)   // obtenerPorId
      .mockResolvedValueOnce({ ...mockCliente, estado: 'inactivo' }); // retorno final
    (clienteRepository.update as any).mockResolvedValue({});

    await clienteService.cambiarEstado(1, 'inactivo');

    expect(clienteRepository.update).toHaveBeenCalledWith(1, { estado: 'inactivo' });
  });
});
