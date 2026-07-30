/**
 * Tests de authService — verificación de correo y recuperación de contraseña.
 * Mockea repositorio, tokenAuthService, emailService, redis(cacheDel), env y bcrypt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/usuario.repository', () => ({
  usuarioRepository: {
    findById:  vi.fn(),
    findByEmail: vi.fn(),
    update:    vi.fn(),
    // usados por otros métodos del service al importar el módulo
    findByCredencial: vi.fn(),
  },
}));

vi.mock('../tokenAuth.service', () => ({
  tokenAuthService: { emitir: vi.fn(), consumir: vi.fn() },
}));

const enviarEmail = vi.fn();
vi.mock('../email.service', () => ({
  emailService: { enviarEmail: (m: unknown) => enviarEmail(m) },
  plantillaVerificacion: () => '<html>verif</html>',
  plantillaReset:        () => '<html>reset</html>',
}));

vi.mock('../../config/redis', () => ({ cacheDel: vi.fn() }));

vi.mock('../../config/env', () => ({
  config: {
    appUrl: 'http://localhost:5173',
    jwt: { secret: 'x'.repeat(32), expiresIn: '15m', refreshSecret: 'y'.repeat(32), refreshExpiresIn: '7d' },
  },
}));

vi.mock('bcrypt', () => ({ default: { hash: vi.fn(async () => 'nuevo_hash'), compare: vi.fn() } }));

import { authService } from '../auth.service';
import { usuarioRepository } from '../../repositories/usuario.repository';
import { tokenAuthService } from '../tokenAuth.service';
import { cacheDel } from '../../config/redis';

beforeEach(() => {
  vi.clearAllMocks();
  enviarEmail.mockResolvedValue({ enviado: true });
});

describe('authService.verificarEmail', () => {
  it('consume el token, marca verificado e invalida la cache del guard', async () => {
    (tokenAuthService.consumir as any).mockResolvedValue(5);
    (usuarioRepository.update as any).mockResolvedValue({});

    const res = await authService.verificarEmail('tok');

    expect(tokenAuthService.consumir).toHaveBeenCalledWith('tok', 'verificacion_email');
    expect(usuarioRepository.update).toHaveBeenCalledWith(5, expect.objectContaining({ email_verificado: true }));
    expect(cacheDel).toHaveBeenCalledWith('auth:email_verificado:5');
    expect(res.id_usuario).toBe(5);
  });
});

describe('authService.reenviarVerificacion', () => {
  it('no envía nada si el correo ya está verificado (idempotente)', async () => {
    (usuarioRepository.findById as any).mockResolvedValue({ email: 'a@a.com', nombre_completo: 'A', email_verificado: true });

    const res = await authService.reenviarVerificacion(5);

    expect(res.enviado).toBe(false);
    expect(tokenAuthService.emitir).not.toHaveBeenCalled();
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  it('emite token y envía correo si no está verificado', async () => {
    (usuarioRepository.findById as any).mockResolvedValue({ email: 'a@a.com', nombre_completo: 'A', email_verificado: false });
    (tokenAuthService.emitir as any).mockResolvedValue('tok-nuevo');

    const res = await authService.reenviarVerificacion(5);

    expect(res.enviado).toBe(true);
    expect(tokenAuthService.emitir).toHaveBeenCalledWith(5, 'verificacion_email');
    expect(enviarEmail).toHaveBeenCalledTimes(1);
  });
});

describe('authService.solicitarReset (no-enumeración)', () => {
  it('envía el correo si el email existe', async () => {
    (usuarioRepository.findByEmail as any).mockResolvedValue({ id: 3, email: 'a@a.com', nombre_completo: 'A' });
    (tokenAuthService.emitir as any).mockResolvedValue('tok-reset');

    const res = await authService.solicitarReset('a@a.com');

    expect(tokenAuthService.emitir).toHaveBeenCalledWith(3, 'reset_password');
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(res.message).toMatch(/Si el correo está registrado/i);
  });

  it('NO revela cuando el email no existe: mismo mensaje y sin enviar', async () => {
    (usuarioRepository.findByEmail as any).mockResolvedValue(null);

    const res = await authService.solicitarReset('noexiste@a.com');

    expect(tokenAuthService.emitir).not.toHaveBeenCalled();
    expect(enviarEmail).not.toHaveBeenCalled();
    expect(res.message).toMatch(/Si el correo está registrado/i);
  });
});

describe('authService.confirmarReset', () => {
  it('consume el token y guarda el nuevo hash', async () => {
    (tokenAuthService.consumir as any).mockResolvedValue(8);
    (usuarioRepository.update as any).mockResolvedValue({});

    const res = await authService.confirmarReset('tok', 'NuevaClave1');

    expect(tokenAuthService.consumir).toHaveBeenCalledWith('tok', 'reset_password');
    expect(usuarioRepository.update).toHaveBeenCalledWith(8, { password_hash: 'nuevo_hash' });
    expect(res.id_usuario).toBe(8);
  });
});
