/**
 * Tests de secretBox — cifrado AES-256-GCM de secretos por tenant.
 */

import { describe, it, expect, vi } from 'vitest';

// Inyecta una llave de cifrado sin depender del .env.
vi.mock('../../../config/env', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../config/env')>();
  return { ...mod, config: { ...mod.config, facturacion: { ...mod.config.facturacion, encryptionKey: 'llave-de-prueba-para-cifrado-secretbox-123' } } };
});

import { cifrar, descifrar } from '../secretBox';

describe('secretBox', () => {
  it('cifrar → descifrar devuelve el texto original', () => {
    const plano = JSON.stringify({ clientId: 'abc', password: 's3cr3t' });
    const cifrado = cifrar(plano);
    expect(cifrado).not.toContain('s3cr3t');       // no queda en claro
    expect(descifrar(cifrado)).toBe(plano);
  });

  it('cada cifrado usa un IV distinto (no determinista)', () => {
    expect(cifrar('hola')).not.toBe(cifrar('hola'));
  });

  it('un texto cifrado alterado falla la autenticación (tag GCM)', () => {
    const cifrado = cifrar('dato sensible');
    const alterado = cifrado.slice(0, -4) + (cifrado.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
    expect(() => descifrar(alterado)).toThrow();
  });
});
