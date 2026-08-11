import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/api', () => ({ default: { post: vi.fn() } }));
vi.mock('../cola', () => ({
  listar: vi.fn(), remover: vi.fn(), marcarIntento: vi.fn(), contar: vi.fn().mockResolvedValue(0),
}));

import api from '../../../services/api';
import { listar, remover, marcarIntento } from '../cola';
import { sincronizarPendientes } from '../sync';

const v = (uuid: string) => ({ client_uuid: uuid, payload: { x: 1 }, fecha: 'f', intentos: 0 });

beforeEach(() => vi.clearAllMocks());

describe('sincronizarPendientes', () => {
  it('envía cada venta y la remueve de la cola al tener éxito', async () => {
    (listar as any).mockResolvedValue([v('a'), v('b')]);
    (api.post as any).mockResolvedValue({ data: { data: {} } });

    const res = await sincronizarPendientes();

    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post).toHaveBeenCalledWith('/ordenes/offline', expect.objectContaining({ x: 1 }));
    expect(remover).toHaveBeenCalledTimes(2);
    expect(res.ok).toBe(2);
  });

  it('ante fallo deja la venta en la cola y marca el intento', async () => {
    (listar as any).mockResolvedValue([v('a')]);
    (api.post as any).mockRejectedValue(new Error('red caída'));

    const res = await sincronizarPendientes();

    expect(remover).not.toHaveBeenCalled();
    expect(marcarIntento).toHaveBeenCalledOnce();
    expect(res.fail).toBe(1);
  });
});
