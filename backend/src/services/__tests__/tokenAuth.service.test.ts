/**
 * Tests de tokenAuthService — emisión y consumo de tokens de un solo uso.
 * Se mockea el repositorio; crypto es real (verificamos que se guarda el HASH).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

vi.mock('../../repositories/tokenAuth.repository', () => ({
  tokenAuthRepository: {
    create:                  vi.fn(),
    findVigenteByHash:       vi.fn(),
    marcarUsado:             vi.fn(),
    invalidarPreviosDelTipo: vi.fn(),
  },
}));

import { tokenAuthService } from '../tokenAuth.service';
import { tokenAuthRepository } from '../../repositories/tokenAuth.repository';
import { BadRequestError } from '../../exceptions/HttpErrors';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

describe('tokenAuthService.emitir', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invalida los previos, guarda solo el HASH y devuelve el token plano (64 hex)', async () => {
    (tokenAuthRepository.create as any).mockResolvedValue({});

    const plano = await tokenAuthService.emitir(7, 'verificacion_email');

    expect(plano).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenAuthRepository.invalidarPreviosDelTipo).toHaveBeenCalledWith(7, 'verificacion_email');

    const arg = (tokenAuthRepository.create as any).mock.calls[0][0];
    expect(arg.id_usuario).toBe(7);
    expect(arg.tipo).toBe('verificacion_email');
    // Se persiste el hash del token plano, nunca el plano.
    expect(arg.token_hash).toBe(sha256(plano));
    expect(arg.token_hash).not.toBe(plano);
    expect(arg.expira_en.getTime()).toBeGreaterThan(Date.now());
  });

  it('reset_password expira antes (1h) que verificacion_email (24h)', async () => {
    (tokenAuthRepository.create as any).mockResolvedValue({});

    await tokenAuthService.emitir(1, 'reset_password');
    const reset = (tokenAuthRepository.create as any).mock.calls[0][0].expira_en.getTime();

    await tokenAuthService.emitir(1, 'verificacion_email');
    const verif = (tokenAuthRepository.create as any).mock.calls[1][0].expira_en.getTime();

    expect(reset).toBeLessThan(verif);
  });
});

describe('tokenAuthService.consumir', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marca usado y devuelve el id_usuario cuando el token es vigente', async () => {
    (tokenAuthRepository.findVigenteByHash as any).mockResolvedValue({ id: 42, id_usuario: 9 });

    const userId = await tokenAuthService.consumir('tok-plano', 'reset_password');

    expect(userId).toBe(9);
    expect(tokenAuthRepository.findVigenteByHash).toHaveBeenCalledWith(sha256('tok-plano'), 'reset_password');
    expect(tokenAuthRepository.marcarUsado).toHaveBeenCalledWith(42);
  });

  it('lanza BadRequestError si el token no existe/está usado/expiró', async () => {
    (tokenAuthRepository.findVigenteByHash as any).mockResolvedValue(null);

    await expect(tokenAuthService.consumir('malo', 'reset_password')).rejects.toThrow(BadRequestError);
    expect(tokenAuthRepository.marcarUsado).not.toHaveBeenCalled();
  });
});
