/**
 * Tests para cierreCajaService
 *
 * Cubre:
 *   crearTurno
 *     - valida formato hora_apertura / hora_cierre
 *     - valida que hora_cierre > hora_apertura
 *     - delega a turnoCajaRepository.create cuando los datos son válidos
 *
 *   obtenerTurno
 *     - retorna el turno si existe
 *     - lanza NotFoundError si no existe
 *
 *   eliminarTurno
 *     - lanza ConflictError si el turno tiene cierres asociados
 *     - elimina si no hay cierres
 *
 *   iniciarCierre
 *     - lanza BadRequestError si hay órdenes abiertas EN ESTE restaurante
 *     - no falla si las órdenes abiertas son de otro restaurante (aislamiento de tenant)
 *     - crea el cierre cuando no hay órdenes abiertas
 *     - lanza BadRequestError si id_restaurante es undefined (assertRestauranteId)
 *
 *   confirmarCierre
 *     - lanza BadRequestError si el cierre no está en estado en_proceso
 *     - lanza BadRequestError si diferencia > umbral sin justificación
 *     - estado = completado cuando diferencia <= umbral
 *     - estado = con_diferencia cuando diferencia > umbral (con justificación)
 *     - emite CIERRE_COMPLETADO con el payload del cierre actualizado
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { EstadoCierre } from '@prisma/client';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/turno-cierre.repository', () => ({
  turnoCajaRepository: {
    findAll:    vi.fn(),
    findById:   vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    delete:     vi.fn(),
  },
  cierreCajaRepository: {
    findAll:    vi.fn(),
    findById:   vi.fn(),
    findUltimo: vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
  },
}));

vi.mock('../../services/configuracion.service', () => ({
  configuracionService: {
    getValor: vi.fn(),
  },
}));

vi.mock('../../config/database', () => ({
  default: {
    estadoOrden: { findMany: vi.fn() },
    orden:       { findMany: vi.fn() },
    pago:        { findMany: vi.fn() },
    cierreCaja:  { count: vi.fn() },
  },
}));

// ── Imports DESPUÉS de los mocks ───────────────────────────────────────────────

import { cierreCajaService }  from '../cierre-caja.service';
import { turnoCajaRepository, cierreCajaRepository } from '../../repositories/turno-cierre.repository';
import { configuracionService } from '../../services/configuracion.service';
import prisma from '../../config/database';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../../exceptions/HttpErrors';
import { eventBus } from '../../events/eventBus';
import { EVENTS } from '../../events/events';

const pm    = prisma as any;
const turnoR  = turnoCajaRepository  as any;
const cierreR = cierreCajaRepository as any;
const confSvc = configuracionService  as any;

// ── Fixtures ───────────────────────────────────────────────────────────────────

const mockTurno = {
  id: 1, nombre: 'Mañana', hora_apertura: '08:00', hora_cierre: '16:00',
  id_restaurante: 10, activo: true,
};

const mockCierreEnProceso = {
  id: 5, numero_cierre: 'CIE-000005',
  estado: EstadoCierre.en_proceso,
  total_ventas: new Decimal('200000'),
  fecha_apertura: new Date('2026-03-28T08:00:00Z'),
};

// ── crearTurno ────────────────────────────────────────────────────────────────

describe('cierreCajaService.crearTurno', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea el turno con datos válidos', async () => {
    turnoR.create.mockResolvedValue(mockTurno);

    const result = await cierreCajaService.crearTurno({
      id_restaurante: 10, nombre: 'Mañana',
      hora_apertura: '08:00', hora_cierre: '16:00',
    });

    expect(turnoR.create).toHaveBeenCalledOnce();
    expect(result.nombre).toBe('Mañana');
  });

  it('lanza BadRequestError si hora_apertura tiene formato inválido', async () => {
    await expect(cierreCajaService.crearTurno({
      id_restaurante: 10, nombre: 'Test',
      hora_apertura: '8:00', hora_cierre: '16:00',
    })).rejects.toThrow(BadRequestError);
  });

  it('lanza BadRequestError si hora_cierre tiene formato inválido', async () => {
    await expect(cierreCajaService.crearTurno({
      id_restaurante: 10, nombre: 'Test',
      hora_apertura: '08:00', hora_cierre: '25:00',
    })).rejects.toThrow(BadRequestError);
  });

  it('lanza BadRequestError si hora_apertura >= hora_cierre', async () => {
    await expect(cierreCajaService.crearTurno({
      id_restaurante: 10, nombre: 'Test',
      hora_apertura: '16:00', hora_cierre: '08:00',
    })).rejects.toThrow(BadRequestError);
  });

  it('lanza BadRequestError si hora_apertura === hora_cierre', async () => {
    await expect(cierreCajaService.crearTurno({
      id_restaurante: 10, nombre: 'Test',
      hora_apertura: '09:00', hora_cierre: '09:00',
    })).rejects.toThrow(BadRequestError);
  });
});

// ── obtenerTurno ──────────────────────────────────────────────────────────────

describe('cierreCajaService.obtenerTurno', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve el turno si existe', async () => {
    turnoR.findById.mockResolvedValue(mockTurno);

    const result = await cierreCajaService.obtenerTurno(1);
    expect(result.id).toBe(1);
  });

  it('lanza NotFoundError si el turno no existe', async () => {
    turnoR.findById.mockResolvedValue(null);

    await expect(cierreCajaService.obtenerTurno(999))
      .rejects.toThrow(NotFoundError);
  });
});

// ── eliminarTurno ─────────────────────────────────────────────────────────────

describe('cierreCajaService.eliminarTurno', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza ConflictError si el turno tiene cierres asociados', async () => {
    turnoR.findById.mockResolvedValue(mockTurno);
    pm.cierreCaja.count.mockResolvedValue(3);

    await expect(cierreCajaService.eliminarTurno(1))
      .rejects.toThrow(ConflictError);
  });

  it('elimina el turno si no tiene cierres', async () => {
    turnoR.findById.mockResolvedValue(mockTurno);
    pm.cierreCaja.count.mockResolvedValue(0);
    turnoR.delete.mockResolvedValue(mockTurno);

    await expect(cierreCajaService.eliminarTurno(1)).resolves.not.toThrow();
    expect(turnoR.delete).toHaveBeenCalledWith(1);
  });
});

// ── iniciarCierre ─────────────────────────────────────────────────────────────

describe('cierreCajaService.iniciarCierre', () => {
  const baseData = {
    id_usuario:     1,
    id_restaurante: 10,
    fecha_apertura: new Date('2026-03-28T08:00:00Z'),
    monto_inicial:  50000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Estados finales de órdenes
    pm.estadoOrden.findMany.mockResolvedValue([{ id: 5 }, { id: 6 }]);
    // Por defecto: sin órdenes abiertas
    pm.orden.findMany.mockResolvedValue([]);
    // Pagos vacíos → totales = 0
    pm.pago.findMany.mockResolvedValue([]);
    // Sin cierres previos
    cierreR.findUltimo.mockResolvedValue(null);
    cierreR.create.mockResolvedValue({ id: 100, numero_cierre: 'CIE-000001' });
  });

  it('crea el cierre cuando no hay órdenes abiertas en el restaurante', async () => {
    const result = await cierreCajaService.iniciarCierre(baseData);

    expect(result.numero_cierre).toBe('CIE-000001');
    expect(cierreR.create).toHaveBeenCalledOnce();
  });

  it('filtra órdenes abiertas SOLO del restaurante indicado (aislamiento de tenant)', async () => {
    // Las órdenes abiertas son de otro restaurante — no deben bloquear el cierre
    pm.orden.findMany.mockResolvedValue([]); // mock ya retorna vacío para este restaurante

    await cierreCajaService.iniciarCierre(baseData);
    expect(cierreR.create).toHaveBeenCalledOnce();

    // Verificar que la query usó el filtro de id_restaurante correcto
    const whereUsado = pm.orden.findMany.mock.calls[0][0].where;
    expect(whereUsado.id_restaurante).toBe(10);
  });

  it('lanza BadRequestError si hay órdenes abiertas en el restaurante', async () => {
    pm.orden.findMany.mockResolvedValue([
      { id: 11, numero_orden: 'ORD-000011', total: new Decimal('50000'), estado: { nombre: 'En cocina' } },
    ]);

    await expect(cierreCajaService.iniciarCierre(baseData))
      .rejects.toThrow(BadRequestError);
  });

  it('lanza ForbiddenError cuando id_restaurante es undefined (assertRestauranteId)', async () => {
    await expect(
      cierreCajaService.iniciarCierre({ ...baseData, id_restaurante: undefined as any })
    ).rejects.toThrow(ForbiddenError);
  });

  it('genera número de cierre correlativo al último', async () => {
    cierreR.findUltimo.mockResolvedValue({ numero_cierre: 'CIE-000005' });
    cierreR.create.mockResolvedValue({ id: 200, numero_cierre: 'CIE-000006' });

    const result = await cierreCajaService.iniciarCierre(baseData);
    expect(result.numero_cierre).toBe('CIE-000006');
  });

  it('calcula total_ventas como suma de pagos del restaurante', async () => {
    pm.pago.findMany.mockResolvedValue([
      { monto: new Decimal('50000'), metodo_pago: { codigo: 'EFECTIVO', nombre: 'Efectivo' } },
      { monto: new Decimal('30000'), metodo_pago: { codigo: 'TARJETA',  nombre: 'Tarjeta'  } },
    ]);

    await cierreCajaService.iniciarCierre(baseData);

    const createArgs = cierreR.create.mock.calls[0][0];
    expect(createArgs.total_ventas).toBe(80000);
    expect(createArgs.total_efectivo).toBe(50000);
    expect(createArgs.totales_por_metodo).toEqual({ EFECTIVO: 50000, TARJETA: 30000 });
  });

  it('la query de pagos filtra por id_restaurante a través de la relación orden', async () => {
    await cierreCajaService.iniciarCierre(baseData);

    const pagoWhere = pm.pago.findMany.mock.calls[0][0].where;
    expect(pagoWhere.orden.id_restaurante).toBe(10);
  });
});

// ── confirmarCierre ───────────────────────────────────────────────────────────

describe('cierreCajaService.confirmarCierre', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cierreR.findById.mockResolvedValue(mockCierreEnProceso);
    confSvc.getValor.mockResolvedValue(5000); // umbral = 5000
  });

  it('lanza BadRequestError si el cierre no está en estado en_proceso', async () => {
    cierreR.findById.mockResolvedValue({ ...mockCierreEnProceso, estado: EstadoCierre.completado });

    await expect(cierreCajaService.confirmarCierre(5, { monto_final: 200000 }))
      .rejects.toThrow(BadRequestError);
  });

  it('lanza BadRequestError si diferencia > umbral sin justificación', async () => {
    // total_ventas = 200000, monto_final = 190000 → diferencia = -10000 → |10000| > 5000
    await expect(
      cierreCajaService.confirmarCierre(5, { monto_final: 190000 })
    ).rejects.toThrow(BadRequestError);
  });

  it('cierra con estado completado cuando diferencia <= umbral', async () => {
    // total_ventas = 200000, monto_final = 201000 → diferencia = 1000 ≤ 5000
    cierreR.update.mockResolvedValue({ ...mockCierreEnProceso, estado: EstadoCierre.completado });

    await cierreCajaService.confirmarCierre(5, { monto_final: 201000 });

    const updateArgs = cierreR.update.mock.calls[0][1];
    expect(updateArgs.estado).toBe(EstadoCierre.completado);
    expect(updateArgs.diferencia).toBe(1000);
  });

  it('cierra con estado con_diferencia cuando diferencia > umbral y hay justificación', async () => {
    // total_ventas = 200000, monto_final = 188000 → diferencia = -12000 > 5000
    cierreR.update.mockResolvedValue({ ...mockCierreEnProceso, estado: EstadoCierre.con_diferencia });

    await cierreCajaService.confirmarCierre(5, {
      monto_final:    188000,
      justificacion:  'Faltante detectado en efectivo',
    });

    const updateArgs = cierreR.update.mock.calls[0][1];
    expect(updateArgs.estado).toBe(EstadoCierre.con_diferencia);
    expect(updateArgs.diferencia).toBe(-12000);
    expect(updateArgs.justificacion).toBe('Faltante detectado en efectivo');
  });

  it('emite CIERRE_COMPLETADO con el payload del cierre actualizado', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emit').mockResolvedValue();
    cierreR.update.mockResolvedValue({
      ...mockCierreEnProceso,
      id_restaurante: 2,
      estado: EstadoCierre.completado,
    });

    await cierreCajaService.confirmarCierre(5, { monto_final: 201000 });

    expect(emitSpy).toHaveBeenCalledWith(EVENTS.CIERRE_COMPLETADO, {
      idCierre:      5,
      idRestaurante: 2,
      numeroCierre:  'CIE-000005',
      estado:        EstadoCierre.completado,
      totalVentas:   200000,
      diferencia:    1000,
    });
    emitSpy.mockRestore();
  });

  it('usa umbral default de 5000 si configuracion.getValor lanza error', async () => {
    confSvc.getValor.mockRejectedValue(new Error('config not found'));
    // diferencia = 4000 ≤ 5000 → completado
    cierreR.update.mockResolvedValue({ ...mockCierreEnProceso, estado: EstadoCierre.completado });

    await cierreCajaService.confirmarCierre(5, { monto_final: 204000 });

    const updateArgs = cierreR.update.mock.calls[0][1];
    expect(updateArgs.estado).toBe(EstadoCierre.completado);
  });
});
