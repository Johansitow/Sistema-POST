/**
 * Test de integración E2E — aislamiento multi-tenant sobre HTTP.
 *
 * A diferencia de los tests unitarios (que mockean Prisma y llaman al service
 * directo), este arnés levanta el árbol REAL de rutas de Express (setupRoutes)
 * y lo ejercita con supertest: authenticate → tenantContext → tenantIsolation →
 * requirePermission → controller → service → repositorio → guardián anti-IDOR.
 *
 * Prisma y Redis se mockean en el límite de datos para que el test sea hermético
 * y rápido (mismo criterio que el resto de la suite), pero TODO el pipeline HTTP
 * y de middlewares se ejecuta de verdad. Aquí es donde vivían los IDOR de recibos
 * y variantes y donde un fallo de cableado de middleware se escaparía a los tests
 * unitarios.
 *
 * Tenant A (el que autentica): restaurante 1, grupo 100.
 * Recursos "ajenos": orden en restaurante 2, producto en grupo 200.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Decimal } from '@prisma/client/runtime/library';

// ── Mocks del límite de datos ───────────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  orden:            { findUnique: vi.fn() },
  producto:         { findFirst: vi.fn() },
  productoVariante: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  rolPermiso:       { findFirst: vi.fn() },
  usuarioPermiso:   { findFirst: vi.fn() },
  restaurante:      { findUnique: vi.fn() },
  usuario:          { findUnique: vi.fn() },
  usuarioGrupo:     { findFirst: vi.fn() },
  auditoria:        { create: vi.fn() },
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

// ── Imports DESPUÉS de los mocks ─────────────────────────────────────────────────

import { setupRoutes }        from '../../routes';
import { errorHandler }       from '../../middlewares/error.middleware';
import { attachAuditContext } from '../../middlewares/audit.middleware';
import { config }             from '../../config/env';

// ── Arnés ─────────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(attachAuditContext);
  setupRoutes(app);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

/** Firma un JWT válido para Tenant A (restaurante 1 / grupo 100) con el secreto real. */
function tokenTenantA(overrides: Record<string, unknown> = {}): string {
  const payload = {
    id:             10,
    uuid:           'uuid-usuario-10',
    usuario:        'cajero.a',
    email:          'cajero.a@demo.com',
    es_super_admin: false,
    rol:            { id: 5, nombre: 'Cajero', es_super_admin: false },
    restaurantes:   [{ id: 1, nombre: 'Sede A', es_default: true, id_grupo: 100 }],
    permisos:       [],
    ...overrides,
  };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: '5m' });
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Concede cualquier permiso solicitado por requirePermission (vía rol). */
function concederPermisos() {
  prismaMock.rolPermiso.findFirst.mockResolvedValue({ id: 1 } as any);
}
/** Niega cualquier permiso. */
function negarPermisos() {
  prismaMock.rolPermiso.findFirst.mockResolvedValue(null);
}

function makeOrden(id_restaurante: number) {
  return {
    id:              42,
    id_restaurante,
    numero_orden:    'ORD-000042',
    fecha_apertura:  new Date('2026-03-28T14:00:00Z'),
    restaurante:     { nombre: 'Sede A' },
    usuario:         { nombre_completo: 'Ana López' },
    cliente:         { nombre_completo: 'Juan García' },
    estado:          { nombre: 'Entregada' },
    detalles:        [{
      producto:        { nombre: 'Café' },
      variante:        null,
      cantidad:        new Decimal('1'),
      precio_unitario: new Decimal('5000'),
      descuento:       new Decimal('0'),
      subtotal:        new Decimal('5000'),
      notas:           null,
    }],
    pagos:           [{ metodo_pago: { nombre: 'Efectivo' }, referencia: null, monto: new Decimal('5000') }],
    subtotal:        new Decimal('5000'),
    descuento:       new Decimal('0'),
    impuestos:       new Decimal('0'),
    propina:         new Decimal('0'),
    costo_domicilio: new Decimal('0'),
    total:           new Decimal('5000'),
  };
}

// ── Setup ───────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Por defecto: permisos concedidos y restaurante "compartido" (tenantIsolation pasa).
  concederPermisos();
  prismaMock.usuarioPermiso.findFirst.mockResolvedValue(null);
  prismaMock.restaurante.findUnique.mockResolvedValue({ tipo_tenant: 'compartido', id_grupo: 100 } as any);
});

// ── Recibos ──────────────────────────────────────────────────────────────────────

describe('GET /api/v1/recibos/orden/:id — aislamiento de tenant', () => {
  it('200 al leer el recibo de una orden del PROPIO restaurante', async () => {
    prismaMock.orden.findUnique.mockResolvedValue(makeOrden(1) as any); // restaurante 1 = Tenant A

    const res = await request(app)
      .get('/api/v1/recibos/orden/42')
      .set(auth(tokenTenantA()));

    expect(res.status).toBe(200);
    expect(res.body.data.numero).toBe('ORD-000042');
  });

  it('404 al intentar leer el recibo de una orden de OTRO restaurante (IDOR)', async () => {
    prismaMock.orden.findUnique.mockResolvedValue(makeOrden(2) as any); // restaurante 2 = ajeno

    const res = await request(app)
      .get('/api/v1/recibos/orden/42')
      .set(auth(tokenTenantA()));

    expect(res.status).toBe(404);
  });

  it('401 sin token', async () => {
    const res = await request(app).get('/api/v1/recibos/orden/42');
    expect(res.status).toBe(401);
  });
});

// ── Variantes ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/productos/:productoId/variantes — aislamiento de tenant', () => {
  it('200 al listar variantes de un producto del PROPIO grupo', async () => {
    prismaMock.producto.findFirst.mockResolvedValue({ id: 5, id_grupo: 100 } as any);
    prismaMock.productoVariante.findMany.mockResolvedValue([{ id: 9, id_producto: 5, nombre: 'Grande' }] as any);

    const res = await request(app)
      .get('/api/v1/productos/5/variantes')
      .set(auth(tokenTenantA()));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('404 al listar variantes de un producto de OTRO grupo (IDOR)', async () => {
    prismaMock.producto.findFirst.mockResolvedValue({ id: 5, id_grupo: 200 } as any); // grupo ajeno

    const res = await request(app)
      .get('/api/v1/productos/5/variantes')
      .set(auth(tokenTenantA()));

    expect(res.status).toBe(404);
  });

  it('403 al listar variantes sin el permiso productos.ver', async () => {
    negarPermisos();
    prismaMock.producto.findFirst.mockResolvedValue({ id: 5, id_grupo: 100 } as any);

    const res = await request(app)
      .get('/api/v1/productos/5/variantes')
      .set(auth(tokenTenantA()));

    expect(res.status).toBe(403);
  });

  it('404 al actualizar una variante cuyo producto es de OTRO grupo (IDOR de mutación)', async () => {
    prismaMock.productoVariante.findUnique.mockResolvedValue({ id: 9, id_producto: 5 } as any);
    prismaMock.producto.findFirst.mockResolvedValue({ id: 5, id_grupo: 200 } as any); // grupo ajeno

    const res = await request(app)
      .put('/api/v1/productos/5/variantes/9')
      .set(auth(tokenTenantA()))
      .send({ nombre: 'Hack' });

    expect(res.status).toBe(404);
    expect(prismaMock.productoVariante.update).not.toHaveBeenCalled();
  });
});
