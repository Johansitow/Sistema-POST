/**
 * Tests para alerta.handler
 *
 * Cubre:
 *   CIERRE_COMPLETADO → crea una Alerta CIERRE_CAJA
 *     - con el id_restaurante del payload (aislamiento de tenant)
 *     - reutiliza el TipoAlerta si ya existe (no duplica)
 *     - crea el TipoAlerta si falta (idempotencia en DBs sin seed actualizado)
 *     - prioridad alta y mensaje de diferencia cuando estado = con_diferencia
 *     - un error del repositorio NO propaga al emisor del evento
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/alerta.repository', () => ({
  alertaRepository: {
    findTipoByCodigo: vi.fn(),
    createTipo:       vi.fn(),
    create:           vi.fn(),
  },
}));

vi.mock('../../config/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

// ── Imports DESPUÉS de los mocks ───────────────────────────────────────────────

import { registerAlertaHandlers } from '../handlers/alerta.handler';
import { alertaRepository } from '../../repositories/alerta.repository';
import { eventBus } from '../eventBus';
import { EVENTS, CierreCompletadoPayload } from '../events';
import logger from '../../config/logger';

const repo = alertaRepository as any;

const tipoCierreCaja = {
  id: 7, nombre: 'Cierre de Caja', codigo: 'CIERRE_CAJA',
  prioridad_default: 'media', activo: true,
};

const payloadBase: CierreCompletadoPayload = {
  idCierre:      5,
  idRestaurante: 2,
  numeroCierre:  'CIE-000005',
  estado:        'completado',
  totalVentas:   200000,
  diferencia:    0,
};

describe('alerta.handler — CIERRE_COMPLETADO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // El eventBus es un singleton: limpiar handlers de tests previos
    eventBus.off(EVENTS.CIERRE_COMPLETADO);
    registerAlertaHandlers();
  });

  it('crea la alerta con el id_restaurante del payload', async () => {
    repo.findTipoByCodigo.mockResolvedValue(tipoCierreCaja);
    repo.create.mockResolvedValue({ id: 1 });

    await eventBus.emit(EVENTS.CIERRE_COMPLETADO, payloadBase);

    expect(repo.create).toHaveBeenCalledOnce();
    const args = repo.create.mock.calls[0][0];
    expect(args.id_restaurante).toBe(2);
    expect(args.id_tipo_alerta).toBe(7);
    expect(args.mensaje).toContain('CIE-000005');
    expect(args.nivel_prioridad).toBe('media');
  });

  it('reutiliza el TipoAlerta existente sin crear uno nuevo', async () => {
    repo.findTipoByCodigo.mockResolvedValue(tipoCierreCaja);
    repo.create.mockResolvedValue({ id: 1 });

    await eventBus.emit(EVENTS.CIERRE_COMPLETADO, payloadBase);

    expect(repo.createTipo).not.toHaveBeenCalled();
  });

  it('crea el TipoAlerta CIERRE_CAJA si no existe (idempotente)', async () => {
    repo.findTipoByCodigo.mockResolvedValue(null);
    repo.createTipo.mockResolvedValue(tipoCierreCaja);
    repo.create.mockResolvedValue({ id: 1 });

    await eventBus.emit(EVENTS.CIERRE_COMPLETADO, payloadBase);

    expect(repo.createTipo).toHaveBeenCalledOnce();
    expect(repo.createTipo.mock.calls[0][0].codigo).toBe('CIERRE_CAJA');
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it('usa prioridad alta y menciona la diferencia cuando estado = con_diferencia', async () => {
    repo.findTipoByCodigo.mockResolvedValue(tipoCierreCaja);
    repo.create.mockResolvedValue({ id: 1 });

    await eventBus.emit(EVENTS.CIERRE_COMPLETADO, {
      ...payloadBase, estado: 'con_diferencia', diferencia: -12000,
    });

    const args = repo.create.mock.calls[0][0];
    expect(args.nivel_prioridad).toBe('alta');
    expect(args.mensaje).toContain('diferencia');
  });

  it('no propaga errores del repositorio al emisor del evento', async () => {
    repo.findTipoByCodigo.mockRejectedValue(new Error('DB caída'));

    await expect(eventBus.emit(EVENTS.CIERRE_COMPLETADO, payloadBase))
      .resolves.not.toThrow();
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
