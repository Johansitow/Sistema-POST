import { describe, it, expect } from 'vitest';
import { envSchema, DEV_SUPER_ADMIN_UUID } from '../env.schema';

// Variables mínimas válidas para que el schema pase (NODE_ENV cae a 'development').
const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

describe('envSchema', () => {
  it('JWT_EXPIRES_IN por defecto es 15m (alineado con .env.example)', () => {
    const parsed = envSchema.parse(base);
    expect(parsed.JWT_EXPIRES_IN).toBe('15m');
  });

  it('en desarrollo permite omitir SUPER_ADMIN_UUID', () => {
    const res = envSchema.safeParse(base);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.SUPER_ADMIN_UUID).toBeUndefined();
  });

  it('en producción FALLA si falta SUPER_ADMIN_UUID', () => {
    const res = envSchema.safeParse({ ...base, NODE_ENV: 'production' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.includes('SUPER_ADMIN_UUID'))).toBe(true);
    }
  });

  it('en producción PASA con un SUPER_ADMIN_UUID válido', () => {
    const res = envSchema.safeParse({
      ...base,
      NODE_ENV: 'production',
      SUPER_ADMIN_UUID: VALID_UUID,
    });
    expect(res.success).toBe(true);
  });

  it('rechaza un SUPER_ADMIN_UUID que no es UUID', () => {
    const res = envSchema.safeParse({ ...base, SUPER_ADMIN_UUID: 'no-es-uuid' });
    expect(res.success).toBe(false);
  });

  it('el UUID de desarrollo es un UUID válido', () => {
    const res = envSchema.safeParse({ ...base, SUPER_ADMIN_UUID: DEV_SUPER_ADMIN_UUID });
    expect(res.success).toBe(true);
  });
});
