/**
 * Tests de emailService — comportamiento FAIL-OPEN sin SMTP configurado.
 * Sin SMTP_HOST, enviarEmail NO debe lanzar ni intentar crear transporter:
 * loguea y retorna { enviado: false }, para no romper el registro/solicitud.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const createTransport = vi.fn();
vi.mock('nodemailer', () => ({ default: { createTransport: (...a: unknown[]) => createTransport(...a) } }));

vi.mock('../../config/env', () => ({
  config: {
    smtp: { host: undefined, port: 587, user: undefined, pass: undefined, from: 'Krezco <no-reply@krezco.app>', secure: false },
  },
}));

const warn = vi.fn();
vi.mock('../../config/logger', () => ({ default: { warn: (...a: unknown[]) => warn(...a), error: vi.fn(), info: vi.fn() } }));

import { emailService, plantillaVerificacion, plantillaReset } from '../email.service';

beforeEach(() => vi.clearAllMocks());

describe('emailService sin SMTP (fail-open)', () => {
  it('no lanza, no crea transporter y retorna enviado:false', async () => {
    const res = await emailService.enviarEmail({ to: 'a@a.com', subject: 'Hola', html: '<b>hi</b>' });

    expect(res.enviado).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled(); // logueó el aviso (con el enlace para dev)
  });
});

describe('plantillas', () => {
  it('incluyen la URL del enlace', () => {
    expect(plantillaVerificacion('Ana', 'http://x/verificar-email?token=abc')).toContain('verificar-email?token=abc');
    expect(plantillaReset('Ana', 'http://x/restablecer-password?token=xyz')).toContain('restablecer-password?token=xyz');
  });
});
