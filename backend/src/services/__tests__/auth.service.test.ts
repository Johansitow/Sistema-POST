/**
 * Tests para authService — login, refreshToken, changePassword
 *
 * Se mockean:
 *   - usuarioRepository (DB)
 *   - bcrypt
 *   - jsonwebtoken
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/usuario.repository', () => ({
  usuarioRepository: {
    findByCredencial: vi.fn(),
    findById:         vi.fn(),
    update:           vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash:    vi.fn(),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign:   vi.fn(() => 'mock_token'),
    verify: vi.fn(),
  },
}));

vi.mock('../../config/env', () => ({
  config: {
    jwt: {
      secret:             'test_secret_32chars_xxxxxxxxxxx',
      expiresIn:          '15m',
      refreshSecret:      'test_refresh_secret_32chars_xxxx',
      refreshExpiresIn:   '7d',
    },
  },
}));

// ── Imports después de los mocks ──────────────────────────────────────────────

import { authService } from '../auth.service';
import { usuarioRepository } from '../../repositories/usuario.repository';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, NotFoundError, BadRequestError } from '../../exceptions/HttpErrors';

// ── Fixture ───────────────────────────────────────────────────────────────────

const mockUser = {
  id:              1,
  uuid:            'uuid-123',
  usuario:         'admin',
  email:           'admin@test.com',
  nombre_completo: 'Admin Test',
  password_hash:   'hashed_password',
  rol: {
    id:             1,
    nombre:         'admin',
    es_super_admin: true,
    color:          '#FF0000',
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authService.login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve user + tokens con credenciales válidas', async () => {
    (usuarioRepository.findByCredencial as any).mockResolvedValue(mockUser);
    (bcrypt.compare as any).mockResolvedValue(true);
    (usuarioRepository.update as any).mockResolvedValue({});

    const result = await authService.login('admin', 'password123');

    expect(result.user.usuario).toBe('admin');
    expect(result.tokens.accessToken).toBe('mock_token');
    expect(result.tokens.refreshToken).toBe('mock_token');
    expect(usuarioRepository.update).toHaveBeenCalledWith(1, expect.objectContaining({ ultimo_acceso: expect.any(Date) }));
  });

  it('lanza UnauthorizedError si el usuario no existe', async () => {
    (usuarioRepository.findByCredencial as any).mockResolvedValue(null);

    await expect(authService.login('noexiste', 'pass')).rejects.toThrow(UnauthorizedError);
  });

  it('lanza UnauthorizedError si la contraseña es incorrecta', async () => {
    (usuarioRepository.findByCredencial as any).mockResolvedValue(mockUser);
    (bcrypt.compare as any).mockResolvedValue(false);

    await expect(authService.login('admin', 'wrong')).rejects.toThrow(UnauthorizedError);
  });

  it('no expone si el usuario existe (mismo error para user inexistente y pass incorrecta)', async () => {
    (usuarioRepository.findByCredencial as any).mockResolvedValue(null);
    let errNoUser: Error | undefined;
    try { await authService.login('noexiste', 'pass'); } catch (e: any) { errNoUser = e; }

    (usuarioRepository.findByCredencial as any).mockResolvedValue(mockUser);
    (bcrypt.compare as any).mockResolvedValue(false);
    let errBadPass: Error | undefined;
    try { await authService.login('admin', 'wrong'); } catch (e: any) { errBadPass = e; }

    expect(errNoUser?.message).toBe(errBadPass?.message);
  });
});

describe('authService.refreshToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve tokens nuevos con token válido', async () => {
    (jwt.verify as any).mockReturnValue({ usuario: 'admin' });
    (usuarioRepository.findByCredencial as any).mockResolvedValue(mockUser);

    const tokens = await authService.refreshToken('valid_refresh_token');

    expect(tokens.accessToken).toBe('mock_token');
    expect(tokens.refreshToken).toBe('mock_token');
  });

  it('lanza UnauthorizedError si el token es inválido', async () => {
    (jwt.verify as any).mockImplementation(() => { throw new Error('invalid'); });

    await expect(authService.refreshToken('bad_token')).rejects.toThrow(UnauthorizedError);
  });

  it('lanza UnauthorizedError si el usuario ya no existe', async () => {
    (jwt.verify as any).mockReturnValue({ usuario: 'admin' });
    (usuarioRepository.findByCredencial as any).mockResolvedValue(null);

    await expect(authService.refreshToken('valid')).rejects.toThrow(UnauthorizedError);
  });
});

describe('authService.changePassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cambia la contraseña con datos correctos', async () => {
    (usuarioRepository.findById as any).mockResolvedValue({ ...mockUser, usuario: 'admin' });
    (usuarioRepository.findByCredencial as any).mockResolvedValue(mockUser);
    (bcrypt.compare as any).mockResolvedValue(true);
    (bcrypt.hash as any).mockResolvedValue('new_hash');
    (usuarioRepository.update as any).mockResolvedValue({});

    const result = await authService.changePassword(1, 'oldPass', 'newPass123');

    expect(result.message).toBe('Contraseña actualizada correctamente');
    expect(usuarioRepository.update).toHaveBeenCalledWith(1, { password_hash: 'new_hash' });
  });

  it('lanza BadRequestError si la contraseña actual es incorrecta', async () => {
    (usuarioRepository.findById as any).mockResolvedValue({ ...mockUser, usuario: 'admin' });
    (usuarioRepository.findByCredencial as any).mockResolvedValue(mockUser);
    (bcrypt.compare as any).mockResolvedValue(false);

    await expect(authService.changePassword(1, 'wrong', 'newPass')).rejects.toThrow(BadRequestError);
  });

  it('lanza NotFoundError si el usuario no existe', async () => {
    (usuarioRepository.findById as any).mockResolvedValue(null);

    await expect(authService.changePassword(99, 'pass', 'new')).rejects.toThrow(NotFoundError);
  });
});
