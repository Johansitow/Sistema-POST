/**
 * Integración E2E — emisión de FE a solicitud sobre HTTP real (setupRoutes).
 * Con driver noop (FACTURACION_DRIVER=off): el pipeline completo emite un CUFE
 * simulado. Prisma/Redis mockeados; middlewares reales. Tenant A: restaurante 1, grupo 100.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  orden:                   { findUnique: vi.fn() },
  facturaElectronica:      { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  restaurante:             { findUnique: vi.fn() },
  configuracionRestaurante:{ findUnique: vi.fn() },
  configuracionGrupo:      { findUnique: vi.fn() },
  configuracion:           { findUnique: vi.fn(), findFirst: vi.fn() },
  rolPermiso:              { findFirst: vi.fn() },
  usuarioPermiso:          { findFirst: vi.fn() },
  auditoria:               { create: vi.fn() },
}));

vi.mock('../../config/database', () => ({ default: prismaMock }));
vi.mock('../../config/redis', () => ({
  cacheGetOrSet: (_k: string, _t: number, fn: () => unknown) => fn(),
  cacheGet: vi.fn().mockResolvedValue(null), cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined), CACHE_TTL: { SHORT: 60, MID: 300, LONG: 3600 },
  default: { status: 'end', ping: vi.fn(), disconnect: vi.fn() },
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

function token(): string {
  return jwt.sign({
    id: 10, uuid: 'u-10', usuario: 'caj', email: 'c@a.com', es_super_admin: false,
    rol: { id: 5, nombre: 'Cajero', es_super_admin: false },
    restaurantes: [{ id: 1, nombre: 'Sede A', es_default: true, id_grupo: 100 }],
    permisos: [],
  }, config.jwt.secret, { expiresIn: '5m' });
}
const auth = { Authorization: `Bearer ${token()}` };
const adquiriente = { tipo_documento: '13', numero_documento: '123456', nombre: 'Juan Pérez' };

function ordenDe(id_restaurante: number) {
  return {
    id: 42, id_grupo: 100, id_restaurante, subtotal: 10000, impuestos: 1900, total: 11900,
    sedes: [], detalles: [{ producto: { nombre: 'Café' }, cantidad: 1, precio_unitario: 10000, descuento: 0 }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.rolPermiso.findFirst.mockResolvedValue({ id: 1 });   // facturas.ver concedido
  prismaMock.usuarioPermiso.findFirst.mockResolvedValue(null);
  prismaMock.restaurante.findUnique.mockResolvedValue({ id_grupo: 100 });
  prismaMock.configuracionRestaurante.findUnique.mockResolvedValue(null);
  prismaMock.configuracionGrupo.findUnique.mockResolvedValue(null);
  prismaMock.configuracion.findUnique.mockResolvedValue(null);
  prismaMock.configuracion.findFirst.mockResolvedValue(null);
  prismaMock.facturaElectronica.findUnique.mockResolvedValue(null);
  prismaMock.facturaElectronica.create.mockResolvedValue({ id: 1, referencia: 'fe_100_x', estado: 'pendiente' });
  prismaMock.facturaElectronica.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 1, ...data }));
  prismaMock.auditoria.create.mockResolvedValue({});
});

describe('POST /api/v1/facturacion/ordenes/:idOrden/emitir', () => {
  it('201 y emite (noop) una FE con CUFE para una orden del propio tenant', async () => {
    prismaMock.orden.findUnique.mockResolvedValue(ordenDe(1)); // restaurante del token

    const res = await request(app)
      .post('/api/v1/facturacion/ordenes/42/emitir')
      .set(auth).send(adquiriente);

    expect(res.status).toBe(201);
    expect(res.body.data.estado).toBe('emitida');
    expect(res.body.data.cufe).toBeTruthy();
    expect(prismaMock.facturaElectronica.create).toHaveBeenCalled();
  });

  it('404 si la orden es de otro restaurante (IDOR)', async () => {
    prismaMock.orden.findUnique.mockResolvedValue(ordenDe(2)); // ajeno

    const res = await request(app)
      .post('/api/v1/facturacion/ordenes/42/emitir')
      .set(auth).send(adquiriente);

    expect(res.status).toBe(404);
    expect(prismaMock.facturaElectronica.create).not.toHaveBeenCalled();
  });

  it('403 sin el permiso facturas.ver', async () => {
    prismaMock.rolPermiso.findFirst.mockResolvedValue(null);
    prismaMock.orden.findUnique.mockResolvedValue(ordenDe(1));

    const res = await request(app)
      .post('/api/v1/facturacion/ordenes/42/emitir')
      .set(auth).send(adquiriente);

    expect(res.status).toBe(403);
  });
});
