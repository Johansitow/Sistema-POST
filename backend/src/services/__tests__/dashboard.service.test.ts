import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EstadoGeneral } from '@prisma/client';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/orden.repository', () => ({
  ordenRepository: {
    countHoy:          vi.fn(),
    aggregateVentasHoy: vi.fn(),
    groupByFechaSemana: vi.fn(),
    topProductos:       vi.fn(),
    groupByFecha:       vi.fn(),
    findAlertasInventario: vi.fn(),
  },
}));

vi.mock('../../repositories/producto.repository', () => ({
  productoRepository: {
    count:          vi.fn(),
    countByEstado:  vi.fn(),
    findActivos:    vi.fn(),
  },
}));

const mockEstadoOrden = { id: 5, codigo: 'ENTREGADA' };

vi.mock('../../config/database', () => ({
  default: {
    estadoOrden: {
      findFirst: vi.fn(),
    },
    producto: {
      findMany: vi.fn(),
    },
  },
}));

// ── Imports DESPUÉS de los mocks ───────────────────────────────────────────────

import { dashboardService } from '../dashboard.service';
import { ordenRepository }   from '../../repositories/orden.repository';
import { productoRepository } from '../../repositories/producto.repository';
import prisma from '../../config/database';

const ordRepo  = ordenRepository  as ReturnType<typeof vi.fn> & typeof ordenRepository;
const prodRepo = productoRepository as ReturnType<typeof vi.fn> & typeof productoRepository;
const prismaMock = prisma as any;

const mockProductoActivo = {
  id: 1, nombre: 'Harina', estado: EstadoGeneral.activo,
  stock_actual: 5, stock_minimo: 10, // stock bajo
};

beforeEach(() => vi.clearAllMocks());

// ── getStats ─────────────────────────────────────────────────────────────────

describe('getStats', () => {
  const setupMocks = () => {
    prismaMock.estadoOrden.findFirst.mockResolvedValue(mockEstadoOrden);
    (prodRepo.count as ReturnType<typeof vi.fn>).mockResolvedValue(50);
    (ordRepo.countHoy as ReturnType<typeof vi.fn>).mockResolvedValue(8);
    (prodRepo.countByEstado as ReturnType<typeof vi.fn>).mockResolvedValue(45);
    (ordRepo.aggregateVentasHoy as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: { total: 1200000 } });
    (ordRepo.groupByFechaSemana as ReturnType<typeof vi.fn>).mockResolvedValue([
      { fecha_apertura: new Date(), _sum: { total: 200000 } },
    ]);
    (prodRepo.findActivos as ReturnType<typeof vi.fn>).mockResolvedValue([mockProductoActivo]);
    (ordRepo.topProductos as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id_producto: 1, _sum: { cantidad: 20, subtotal: 500000 } },
    ]);
    prismaMock.producto.findMany.mockResolvedValue([{ id: 1, nombre: 'Harina' }]);
  };

  it('devuelve estructura completa de stats', async () => {
    setupMocks();
    const stats = await dashboardService.getStats();

    expect(stats.productos).toBe(50);
    expect(stats.ordenesHoy).toBe(8);
    expect(stats.productosActivos).toBe(45);
    expect(stats.ventasHoy).toBe(1200000);
    expect(stats.alertas).toBe(1); // 1 producto con stock bajo
    expect(stats.stockBajo).toHaveLength(1);
    expect(stats.ventasSemana).toHaveLength(1);
    expect(stats.topProductos).toHaveLength(1);
    expect(stats.topProductos[0].nombre).toBe('Harina');
  });

  it('devuelve alertas=0 si todos los productos tienen stock suficiente', async () => {
    setupMocks();
    (prodRepo.findActivos as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...mockProductoActivo, stock_actual: 100, stock_minimo: 10 }, // stock OK
    ]);

    const stats = await dashboardService.getStats();
    expect(stats.alertas).toBe(0);
    expect(stats.stockBajo).toHaveLength(0);
  });

  it('maneja estado ENTREGADA no encontrado (id=0)', async () => {
    prismaMock.estadoOrden.findFirst.mockResolvedValue(null); // no hay estado
    (prodRepo.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (ordRepo.countHoy as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prodRepo.countByEstado as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (ordRepo.aggregateVentasHoy as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: { total: null } });
    (ordRepo.groupByFechaSemana as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prodRepo.findActivos as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (ordRepo.topProductos as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    prismaMock.producto.findMany.mockResolvedValue([]);

    const stats = await dashboardService.getStats();
    expect(stats.ventasHoy).toBe(0);
    expect(stats.topProductos).toHaveLength(0);
  });
});

// ── getResumenVentas ──────────────────────────────────────────────────────────

describe('getResumenVentas', () => {
  it('devuelve resumen de ventas mapeado', async () => {
    prismaMock.estadoOrden.findFirst.mockResolvedValue(mockEstadoOrden);
    (ordRepo.groupByFecha as ReturnType<typeof vi.fn>).mockResolvedValue([
      { fecha_apertura: new Date('2026-03-20'), tipo_orden: 'mesa', _sum: { total: 500000 }, _count: { id: 5 } },
    ]);

    const result = await dashboardService.getResumenVentas(7);

    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(500000);
  });
});
