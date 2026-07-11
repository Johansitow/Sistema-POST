/**
 * Tests para facturaService.garantizarPagada
 *
 * Cubre el gap que motivó el fix: al entregar una orden, la factura debe
 * quedar creada (si nunca se generó) y marcada como pagada, sin importar
 * qué ruta de entrega la invoque.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/factura.repository', () => ({
  facturaRepository: {
    findUltima: vi.fn(),
  },
}));

vi.mock('../../lib/numero-generator', () => ({
  generarNumeroFactura: vi.fn(() => 'FAC-000001'),
}));

import { facturaService } from '../factura.service';
import { facturaRepository } from '../../repositories/factura.repository';

describe('facturaService.garantizarPagada', () => {
  const mockTx: any = {
    factura: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    orden:   { findUnique: vi.fn() },
  };

  beforeEach(() => vi.clearAllMocks());

  it('si la factura ya existe, solo la actualiza a pagada (no crea una nueva)', async () => {
    mockTx.factura.findUnique.mockResolvedValue({ id: 7 });

    await facturaService.garantizarPagada(1, mockTx);

    expect(mockTx.factura.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({ estado_factura: 'pagada' }),
    });
    expect(mockTx.factura.create).not.toHaveBeenCalled();
  });

  it('si la factura no existe, la crea desde la orden y luego la marca pagada', async () => {
    mockTx.factura.findUnique.mockResolvedValue(null);
    mockTx.orden.findUnique.mockResolvedValue({
      id: 1, subtotal: 100, impuestos: 19, total: 119, detalles: [],
    });
    (facturaRepository.findUltima as any).mockResolvedValue(null);
    mockTx.factura.create.mockResolvedValue({ id: 9 });

    await facturaService.garantizarPagada(1, mockTx);

    expect(mockTx.factura.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ id_orden: 1, numero_factura: 'FAC-000001' }) })
    );
    expect(mockTx.factura.updateMany).toHaveBeenCalledWith({
      where: { id_orden: 1 },
      data: expect.objectContaining({ estado_factura: 'pagada' }),
    });
  });
});
