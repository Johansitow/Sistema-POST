/**
 * Integración E2E — gating de módulos por plan sobre HTTP real (setupRoutes).
 *
 * Ejercita el pipeline completo authenticate → tenantContext → tenantIsolation →
 * requireModulo sobre GET /api/v1/proveedores. Prisma/Redis mockeados; el HTTP y
 * los middlewares (incluida la lectura real del plan vía getPlanDeGrupo) corren.
 *
 * Tenant A: restaurante 1, grupo 100.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  grupoNegocio: { findUnique: vi.fn() },
  restaurante:  { findUnique: vi.fn() },
  proveedor:    { findMany: vi.fn(), count: vi.fn() },
  usuario:      { findUnique: vi.fn() },
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

import { setupRoutes }  from '../../routes';
import { errorHandler } from '../../middlewares/error.middleware';
import { config }       from '../../config/env';

function buildApp() {
  const app = express();
  app.use(express.json());
  setupRoutes(app);
  app.use(errorHandler);
  return app;
}
const app = buildApp();

function tokenTenantA(): string {
  return jwt.sign({
    id: 10, uuid: 'u-10', usuario: 'due.a', email: 'due@a.com', es_super_admin: false,
    rol: { id: 5, nombre: 'Propietario', es_super_admin: false },
    restaurantes: [{ id: 1, nombre: 'Sede A', es_default: true, id_grupo: 100 }],
    grupos_admin: [{ id_grupo: 100, rol_en_grupo: 'owner' }],
    permisos: [],
  }, config.jwt.secret, { expiresIn: '5m' });
}
const auth = { Authorization: `Bearer ${tokenTenantA()}` };

beforeEach(() => {
  vi.clearAllMocks();
  // tenantIsolation: restaurante compartido del grupo 100
  prismaMock.restaurante.findUnique.mockResolvedValue({ tipo_tenant: 'compartido', id_grupo: 100 });
  prismaMock.proveedor.findMany.mockResolvedValue([]);
  prismaMock.proveedor.count.mockResolvedValue(0);
});

describe('GET /api/v1/proveedores — gating por plan', () => {
  it('403 MODULE_LOCKED si el grupo (starter) tiene gating activo y el plan no incluye proveedores', async () => {
    prismaMock.grupoNegocio.findUnique.mockResolvedValue({ id: 100, plan: 'starter', gating_activo: true });

    const res = await request(app).get('/api/v1/proveedores').set(auth);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MODULE_LOCKED');
    expect(res.body.modulo).toBe('proveedores');
    expect(res.body.plan_requerido).toBe('professional');
  });

  it('NO bloquea a un grupo grandfathered (gating_activo=false) aunque sea starter', async () => {
    prismaMock.grupoNegocio.findUnique.mockResolvedValue({ id: 100, plan: 'starter', gating_activo: false });

    const res = await request(app).get('/api/v1/proveedores').set(auth);

    expect(res.status).not.toBe(403);
  });

  it('NO bloquea si el plan (professional) incluye el módulo', async () => {
    prismaMock.grupoNegocio.findUnique.mockResolvedValue({ id: 100, plan: 'professional', gating_activo: true });

    const res = await request(app).get('/api/v1/proveedores').set(auth);

    expect(res.status).not.toBe(403);
  });
});
