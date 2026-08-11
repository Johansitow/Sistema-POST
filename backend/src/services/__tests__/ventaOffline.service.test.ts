/**
 * Tests de ordenService.crearVentaOffline — idempotencia y cierre de venta.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/orden.repository', () => ({
  ordenRepository: {
    findByClientUuid: vi.fn(),
    findById:         vi.fn(),
    findUltima:       vi.fn(),
  },
  includeOrdenCompleta: {},
}));
vi.mock('../factura.service', () => ({ facturaService: { garantizarPagada: vi.fn() } }));
vi.mock('../../repositories/auditoria.repository', () => ({ registrarAuditoria: vi.fn() }));

// Prisma: $transaction ejecuta el callback con un tx mock.
const txMock = {
  pagoOrden:  { create: vi.fn() },
  orden:      { update: vi.fn() },
  ordenSede:  { updateMany: vi.fn() },
};
vi.mock('../../config/database', () => ({
  default: { $transaction: vi.fn((fn: any) => fn(txMock)) },
}));

import { ordenService } from '../orden.service';
import { ordenRepository } from '../../repositories/orden.repository';
import { facturaService } from '../factura.service';
import { TipoOrden } from '@prisma/client';

const repo = ordenRepository as any;

const ventaBase = {
  id_grupo: 1, id_usuario: 10, tipo_orden: TipoOrden.local,
  client_uuid: '11111111-1111-1111-1111-111111111111',
  fecha_apertura: '2026-08-06T14:00:00.000Z',
  sedes: [{ id_restaurante: 1, items: [{ id_producto: 1, cantidad: 2, precio_unitario: 5000 }] }],
  pagos: [{ id_metodo_pago: 1, monto: 10000 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  txMock.pagoOrden.create.mockResolvedValue({});
  txMock.orden.update.mockResolvedValue({});
  txMock.ordenSede.updateMany.mockResolvedValue({});
});

describe('crearVentaOffline', () => {
  it('es idempotente: si ya existe una orden con ese client_uuid, la devuelve sin recrear', async () => {
    repo.findByClientUuid.mockResolvedValue({ id: 99, numero_orden: 'ORD-000099' });
    const crearSpy = vi.spyOn(ordenService, 'crear');

    const res = await ordenService.crearVentaOffline(ventaBase as any);

    expect(res).toMatchObject({ id: 99 });
    expect(crearSpy).not.toHaveBeenCalled();
    expect(txMock.pagoOrden.create).not.toHaveBeenCalled();
  });

  it('crea la venta (offline), registra el pago y la marca entregada', async () => {
    repo.findByClientUuid.mockResolvedValue(null);
    const crearSpy = vi.spyOn(ordenService, 'crear').mockResolvedValue({ id: 5 } as any);
    repo.findById.mockResolvedValue({ id: 5, estado_global: 'ENTREGADA' });

    const res = await ordenService.crearVentaOffline(ventaBase as any);

    // crear se invoca en modo offline (stock best-effort)
    expect(crearSpy).toHaveBeenCalledWith(expect.objectContaining({ offline: true, client_uuid: ventaBase.client_uuid }));
    // registra el pago y cierra la venta
    expect(txMock.pagoOrden.create).toHaveBeenCalledOnce();
    expect(facturaService.garantizarPagada).toHaveBeenCalledWith(5, txMock);
    expect(txMock.orden.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 5 }, data: expect.objectContaining({ estado_global: 'ENTREGADA' }),
    }));
    expect(res).toMatchObject({ id: 5 });
    crearSpy.mockRestore();
  });
});
