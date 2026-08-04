/**
 * Tests de suscripcionService — checkout, activación idempotente, renovación,
 * vencimiento (degradación a Gratis).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EstadoTxWompi } from '@prisma/client';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/suscripcion.repository', () => ({
  suscripcionRepository: {
    findByGrupo:    vi.fn(),
    findById:       vi.fn(),
    upsert:         vi.fn(),
    update:         vi.fn(),
    findPorCobrar:  vi.fn(),
    findParaVencer: vi.fn(),
  },
}));

vi.mock('../../repositories/transaccionSuscripcion.repository', () => ({
  transaccionSuscripcionRepository: {
    create:           vi.fn(),
    findByReferencia: vi.fn(),
    findByWompiId:    vi.fn(),
    update:           vi.fn(),
  },
}));

vi.mock('../plan.service', () => ({
  planService: { aplicarPlan: vi.fn(), getPlanYUso: vi.fn() },
}));

vi.mock('../../repositories/auditoria.repository', () => ({
  registrarAuditoria: vi.fn(),
}));

vi.mock('../../lib/pagos', () => ({
  pasarela: {
    disponible:         vi.fn(() => false),
    getAcceptanceToken: vi.fn(),
    crearFuentePago:    vi.fn(),
    crearTransaccion:   vi.fn(),
    obtenerTransaccion: vi.fn(),
  },
  pesosACentavos: (cop: number | string) => Math.round(Number(cop) * 100),
}));

// ── Imports después de los mocks ────────────────────────────────────────────────

import { suscripcionService } from '../suscripcion.service';
import { suscripcionRepository } from '../../repositories/suscripcion.repository';
import { transaccionSuscripcionRepository } from '../../repositories/transaccionSuscripcion.repository';
import { planService } from '../plan.service';
import { pasarela } from '../../lib/pagos';
import { BadRequestError } from '../../exceptions/HttpErrors';

const P = pasarela as any;
const subRepo = suscripcionRepository as any;
const txRepo = transaccionSuscripcionRepository as any;

beforeEach(() => vi.clearAllMocks());

// ── iniciarCheckout ─────────────────────────────────────────────────────────────

describe('suscripcionService.iniciarCheckout', () => {
  it('Nequi aprobado: crea fuente, activa la suscripción y aplica el plan', async () => {
    P.crearFuentePago.mockResolvedValue({ paymentSourceId: 'src_1', estado: 'aprobada' });
    subRepo.upsert.mockResolvedValue({ id: 1, id_grupo: 7, plan: 'professional', metodo: 'nequi' });
    txRepo.create.mockResolvedValue({ id: 10 });
    P.crearTransaccion.mockResolvedValue({ wompiTransactionId: 'txn_1', estado: 'aprobada' });
    // aplicarTransaccionAprobada → busca la tx por referencia
    txRepo.findByReferencia.mockResolvedValue({
      id: 10,
      estado: EstadoTxWompi.pendiente,
      periodo_inicio: new Date('2026-08-04'),
      periodo_fin: new Date('2026-09-03'),
      suscripcion: { id: 1, id_grupo: 7, plan: 'professional', metodo: 'nequi' },
    });

    const res = await suscripcionService.iniciarCheckout(7, {
      plan: 'professional',
      metodo: 'nequi',
      emailCliente: 'due@o.com',
      datosMetodo: { phone_number: '3001234567' },
    });

    expect(res.estado).toBe('aprobada');
    expect(P.crearFuentePago).toHaveBeenCalledOnce();
    // Guarda el token de la fuente en la suscripción (habilita recurrencia)
    expect(subRepo.upsert).toHaveBeenCalledWith(7, expect.objectContaining({ wompi_payment_source_id: 'src_1' }));
    // Activa y aplica el plan al grupo
    expect(planService.aplicarPlan).toHaveBeenCalledWith(7, 'professional');
    expect(subRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ estado: 'activa' }));
  });

  it('rechaza el plan Gratis (no requiere pago)', async () => {
    await expect(
      suscripcionService.iniciarCheckout(7, { plan: 'starter', metodo: 'nequi', emailCliente: 'x@y.com' }),
    ).rejects.toThrow(BadRequestError);
  });

  it('rechaza el método tarjeta (desactivado en el MVP)', async () => {
    await expect(
      suscripcionService.iniciarCheckout(7, { plan: 'professional', metodo: 'tarjeta' as any, emailCliente: 'x@y.com' }),
    ).rejects.toThrow(BadRequestError);
  });
});

// ── Idempotencia ────────────────────────────────────────────────────────────────

describe('suscripcionService.aplicarTransaccionAprobada', () => {
  it('es idempotente: si la transacción ya estaba aprobada, no reactiva ni reaplica el plan', async () => {
    txRepo.findByReferencia.mockResolvedValue({
      id: 10,
      estado: EstadoTxWompi.aprobada, // ya aplicada
      suscripcion: { id: 1, id_grupo: 7, plan: 'professional' },
    });

    await suscripcionService.aplicarTransaccionAprobada('ref-x');

    expect(subRepo.update).not.toHaveBeenCalled();
    expect(planService.aplicarPlan).not.toHaveBeenCalled();
  });
});

// ── Vencimiento ─────────────────────────────────────────────────────────────────

describe('suscripcionService.vencer', () => {
  it('degrada a Gratis (starter) y marca la suscripción vencida', async () => {
    subRepo.findById.mockResolvedValue({ id: 1, id_grupo: 7, plan: 'professional', estado: 'activa' });

    await suscripcionService.vencer(1);

    expect(subRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ estado: 'vencida' }));
    expect(planService.aplicarPlan).toHaveBeenCalledWith(7, 'starter');
  });
});

// ── Renovación ──────────────────────────────────────────────────────────────────

describe('suscripcionService.renovar', () => {
  it('sin token (PSE): no cobra, deja la suscripción pendiente_pago', async () => {
    subRepo.findById.mockResolvedValue({ id: 1, id_grupo: 7, plan: 'professional', metodo: 'pse', wompi_payment_source_id: null, reintentos: 0 });

    await suscripcionService.renovar(1);

    expect(P.crearTransaccion).not.toHaveBeenCalled();
    expect(subRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ estado: 'pendiente_pago' }));
  });

  it('con token pero cobro rechazado alcanzando el máximo de reintentos → vence (degrada a Gratis)', async () => {
    subRepo.findById.mockResolvedValue({ id: 1, id_grupo: 7, plan: 'professional', metodo: 'nequi', wompi_payment_source_id: 'src_1', reintentos: 2, estado: 'activa' });
    txRepo.create.mockResolvedValue({ id: 20 });
    P.crearTransaccion.mockResolvedValue({ wompiTransactionId: 'txn_x', estado: 'rechazada' });

    await suscripcionService.renovar(1);

    // reintentos 2 + 1 = 3 (MAX) → vencer → aplicarPlan starter
    expect(planService.aplicarPlan).toHaveBeenCalledWith(7, 'starter');
  });
});
