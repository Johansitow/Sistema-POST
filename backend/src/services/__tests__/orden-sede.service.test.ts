/**
 * Tests para ordenSedeService — tenant guard (Oleada 2a)
 *
 * Cubre:
 *   - avanzarEstado: ForbiddenError (sin tenant), NotFoundError (IDOR cross-tenant),
 *     superadmin bypass, caso feliz + saga sigue recalculando estado_global
 *   - cancelar: mismos tres casos de guard + caso feliz
 *   - actualizarItem: item no encontrado, IDOR via sede padre, superadmin, caso feliz
 *   - eliminarItem: IDOR via sede padre, caso feliz
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EstadoOrdenSede, EstadoOrdenGlobal } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { TenantCtx } from '../../lib/tenantCtx';
import { ForbiddenError, NotFoundError } from '../../exceptions/HttpErrors';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/orden-sede.repository', () => ({
  ordenSedeRepository: {
    findById:        vi.fn(),
    findByIdScoped:  vi.fn(),
    findActivas:     vi.fn(),
    updateEstado:    vi.fn(),
    todasListas:     vi.fn(),
    recalcularTotales: vi.fn(),
    findItemById:    vi.fn(),
    findItemsBySede: vi.fn(),
    createItem:      vi.fn(),
    updateItem:      vi.fn(),
    deleteItem:      vi.fn(),
    deleteItemsBySede: vi.fn(),
    updateTotales:   vi.fn(),
  },
}));

vi.mock('../../repositories/orden.repository', () => ({
  ordenRepository: {
    findById:          vi.fn(),
    updateEstadoGlobal: vi.fn(),
    registrarEvento:   vi.fn(),
  },
}));

vi.mock('../../repositories/configuracion.repository', () => ({
  configuracionRepository: {
    findByClave:  vi.fn(),
    parseValor:   vi.fn(),
  },
}));

vi.mock('../../services/receta.service', () => ({
  recetaService: {
    verificarDisponibilidadParaDetalles: vi.fn(),
  },
}));

vi.mock('../../events/eventBus', () => ({
  eventBus: { emit: vi.fn() },
}));

vi.mock('../../config/database', () => ({ default: { $transaction: vi.fn() } }));

// ── Importaciones después de los mocks ───────────────────────────────────────

import { ordenSedeService } from '../orden-sede.service';
import { ordenSedeRepository } from '../../repositories/orden-sede.repository';
import { ordenRepository } from '../../repositories/orden.repository';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CTX_RESTAURANTE_1: TenantCtx = { restauranteId: 1, grupoId: 10, esSuperAdmin: false };
const CTX_SIN_TENANT:    TenantCtx = { esSuperAdmin: false };
const CTX_SUPERADMIN:    TenantCtx = { esSuperAdmin: true };

const makeSede = (overrides: Record<string, unknown> = {}) => ({
  id:             5,
  id_orden:       100,
  id_restaurante: 1,
  estado:         EstadoOrdenSede.PENDIENTE,
  sufijo:         'A',
  subtotal:       new Decimal('10000'),
  impuestos:      new Decimal('800'),
  total:          new Decimal('10800'),
  restaurante:    { id: 1, nombre: 'Sede A' },
  items:          [],
  ...overrides,
});

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  id:              20,
  id_sede:         5,
  id_producto:     7,
  cantidad:        new Decimal('2'),
  precio_unitario: new Decimal('5000'),
  descuento:       new Decimal('0'),
  subtotal:        new Decimal('10000'),
  total:           new Decimal('10000'),
  notas:           null,
  producto:        { id: 7, nombre: 'Producto X' },
  variante:        null,
  ...overrides,
});

// ── avanzarEstado — tenant guard ─────────────────────────────────────────────

describe('ordenSedeService.avanzarEstado — tenant guard', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lanza ForbiddenError cuando ctx no tiene tenant', async () => {
    (ordenSedeRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new ForbiddenError('Se requiere contexto de restaurante para esta operación'));

    await expect(ordenSedeService.avanzarEstado(5, CTX_SIN_TENANT))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lanza NotFoundError cuando la sede pertenece a otro restaurante (IDOR)', async () => {
    (ordenSedeRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new NotFoundError('Registro 5 no encontrado'));

    await expect(ordenSedeService.avanzarEstado(5, CTX_RESTAURANTE_1))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('superadmin puede avanzar cualquier sede sin restricción de tenant', async () => {
    const sede = makeSede({ id_restaurante: 99 }); // restaurante diferente
    (ordenSedeRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(sede);
    (ordenSedeRepository.updateEstado as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ...sede, estado: EstadoOrdenSede.EN_PREPARACION });
    (ordenRepository.registrarEvento as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (ordenRepository.findById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ estado_global: EstadoOrdenGlobal.RECIBIDA });
    (ordenRepository.updateEstadoGlobal as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await ordenSedeService.avanzarEstado(5, CTX_SUPERADMIN);
    expect(result.estado).toBe(EstadoOrdenSede.EN_PREPARACION);
  });

  it('caso feliz: dueño legítimo avanza su sede y la saga recalcula estado_global', async () => {
    const sedeEnPrep = makeSede({ estado: EstadoOrdenSede.EN_PREPARACION });
    (ordenSedeRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(sedeEnPrep);
    (ordenSedeRepository.updateEstado as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ...sedeEnPrep, estado: EstadoOrdenSede.LISTA });
    (ordenRepository.registrarEvento as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (ordenSedeRepository.todasListas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    (ordenRepository.findById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ estado_global: EstadoOrdenGlobal.EN_PROCESO, numero_orden: 'ORD-001', id_grupo: 10, total: new Decimal('10000') });
    (ordenRepository.updateEstadoGlobal as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await ordenSedeService.avanzarEstado(5, CTX_RESTAURANTE_1);

    expect(result.estado).toBe(EstadoOrdenSede.LISTA);
    // La saga sigue: updateEstadoGlobal fue llamada para marcar la Orden como LISTA
    expect(ordenRepository.updateEstadoGlobal).toHaveBeenCalledWith(100, EstadoOrdenGlobal.LISTA);
  });
});

// ── cancelar — tenant guard ───────────────────────────────────────────────────

describe('ordenSedeService.cancelar — tenant guard', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lanza ForbiddenError cuando ctx no tiene tenant', async () => {
    (ordenSedeRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new ForbiddenError('Se requiere contexto de restaurante para esta operación'));

    await expect(ordenSedeService.cancelar(5, 'motivo', CTX_SIN_TENANT))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lanza NotFoundError cuando la sede pertenece a otro restaurante (IDOR)', async () => {
    (ordenSedeRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new NotFoundError('Registro 5 no encontrado'));

    await expect(ordenSedeService.cancelar(5, 'motivo', CTX_RESTAURANTE_1))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('superadmin puede cancelar cualquier sede', async () => {
    const sede = makeSede({ id_restaurante: 99 });
    (ordenSedeRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(sede);

    // La transacción: simulamos que todo va bien
    const { default: prismaModule } = await import('../../config/database');
    (prismaModule.$transaction as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    await expect(ordenSedeService.cancelar(5, 'motivo', CTX_SUPERADMIN))
      .resolves.toBeUndefined();
  });

  it('caso feliz: dueño legítimo cancela su sede correctamente', async () => {
    const sede = makeSede();
    (ordenSedeRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(sede);

    const { default: prismaModule } = await import('../../config/database');
    (prismaModule.$transaction as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    await expect(ordenSedeService.cancelar(5, 'motivo test', CTX_RESTAURANTE_1))
      .resolves.toBeUndefined();

    expect(ordenSedeRepository.findByIdScoped).toHaveBeenCalledWith(5, CTX_RESTAURANTE_1);
  });
});

// ── actualizarItem — tenant guard vía sede padre ──────────────────────────────

describe('ordenSedeService.actualizarItem — tenant guard vía sede padre', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lanza NotFoundError cuando el item no existe', async () => {
    (ordenSedeRepository.findItemById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null);

    await expect(ordenSedeService.actualizarItem(20, { cantidad: 3 }, CTX_RESTAURANTE_1))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('lanza NotFoundError cuando la sede padre es de otro restaurante (IDOR)', async () => {
    (ordenSedeRepository.findItemById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(makeItem());
    (ordenSedeRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new NotFoundError('Registro 5 no encontrado'));

    await expect(ordenSedeService.actualizarItem(20, { cantidad: 3 }, CTX_RESTAURANTE_1))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('superadmin puede actualizar item de cualquier restaurante', async () => {
    const item = makeItem();
    const sede = makeSede({ id_restaurante: 99 });
    (ordenSedeRepository.findItemById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(item);
    (ordenSedeRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(sede);

    const { default: prismaModule } = await import('../../config/database');
    (prismaModule.$transaction as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ...item, cantidad: new Decimal('3') });

    const result = await ordenSedeService.actualizarItem(20, { cantidad: 3 }, CTX_SUPERADMIN);
    expect(result).toBeDefined();
  });

  it('caso feliz: dueño legítimo actualiza su item', async () => {
    const item = makeItem();
    const sede = makeSede();
    (ordenSedeRepository.findItemById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(item);
    (ordenSedeRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(sede);

    const { default: prismaModule } = await import('../../config/database');
    (prismaModule.$transaction as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ...item, notas: 'sin cebolla' });

    const result = await ordenSedeService.actualizarItem(20, { notas: 'sin cebolla' }, CTX_RESTAURANTE_1);
    expect(result).toBeDefined();
    expect(ordenSedeRepository.findByIdScoped).toHaveBeenCalledWith(5, CTX_RESTAURANTE_1);
  });
});

// ── eliminarItem — tenant guard vía sede padre ────────────────────────────────

describe('ordenSedeService.eliminarItem — tenant guard vía sede padre', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lanza NotFoundError cuando el item no existe', async () => {
    (ordenSedeRepository.findItemById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null);

    await expect(ordenSedeService.eliminarItem(20, CTX_RESTAURANTE_1))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('lanza NotFoundError cuando la sede padre es de otro restaurante (IDOR)', async () => {
    (ordenSedeRepository.findItemById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(makeItem());
    (ordenSedeRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new NotFoundError('Registro 5 no encontrado'));

    await expect(ordenSedeService.eliminarItem(20, CTX_RESTAURANTE_1))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('caso feliz: dueño legítimo elimina su item', async () => {
    const item = makeItem();
    const sede = makeSede();
    (ordenSedeRepository.findItemById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(item);
    (ordenSedeRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(sede);

    const { default: prismaModule } = await import('../../config/database');
    (prismaModule.$transaction as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    await expect(ordenSedeService.eliminarItem(20, CTX_RESTAURANTE_1))
      .resolves.toBeUndefined();

    expect(ordenSedeRepository.findByIdScoped).toHaveBeenCalledWith(5, CTX_RESTAURANTE_1);
  });
});
