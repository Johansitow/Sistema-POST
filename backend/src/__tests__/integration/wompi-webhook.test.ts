/**
 * Integración E2E — webhook de Wompi sobre HTTP real (setupRoutes + supertest).
 *
 * Ejercita el pipeline público POST /api/v1/webhooks/wompi: verificación de firma
 * → deduplicación → activación de la suscripción → aplicación del plan. Prisma,
 * Redis y el secreto de eventos se mockean; el HTTP y los middlewares son reales.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';

const EVENTS_SECRET = 'integ_events_secret';

// ── Mocks del límite de datos + secreto de eventos ──────────────────────────────

const prismaMock = vi.hoisted(() => ({
  eventoWebhookWompi:     { create: vi.fn(), update: vi.fn() },
  transaccionSuscripcion: { findUnique: vi.fn(), update: vi.fn() },
  suscripcion:            { update: vi.fn() },
  grupoNegocio:           { update: vi.fn() },
  auditoria:              { create: vi.fn() },
}));

vi.mock('../../config/database', () => ({ default: prismaMock }));

vi.mock('../../config/redis', () => ({
  cacheGetOrSet: (_k: string, _t: number, fn: () => unknown) => fn(),
  cacheGet:      vi.fn().mockResolvedValue(null),
  cacheSet:      vi.fn().mockResolvedValue(undefined),
  cacheDel:      vi.fn().mockResolvedValue(undefined),
  CACHE_TTL:     { SHORT: 60, MID: 300, LONG: 3600 },
  default:       { status: 'end', ping: vi.fn(), disconnect: vi.fn() },
}));

// Inyecta el secreto de eventos en config sin tocar el resto.
// (literal inline: el factory de vi.mock se hoistea por encima de las consts)
vi.mock('../../config/env', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../config/env')>();
  return {
    ...mod,
    config: { ...mod.config, wompi: { ...mod.config.wompi, driver: 'off', eventsSecret: 'integ_events_secret' } },
  };
});

// ── Imports después de los mocks ─────────────────────────────────────────────────

import { setupRoutes }  from '../../routes';
import { errorHandler } from '../../middlewares/error.middleware';

function buildApp() {
  const app = express();
  app.use(express.json());
  setupRoutes(app);
  app.use(errorHandler);
  return app;
}
const app = buildApp();

/** Construye un evento de Wompi con firma válida para el secreto de prueba. */
function eventoFirmado(opts: { txId: string; status: string; reference: string }) {
  const timestamp = 1700000000;
  const data = { transaction: { id: opts.txId, status: opts.status, amount_in_cents: 1990000, reference: opts.reference } };
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const concat = `${data.transaction.id}${data.transaction.status}${data.transaction.amount_in_cents}`;
  const checksum = crypto.createHash('sha256').update(`${concat}${timestamp}${EVENTS_SECRET}`).digest('hex');
  return { event: 'transaction.updated', data, timestamp, signature: { checksum, properties } };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.eventoWebhookWompi.create.mockResolvedValue({ id: 1 });
  prismaMock.eventoWebhookWompi.update.mockResolvedValue({ id: 1 });
  prismaMock.transaccionSuscripcion.findUnique.mockResolvedValue({
    id: 10,
    estado: 'pendiente',
    periodo_inicio: new Date('2026-08-04'),
    periodo_fin: new Date('2026-09-03'),
    suscripcion: { id: 1, id_grupo: 7, plan: 'professional', metodo: 'nequi' },
  });
  prismaMock.transaccionSuscripcion.update.mockResolvedValue({ id: 10 });
  prismaMock.suscripcion.update.mockResolvedValue({ id: 1 });
  prismaMock.grupoNegocio.update.mockResolvedValue({ id: 7 });
});

describe('POST /api/v1/webhooks/wompi', () => {
  it('200 y activa la suscripción con firma válida y transacción aprobada', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/wompi')
      .send(eventoFirmado({ txId: 'txn_1', status: 'APPROVED', reference: 'sub_7_1_abcd' }));

    expect(res.status).toBe(200);
    expect(res.body.procesado).toBe(true);
    // Aplica el plan al grupo (grupoNegocio.update vía planService.aplicarPlan)
    expect(prismaMock.grupoNegocio.update).toHaveBeenCalled();
    expect(prismaMock.suscripcion.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: expect.objectContaining({ estado: 'activa' }) }),
    );
  });

  it('401 con firma inválida (evento falsificado)', async () => {
    const ev = eventoFirmado({ txId: 'txn_1', status: 'APPROVED', reference: 'sub_7_1_abcd' });
    ev.signature.checksum = 'deadbeef'; // manipulado

    const res = await request(app).post('/api/v1/webhooks/wompi').send(ev);

    expect(res.status).toBe(401);
    expect(prismaMock.grupoNegocio.update).not.toHaveBeenCalled();
  });

  it('idempotente: un evento duplicado no reactiva ni reaplica el plan', async () => {
    // El libro de idempotencia rechaza el segundo evento (P2002 sobre evento_id).
    prismaMock.eventoWebhookWompi.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );

    const res = await request(app)
      .post('/api/v1/webhooks/wompi')
      .send(eventoFirmado({ txId: 'txn_1', status: 'APPROVED', reference: 'sub_7_1_abcd' }));

    expect(res.status).toBe(200);
    expect(res.body.procesado).toBe(false);
    expect(res.body.motivo).toBe('duplicado');
    expect(prismaMock.transaccionSuscripcion.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.grupoNegocio.update).not.toHaveBeenCalled();
  });
});
