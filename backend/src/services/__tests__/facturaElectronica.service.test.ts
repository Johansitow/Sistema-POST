/**
 * Tests de facturaElectronicaService — emisión on-demand, idempotencia y config.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/facturaElectronica.repository', () => ({
  facturaElectronicaRepository: {
    create: vi.fn(), findByOrden: vi.fn(), findById: vi.fn(), update: vi.fn(),
    listByGrupo: vi.fn(), findReintentables: vi.fn(),
  },
}));
vi.mock('../../repositories/configuracion-grupo.repository', () => ({
  configuracionGrupoRepository: { findByClave: vi.fn(), upsert: vi.fn() },
}));
vi.mock('../configuracion.service', () => ({
  configuracionService: { resolverTasaImpuestoDeRestaurante: vi.fn() },
}));
vi.mock('../../repositories/orden.repository', () => ({
  ordenRepository: { findByIdScoped: vi.fn() },
}));
vi.mock('../../repositories/auditoria.repository', () => ({ registrarAuditoria: vi.fn() }));
vi.mock('../../lib/crypto/secretBox', () => ({
  cifrar: (s: string) => `enc:${s}`,
  descifrar: (s: string) => s.replace(/^enc:/, ''),
}));
vi.mock('../../lib/facturacion', () => ({
  proveedorFE: { disponible: vi.fn(() => false), emitir: vi.fn(), consultarEstado: vi.fn() },
  nuevaReferencia: () => 'fe_test_ref',
}));

import { facturaElectronicaService } from '../facturaElectronica.service';
import { facturaElectronicaRepository } from '../../repositories/facturaElectronica.repository';
import { configuracionGrupoRepository } from '../../repositories/configuracion-grupo.repository';
import { configuracionService } from '../configuracion.service';
import { ordenRepository } from '../../repositories/orden.repository';
import { proveedorFE } from '../../lib/facturacion';
import { BadRequestError } from '../../exceptions/HttpErrors';

const feRepo = facturaElectronicaRepository as any;
const cfgGrupo = configuracionGrupoRepository as any;
const cfgSvc = configuracionService as any;
const ordenRepo = ordenRepository as any;
const prov = proveedorFE as any;

const ctx = { grupoId: 7, restauranteId: 3, esSuperAdmin: false };
const adquiriente = { tipo_documento: '13', numero_documento: '123', nombre: 'Juan' };

const ordenMock = {
  id: 42, id_grupo: 7, id_restaurante: 3,
  subtotal: 10000, impuestos: 1900, total: 11900,
  sedes: [], detalles: [{ producto: { nombre: 'Café' }, cantidad: 2, precio_unitario: 5000, descuento: 0 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  cfgSvc.resolverTasaImpuestoDeRestaurante.mockResolvedValue({ tarifa: 19, tipo: 'iva' });
});

describe('emitirParaOrden', () => {
  it('con driver noop: emite y persiste estado emitida', async () => {
    ordenRepo.findByIdScoped.mockResolvedValue(ordenMock);
    feRepo.findByOrden.mockResolvedValue(null);
    feRepo.create.mockResolvedValue({ id: 1, referencia: 'fe_test_ref', estado: 'pendiente' });
    prov.disponible.mockReturnValue(false);
    prov.emitir.mockResolvedValue({ estado: 'emitida', cufe: 'CUFE123', numero: 'SETP-1' });
    feRepo.update.mockResolvedValue({ id: 1, estado: 'emitida', cufe: 'CUFE123', numero: 'SETP-1' });

    const res = await facturaElectronicaService.emitirParaOrden(42, ctx as any, adquiriente);

    expect(res.estado).toBe('emitida');
    expect(feRepo.create).toHaveBeenCalledOnce();
    expect(feRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ estado: 'emitida', cufe: 'CUFE123' }));
  });

  it('es idempotente: si la orden ya tiene FE emitida, la devuelve sin re-emitir', async () => {
    ordenRepo.findByIdScoped.mockResolvedValue(ordenMock);
    feRepo.findByOrden.mockResolvedValue({ id: 9, estado: 'emitida', cufe: 'YA' });

    const res = await facturaElectronicaService.emitirParaOrden(42, ctx as any, adquiriente);

    expect(res.cufe).toBe('YA');
    expect(prov.emitir).not.toHaveBeenCalled();
    expect(feRepo.create).not.toHaveBeenCalled();
  });

  it('con driver real (factus) sin config del tenant → BadRequestError', async () => {
    ordenRepo.findByIdScoped.mockResolvedValue(ordenMock);
    feRepo.findByOrden.mockResolvedValue(null);
    prov.disponible.mockReturnValue(true);            // factus activo
    cfgGrupo.findByClave.mockResolvedValue(null);     // sin config fiscal

    await expect(facturaElectronicaService.emitirParaOrden(42, ctx as any, adquiriente))
      .rejects.toThrow(BadRequestError);
    expect(prov.emitir).not.toHaveBeenCalled();
  });
});

describe('config fiscal (cifrado)', () => {
  it('guardarConfig cifra las credenciales y getConfig nunca las devuelve', async () => {
    cfgGrupo.findByClave.mockResolvedValue(null); // sin config previa
    cfgGrupo.upsert.mockResolvedValue({});

    await facturaElectronicaService.guardarConfig(7, {
      razon_social: 'Mi Negocio', numbering_range_id: 5,
      credenciales: { clientId: 'c', clientSecret: 's', username: 'u', password: 'p' },
    });

    const [, clave, valor] = cfgGrupo.upsert.mock.calls[0];
    expect(clave).toBe('facturacion.dian.config');
    const guardado = JSON.parse(valor);
    expect(guardado.secretos).toMatch(/^enc:/);         // credenciales cifradas
    expect(valor).not.toContain('"password":"p"');      // no en claro

    // getConfig lee esa misma config y no expone secretos
    cfgGrupo.findByClave.mockResolvedValue({ valor });
    const cfg = await facturaElectronicaService.getConfig(7);
    expect(cfg).toMatchObject({ configurada: true, tiene_credenciales: true, razon_social: 'Mi Negocio' });
    expect(JSON.stringify(cfg)).not.toContain('password');
  });
});
