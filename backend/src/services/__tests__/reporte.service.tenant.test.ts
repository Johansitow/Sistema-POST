/**
 * Tests de scoping multi-tenant para reporte.service
 *
 * Verifica que los reportes "individuales" propagan el tenant al where de
 * Prisma (antes agregaban datos de TODOS los grupos/sedes):
 *   - getValorMerma / getLotesPorVencer / getTendenciasConsumo → id_restaurante
 *   - getTopClientes → id_grupo (Cliente es entidad de grupo)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    lote: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    movimiento: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
    producto: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    cliente: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import prisma from '../../config/database';
import { reporteService } from '../reporte.service';

beforeEach(() => vi.clearAllMocks());

describe('reporteService — scoping por tenant', () => {

  it('getValorMerma filtra los lotes por id_restaurante', async () => {
    await reporteService.getValorMerma({ id_restaurante: 3 });

    const arg = (prisma.lote.findMany as any).mock.calls[0][0];
    expect(arg.where.id_restaurante).toBe(3);
  });

  it('getValorMerma sin sede (superadmin) no agrega el filtro', async () => {
    await reporteService.getValorMerma({});

    const arg = (prisma.lote.findMany as any).mock.calls[0][0];
    expect(arg.where.id_restaurante).toBeUndefined();
  });

  it('getLotesPorVencer filtra por id_restaurante', async () => {
    await reporteService.getLotesPorVencer(30, 5);

    const arg = (prisma.lote.findMany as any).mock.calls[0][0];
    expect(arg.where.id_restaurante).toBe(5);
  });

  it('getTendenciasConsumo filtra ambos periodos de movimientos por id_restaurante', async () => {
    await reporteService.getTendenciasConsumo(7);

    const calls = (prisma.movimiento.groupBy as any).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [arg] of calls) {
      expect(arg.where.id_restaurante).toBe(7);
    }
  });

  it('getTopClientes filtra por id_grupo (entidad de grupo, no de sede)', async () => {
    await reporteService.getTopClientes(10, 2);

    const arg = (prisma.cliente.findMany as any).mock.calls[0][0];
    expect(arg.where.id_grupo).toBe(2);
    expect(arg.take).toBe(10);
  });

  it('getTopClientes sin grupo (superadmin) no agrega el filtro', async () => {
    await reporteService.getTopClientes(10);

    const arg = (prisma.cliente.findMany as any).mock.calls[0][0];
    expect(arg.where.id_grupo).toBeUndefined();
  });
});
