import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db', () => ({
  put: vi.fn().mockResolvedValue(undefined),
  getAll: vi.fn().mockResolvedValue([]),
  del: vi.fn().mockResolvedValue(undefined),
  count: vi.fn().mockResolvedValue(0),
}));

import * as db from '../db';
import { encolar, remover, contar } from '../cola';

const venta = { client_uuid: 'u1', payload: {}, fecha: '2026-08-06', intentos: 0 };

beforeEach(() => vi.clearAllMocks());

describe('cola offline', () => {
  it('encolar guarda en la DB y notifica cambio', async () => {
    const spy = vi.fn();
    window.addEventListener('offline-cola', spy);
    await encolar(venta);
    expect(db.put).toHaveBeenCalledWith(venta);
    expect(spy).toHaveBeenCalled();
    window.removeEventListener('offline-cola', spy);
  });

  it('remover borra por uuid y notifica', async () => {
    await remover('u1');
    expect(db.del).toHaveBeenCalledWith('u1');
  });

  it('contar delega en la DB', async () => {
    (db.count as any).mockResolvedValue(3);
    expect(await contar()).toBe(3);
  });
});
