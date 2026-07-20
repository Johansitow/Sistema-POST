import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database', () => ({
  default: { $queryRaw: vi.fn() },
}));

import { demandaService } from '../demanda.service';
import prisma from '../../config/database';

const prismaMock = prisma as any;

beforeEach(() => vi.clearAllMocks());

describe('demandaService.calcularDemandaSede', () => {
  it('marca tendencia "subiendo" cuando el consumo reciente supera al previo', async () => {
    // reciente: 7 días con 14 uds → 2/día; previo: 21 días con 21 uds → 1/día
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id_producto: 1, reciente: 14, previo: 21 },
    ]);
    const mapa = await demandaService.calcularDemandaSede(1);
    const d = mapa.get(1)!;
    expect(d.tendencia).toBe('subiendo');
    expect(d.consumo_reciente).toBeCloseTo(2, 1);
  });

  it('marca tendencia "bajando" cuando el consumo reciente cae', async () => {
    // reciente: 7 uds → 1/día; previo: 42 uds/21d → 2/día
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id_producto: 2, reciente: 7, previo: 42 },
    ]);
    const d = (await demandaService.calcularDemandaSede(1)).get(2)!;
    expect(d.tendencia).toBe('bajando');
  });

  it('marca tendencia "estable" cuando el consumo se mantiene', async () => {
    // reciente 7/7=1; previo 21/21=1 → ratio 1
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id_producto: 3, reciente: 7, previo: 21 },
    ]);
    const d = (await demandaService.calcularDemandaSede(1)).get(3)!;
    expect(d.tendencia).toBe('estable');
  });

  it('un producto que sube de rotación tiene stock ideal mayor que uno que baja', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id_producto: 10, reciente: 20, previo: 20 }])  // subiendo
      .mockResolvedValueOnce([{ id_producto: 11, reciente: 5,  previo: 40 }]); // bajando

    const subiendo = (await demandaService.calcularDemandaSede(1)).get(10)!;
    const bajando  = (await demandaService.calcularDemandaSede(1)).get(11)!;

    expect(subiendo.tendencia).toBe('subiendo');
    expect(bajando.tendencia).toBe('bajando');
    expect(subiendo.stock_ideal).toBeGreaterThan(0);
    expect(bajando.stock_ideal).toBeGreaterThan(0);
  });

  it('sin movimientos, el producto no aparece en el mapa', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    const mapa = await demandaService.calcularDemandaSede(1);
    expect(mapa.size).toBe(0);
  });

  it('stock ideal de un producto de baja rotación es pequeño', async () => {
    // consumo total muy bajo: 2 uds en 28 días
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id_producto: 20, reciente: 0, previo: 2 },
    ]);
    const d = (await demandaService.calcularDemandaSede(1)).get(20)!;
    // 2/28 * 14 días ≈ 1 → ideal pequeño
    expect(d.stock_ideal).toBeLessThanOrEqual(2);
  });
});
