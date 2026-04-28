import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({
  default: {
    get:  vi.fn(),
    post: vi.fn(),
  },
}));

import { cierreCajaService } from '../services/servicios-operacion';
import api from '../services/api';

const mock = api as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

const cierreRaw = {
  id:             1,
  numero_cierre:  'CC-000001',
  fecha_apertura: '2026-03-22T08:00:00Z',
  fecha_cierre:   '2026-03-22T22:00:00Z',
  monto_inicial:  '100000',   // llega como string desde Prisma (Decimal)
  monto_final:    '95000',
  total_ventas:   '250000',
  total_efectivo: '95000',
  diferencia:     '0',
  estado:         'completado',
};

beforeEach(() => vi.clearAllMocks());

// ── getAll ────────────────────────────────────────────────────────────────────

describe('getAll', () => {
  it('parsea los campos Decimal a Number', async () => {
    mock.get.mockResolvedValueOnce({
      data: { data: [cierreRaw], meta: { total: 1 } },
    });

    const { data } = await cierreCajaService.getAll();
    const c = data[0];

    expect(typeof c.monto_inicial).toBe('number');
    expect(c.monto_inicial).toBe(100000);
    expect(c.monto_final).toBe(95000);
    expect(c.diferencia).toBe(0);
  });

  it('retorna array vacío si data viene null', async () => {
    mock.get.mockResolvedValueOnce({ data: { data: null, meta: {} } });
    const { data } = await cierreCajaService.getAll();
    expect(data).toHaveLength(0);
  });

  it('pasa parámetros de filtro', async () => {
    mock.get.mockResolvedValueOnce({ data: { data: [], meta: {} } });
    await cierreCajaService.getAll({ estado: 'completado', fecha_desde: '2026-03-01' });
    expect(mock.get).toHaveBeenCalledWith('/caja/cierres', {
      params: { estado: 'completado', fecha_desde: '2026-03-01' },
    });
  });
});

// ── getById ───────────────────────────────────────────────────────────────────

describe('getById', () => {
  it('parsea el cierre individual', async () => {
    mock.get.mockResolvedValueOnce({ data: { data: cierreRaw } });
    const c = await cierreCajaService.getById(1);
    expect(c.total_ventas).toBe(250000);
    expect(c.numero_cierre).toBe('CC-000001');
  });
});

// ── iniciar ───────────────────────────────────────────────────────────────────

describe('iniciar', () => {
  it('envía POST a /caja/cierres/iniciar', async () => {
    mock.post.mockResolvedValueOnce({
      data: { data: { ...cierreRaw, estado: 'en_proceso' } },
    });

    const result = await cierreCajaService.iniciar({
      fecha_apertura: '2026-03-22T08:00:00Z',
      monto_inicial:  100000,
    });

    expect(result.estado).toBe('en_proceso');
    expect(mock.post).toHaveBeenCalledWith('/caja/cierres/iniciar', {
      fecha_apertura: '2026-03-22T08:00:00Z',
      monto_inicial:  100000,
    });
  });
});

// ── confirmar ─────────────────────────────────────────────────────────────────

describe('confirmar', () => {
  it('envía POST a /caja/cierres/:id/confirmar', async () => {
    mock.post.mockResolvedValueOnce({
      data: { data: { ...cierreRaw, estado: 'completado', diferencia: '-5000' } },
    });

    const result = await cierreCajaService.confirmar(1, {
      monto_final: 95000,
      justificacion: 'Diferencia menor',
    });

    expect(result.diferencia).toBe(-5000);
    expect(mock.post).toHaveBeenCalledWith('/caja/cierres/1/confirmar', {
      monto_final: 95000,
      justificacion: 'Diferencia menor',
    });
  });
});
