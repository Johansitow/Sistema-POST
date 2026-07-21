/**
 * Tests de la Fase 2 (ficha 360 y portal del trabajador):
 *   - KPIs del empleado acotados al grupo (anti fuga entre tenants)
 *   - autogestión del trabajador limitada a datos de contacto
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/usuario.repository', () => ({
  usuarioRepository: {
    findById:               vi.fn(),
    findByCredencial:       vi.fn(),
    perteneceAGrupo:        vi.fn(),
    update:                 vi.fn(),
    resumenEmpleado:        vi.fn(),
    findNomina:             vi.fn(),
    findHistorialSalarios:  vi.fn(),
  },
}));

vi.mock('../../repositories/grupo-negocio.repository', () => ({
  grupoNegocioRepository: { upsertMiembro: vi.fn() },
}));

vi.mock('../../lib/estadoOrden', () => ({
  getEstadoFinalId: vi.fn(() => Promise.resolve(7)),
}));

vi.mock('../../config/database', () => ({
  default: { $transaction: <T>(fn: (tx: unknown) => T): T => fn({}) },
}));

vi.mock('../../config/env', () => ({
  config: { superAdmin: { uuid: 'sa-uuid-fijo' }, jwt: { secret: 'x', refreshSecret: 'y' } },
}));

vi.mock('bcrypt', () => ({
  default: { hash: vi.fn(() => 'hashed'), compare: vi.fn(() => true) },
}));

// ── Imports después de los mocks ──────────────────────────────────────────────

import { usuarioService } from '../usuario.service';
import { authService } from '../auth.service';
import { usuarioRepository } from '../../repositories/usuario.repository';
import { getEstadoFinalId } from '../../lib/estadoOrden';
import { miPerfilSchema } from '../../dto/auth.dto';
import { NotFoundError } from '../../exceptions/HttpErrors';

const RESUMEN_VACIO = {
  ordenes_atendidas: 3,
  ventas_generadas: 250_000,
  cierres_caja: 2,
  diferencia_acumulada: -5_000,
  cierres_con_diferencia: 1,
  ultima_actividad: new Date('2026-07-20'),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usuarioRepository.findById).mockResolvedValue({
    id: 5, uuid: 'u-5', es_super_admin: false,
  } as never);
  vi.mocked(usuarioRepository.resumenEmpleado).mockResolvedValue(RESUMEN_VACIO as never);
});

// ── KPIs del empleado ─────────────────────────────────────────────────────────

describe('usuarioService.obtenerResumen', () => {
  it('acota las agregaciones al grupo del admin (multi-tenant)', async () => {
    vi.mocked(usuarioRepository.perteneceAGrupo).mockResolvedValueOnce({ id: 5 } as never);

    await usuarioService.obtenerResumen(5, 7);

    const [, , idEstado, grupoId] = vi.mocked(usuarioRepository.resumenEmpleado).mock.calls[0];
    expect(idEstado).toBe(7);   // el id de 'ENTREGADA' del helper compartido
    expect(grupoId).toBe(7);    // scope de grupo propagado
  });

  it('sin scope (superadmin) no acota por grupo', async () => {
    await usuarioService.obtenerResumen(5);
    const [, , , grupoId] = vi.mocked(usuarioRepository.resumenEmpleado).mock.calls[0];
    expect(grupoId).toBeUndefined();
  });

  it('rechaza a un empleado de otro grupo antes de agregar nada (anti-IDOR)', async () => {
    vi.mocked(usuarioRepository.perteneceAGrupo).mockResolvedValueOnce(null);

    await expect(usuarioService.obtenerResumen(99, 7)).rejects.toThrow(NotFoundError);
    expect(usuarioRepository.resumenEmpleado).not.toHaveBeenCalled();
  });

  it('usa el mismo criterio de "venta completada" que dashboard y reportes', async () => {
    await usuarioService.obtenerResumen(5);
    expect(getEstadoFinalId).toHaveBeenCalled();
  });

  it('calcula la ventana de análisis a partir de los días pedidos', async () => {
    await usuarioService.obtenerResumen(5, undefined, 90);

    const [, desde] = vi.mocked(usuarioRepository.resumenEmpleado).mock.calls[0];
    const dias = Math.round((Date.now() - (desde as Date).getTime()) / 86_400_000);
    expect(dias).toBe(90);
  });

  it('convierte los Decimal a number para que el JSON sea limpio', async () => {
    const r = await usuarioService.obtenerResumen(5);
    expect(typeof r.ventas_generadas).toBe('number');
    expect(typeof r.diferencia_acumulada).toBe('number');
    expect(r.periodo_dias).toBe(30);
  });
});

// ── Portal del trabajador ─────────────────────────────────────────────────────

describe('miPerfilSchema — whitelist de autogestión', () => {
  it('acepta los datos de contacto', () => {
    const r = miPerfilSchema.parse({ telefono: '3001234567', direccion: 'Calle 1' });
    expect(r).toEqual({ telefono: '3001234567', direccion: 'Calle 1' });
  });

  it('DESCARTA cualquier campo fuera de la whitelist (no escala privilegios)', () => {
    const r = miPerfilSchema.parse({
      telefono: '300',
      cargo: 'Gerente',
      estado_laboral: 'activo',
      id_rol: 1,
      es_super_admin: true,
      salario_base: 99_000_000,
    } as never);

    expect(r).toEqual({ telefono: '300' });
    expect(r).not.toHaveProperty('cargo');
    expect(r).not.toHaveProperty('id_rol');
    expect(r).not.toHaveProperty('es_super_admin');
  });

  it("convierte '' en null para poder BORRAR un dato", () => {
    const r = miPerfilSchema.parse({ direccion: '' });
    expect(r).toEqual({ direccion: null });
  });

  it('omite los campos no enviados en vez de ponerlos en null', () => {
    const r = miPerfilSchema.parse({ telefono: '300' });
    expect(Object.keys(r)).toEqual(['telefono']);
  });
});

describe('authService.actualizarMiPerfil', () => {
  it('actualiza SIEMPRE el id del token, nunca uno recibido del cliente', async () => {
    vi.mocked(usuarioRepository.update).mockResolvedValueOnce({ id: 5 } as never);

    await authService.actualizarMiPerfil(5, { telefono: '300' });

    const [idActualizado] = vi.mocked(usuarioRepository.update).mock.calls[0];
    expect(idActualizado).toBe(5);
  });

  it('falla si el usuario del token ya no existe', async () => {
    vi.mocked(usuarioRepository.findById).mockResolvedValueOnce(null as never);
    await expect(authService.actualizarMiPerfil(99, { telefono: '300' }))
      .rejects.toThrow(NotFoundError);
  });
});

describe('authService.getMiNomina', () => {
  it('lee la nómina y el historial del propio usuario', async () => {
    vi.mocked(usuarioRepository.findNomina).mockResolvedValueOnce({ salario_base: 1 } as never);
    vi.mocked(usuarioRepository.findHistorialSalarios).mockResolvedValueOnce([] as never);

    const r = await authService.getMiNomina(5);

    expect(usuarioRepository.findNomina).toHaveBeenCalledWith(5);
    expect(usuarioRepository.findHistorialSalarios).toHaveBeenCalledWith(5);
    expect(r).toHaveProperty('nomina');
    expect(r).toHaveProperty('historial');
  });
});
