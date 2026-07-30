/**
 * Tests para grupoNegocioService.eliminarGrupo — borrado total de un negocio.
 *
 * Cubre:
 *   - rechaza (ForbiddenError) si el grupo contiene al superadministrador.
 *   - 404 si el grupo no existe.
 *   - grupo normal: corre el barrido (borra grupo) y elimina al usuario dueño
 *     que quedó sin ninguna membresía.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { tx, prismaTopLevel, mockCacheDel } = vi.hoisted(() => {
  const makeModel = () => ({
    create:     vi.fn().mockResolvedValue({}),
    delete:     vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    findMany:   vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    count:      vi.fn().mockResolvedValue(0),
  });

  const modelNames = [
    'grupoNegocio', 'configuracionGrupo', 'restaurante', 'usuarioRestaurante',
    'usuarioGrupo', 'orden', 'pago', 'factura', 'clientePunto', 'movimiento',
    'alerta', 'cierreCaja', 'turnoCaja', 'listaCompras', 'lote', 'productoStock',
    'receta', 'productoVariante', 'proveedorProducto', 'producto', 'categoria',
    'cliente', 'proveedor', 'plantillaImpresion', 'documentoEmitido',
    'periodoNomina', 'auditoria', 'featureFlagAsignacion', 'usuario',
  ] as const;

  const tx = Object.fromEntries(modelNames.map(n => [n, makeModel()])) as Record<string, ReturnType<typeof makeModel>>;
  const prismaTopLevel = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    grupoNegocio: tx.grupoNegocio,
  };
  const mockCacheDel = vi.fn().mockResolvedValue(undefined);
  return { tx, prismaTopLevel, mockCacheDel };
});

vi.mock('../../config/database', () => ({ default: prismaTopLevel }));
vi.mock('../../config/redis', () => ({
  cacheDel:      (...a: unknown[]) => mockCacheDel(...a),
  cacheGetOrSet: (_k: string, _t: number, fn: () => unknown) => fn(),
}));

import { grupoNegocioService } from '../grupo-negocio.service';
import { ForbiddenError, NotFoundError } from '../../exceptions/HttpErrors';

beforeEach(() => {
  vi.clearAllMocks();
  prismaTopLevel.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
});

describe('grupoNegocioService.eliminarGrupo', () => {
  it('rechaza el negocio que contiene al superadministrador', async () => {
    tx.grupoNegocio.findUnique.mockResolvedValue({
      id: 2, restaurantes: [{ id: 20 }],
      usuarios: [{ id_usuario: 4, usuario: { es_super_admin: true } }],
    });

    await expect(grupoNegocioService.eliminarGrupo(2)).rejects.toThrow(ForbiddenError);
    expect(prismaTopLevel.$transaction).not.toHaveBeenCalled();
    expect(tx.grupoNegocio.delete).not.toHaveBeenCalled();
  });

  it('lanza NotFoundError si el grupo no existe', async () => {
    tx.grupoNegocio.findUnique.mockResolvedValue(null);
    await expect(grupoNegocioService.eliminarGrupo(999)).rejects.toThrow(NotFoundError);
  });

  it('borra el grupo y al dueño que quedó sin membresías', async () => {
    tx.grupoNegocio.findUnique.mockResolvedValue({
      id: 7, restaurantes: [{ id: 70 }],
      usuarios: [{ id_usuario: 30, usuario: { es_super_admin: false } }],
    });
    tx.usuarioGrupo.count.mockResolvedValue(0); // el dueño se quedó sin ningún grupo

    await grupoNegocioService.eliminarGrupo(7);

    expect(tx.grupoNegocio.delete).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(tx.usuarioGrupo.count).toHaveBeenCalledWith({ where: { id_usuario: 30 } });
    expect(tx.usuario.delete).toHaveBeenCalledWith({ where: { id: 30 } });
    expect(mockCacheDel).toHaveBeenCalled();
  });

  it('conserva a un usuario que aún pertenece a otro grupo', async () => {
    tx.grupoNegocio.findUnique.mockResolvedValue({
      id: 8, restaurantes: [{ id: 80 }],
      usuarios: [{ id_usuario: 31, usuario: { es_super_admin: false } }],
    });
    tx.usuarioGrupo.count.mockResolvedValue(1); // todavía pertenece a otro grupo

    await grupoNegocioService.eliminarGrupo(8);

    expect(tx.usuario.delete).not.toHaveBeenCalled();
  });
});
