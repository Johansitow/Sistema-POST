/**
 * Tests de la ficha del empleado (Fase 1):
 *   - código de empleado consecutivo por grupo
 *   - persistencia de los datos de empleado al CREAR (antes se descartaban)
 *   - historial salarial automático al guardar nómina
 *   - coherencia entre estado_laboral = retirado y fecha_retiro
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/usuario.repository', () => ({
  usuarioRepository: {
    findById:                vi.fn(),
    findByEmail:             vi.fn(),
    findByUsuario:           vi.fn(),
    findRolById:             vi.fn(),
    findUsuarioActivoConRol: vi.fn(),
    create:                  vi.fn(),
    update:                  vi.fn(),
    perteneceAGrupo:         vi.fn(),
    findNomina:              vi.fn(),
    upsertNomina:            vi.fn(),
    findCodigosEmpleado:     vi.fn(),
    createHistorialSalario:  vi.fn(),
    findHistorialSalarios:   vi.fn(),
  },
}));

vi.mock('../../repositories/grupo-negocio.repository', () => ({
  grupoNegocioRepository: { upsertMiembro: vi.fn() },
}));

vi.mock('../../config/database', () => ({
  default: {
    $transaction: <T>(fn: (tx: unknown) => T): T => fn({}),
  },
}));

vi.mock('../../config/env', () => ({
  config: { superAdmin: { uuid: 'sa-uuid-fijo' } },
}));

vi.mock('bcrypt', () => ({
  default: { hash: vi.fn(() => 'hashed'), compare: vi.fn() },
}));

// ── Imports después de los mocks ──────────────────────────────────────────────

import { usuarioService } from '../usuario.service';
import { usuarioRepository } from '../../repositories/usuario.repository';
import { BadRequestError } from '../../exceptions/HttpErrors';

const codigos = (...vals: (string | null)[]) =>
  vals.map(codigo_empleado => ({ codigo_empleado }));

/** Prepara los mocks para que usuarioService.crear() llegue hasta el repo. */
const prepararCreacion = () => {
  vi.mocked(usuarioRepository.findByEmail).mockResolvedValueOnce(null);
  vi.mocked(usuarioRepository.findByUsuario).mockResolvedValueOnce(null);
  vi.mocked(usuarioRepository.findRolById).mockResolvedValueOnce({
    id: 3, nombre: 'Cajero', es_super_admin: false,
  } as never);
  vi.mocked(usuarioRepository.create).mockResolvedValueOnce({ id: 42 } as never);
};

const BASE = {
  nombre_completo: 'Ana Pérez',
  email:           'ana@x.com',
  usuario:         'ana',
  password:        '12345678',
  id_rol:          3,
};

beforeEach(() => { vi.clearAllMocks(); });

// ── Código de empleado ────────────────────────────────────────────────────────

describe('generarCodigoEmpleado', () => {
  it('arranca en EMP-0001 cuando el grupo no tiene ningún empleado', async () => {
    vi.mocked(usuarioRepository.findCodigosEmpleado).mockResolvedValueOnce([] as never);
    expect(await usuarioService.generarCodigoEmpleado(7)).toBe('EMP-0001');
  });

  it('continúa el consecutivo desde el mayor existente', async () => {
    vi.mocked(usuarioRepository.findCodigosEmpleado)
      .mockResolvedValueOnce(codigos('EMP-0001', 'EMP-0007', 'EMP-0003') as never);
    expect(await usuarioService.generarCodigoEmpleado(7)).toBe('EMP-0008');
  });

  it('compara numéricamente, no por orden alfabético (EMP-10000 > EMP-9999)', async () => {
    vi.mocked(usuarioRepository.findCodigosEmpleado)
      .mockResolvedValueOnce(codigos('EMP-9999', 'EMP-10000') as never);
    expect(await usuarioService.generarCodigoEmpleado(7)).toBe('EMP-10001');
  });

  it('ignora códigos con formato distinto en lugar de romperse', async () => {
    vi.mocked(usuarioRepository.findCodigosEmpleado)
      .mockResolvedValueOnce(codigos('MANUAL-X', null, 'EMP-0002') as never);
    expect(await usuarioService.generarCodigoEmpleado(7)).toBe('EMP-0003');
  });

  it('acota la búsqueda al grupo del administrador (multi-tenant)', async () => {
    vi.mocked(usuarioRepository.findCodigosEmpleado).mockResolvedValueOnce([] as never);
    await usuarioService.generarCodigoEmpleado(7);
    expect(usuarioRepository.findCodigosEmpleado).toHaveBeenCalledWith(7, undefined);
  });
});

// ── Persistencia de datos de empleado al crear ───────────────────────────────

describe('crear — datos de empleado', () => {
  it('guarda los campos de empleado enviados en el alta', async () => {
    prepararCreacion();
    vi.mocked(usuarioRepository.findCodigosEmpleado).mockResolvedValueOnce([] as never);

    await usuarioService.crear({
      ...BASE,
      cargo:               'Chef Principal',
      documento_identidad: '1020304050',
      eps:                 'Sura',
      fecha_ingreso:       '2026-03-01',
    }, 1, 7);

    const enviado = vi.mocked(usuarioRepository.create).mock.calls[0][0];
    expect(enviado.cargo).toBe('Chef Principal');
    expect(enviado.documento_identidad).toBe('1020304050');
    expect(enviado.eps).toBe('Sura');
    expect(enviado.fecha_ingreso).toBeInstanceOf(Date);
  });

  it('asigna el código de empleado generado', async () => {
    prepararCreacion();
    vi.mocked(usuarioRepository.findCodigosEmpleado)
      .mockResolvedValueOnce(codigos('EMP-0004') as never);

    await usuarioService.crear(BASE, 1, 7);

    expect(vi.mocked(usuarioRepository.create).mock.calls[0][0].codigo_empleado)
      .toBe('EMP-0005');
  });

  it('rechaza una fecha inválida en lugar de guardar Invalid Date', async () => {
    prepararCreacion();
    vi.mocked(usuarioRepository.findCodigosEmpleado).mockResolvedValueOnce([] as never);

    await expect(
      usuarioService.crear({ ...BASE, fecha_ingreso: 'no-es-fecha' }, 1, 7)
    ).rejects.toThrow(BadRequestError);
  });
});

// ── Coherencia del retiro ─────────────────────────────────────────────────────

describe('coherencia estado_laboral / fecha_retiro', () => {
  const targetActivo = {
    id: 5, uuid: 'u-5', es_super_admin: false,
    estado_laboral: 'activo', fecha_retiro: null,
  };

  it('rechaza marcar retirado sin fecha de retiro', async () => {
    vi.mocked(usuarioRepository.findById).mockResolvedValueOnce(targetActivo as never);
    await expect(
      usuarioService.actualizar(5, { estado_laboral: 'retirado' })
    ).rejects.toThrow(BadRequestError);
  });

  it('rechaza fecha de retiro si el empleado no está retirado', async () => {
    vi.mocked(usuarioRepository.findById).mockResolvedValueOnce(targetActivo as never);
    await expect(
      usuarioService.actualizar(5, { fecha_retiro: '2026-06-30' })
    ).rejects.toThrow(BadRequestError);
  });

  it('acepta retiro con estado y fecha coherentes', async () => {
    vi.mocked(usuarioRepository.findById).mockResolvedValueOnce(targetActivo as never);
    vi.mocked(usuarioRepository.update).mockResolvedValueOnce({ id: 5 } as never);

    await usuarioService.actualizar(5, {
      estado_laboral: 'retirado',
      fecha_retiro:   '2026-06-30',
      motivo_retiro:  'Renuncia voluntaria',
    });

    const enviado = vi.mocked(usuarioRepository.update).mock.calls[0][1];
    expect(enviado.estado_laboral).toBe('retirado');
    expect(enviado.fecha_retiro).toBeInstanceOf(Date);
  });

  it('valida contra el estado ya guardado, no solo contra el payload', async () => {
    // Ya está retirado en base; ahora se intenta borrar la fecha de retiro
    vi.mocked(usuarioRepository.findById).mockResolvedValueOnce({
      ...targetActivo, estado_laboral: 'retirado', fecha_retiro: new Date('2026-01-01'),
    } as never);

    await expect(
      usuarioService.actualizar(5, { fecha_retiro: null })
    ).rejects.toThrow(BadRequestError);
  });
});

// ── Historial salarial ────────────────────────────────────────────────────────

describe('upsertNomina — historial salarial', () => {
  beforeEach(() => {
    vi.mocked(usuarioRepository.findById).mockResolvedValue({
      id: 5, uuid: 'u-5', es_super_admin: false,
    } as never);
    vi.mocked(usuarioRepository.upsertNomina).mockResolvedValue({ id: 1 } as never);
  });

  it('registra el salario inicial cuando el empleado no tenía nómina', async () => {
    vi.mocked(usuarioRepository.findNomina).mockResolvedValueOnce(null);

    await usuarioService.upsertNomina(5, undefined,
      { salario_base: 1_800_000, tipo_pago: 'mensual' }, 9);

    const h = vi.mocked(usuarioRepository.createHistorialSalario).mock.calls[0][0];
    expect(h.salario_anterior).toBeNull();
    expect(h.salario_nuevo).toBe(1_800_000);
    expect(h.motivo).toBe('Salario inicial');
    expect(h.id_registrado_por).toBe(9);
  });

  it('registra el cambio conservando el salario anterior', async () => {
    vi.mocked(usuarioRepository.findNomina).mockResolvedValueOnce({
      salario_base: 1_800_000, tipo_pago: 'mensual',
    } as never);

    await usuarioService.upsertNomina(5, undefined,
      { salario_base: 2_100_000, tipo_pago: 'mensual', motivo: 'Ascenso' }, 9);

    const h = vi.mocked(usuarioRepository.createHistorialSalario).mock.calls[0][0];
    expect(h.salario_anterior).toBe(1_800_000);
    expect(h.salario_nuevo).toBe(2_100_000);
    expect(h.motivo).toBe('Ascenso');
  });

  it('NO registra historial si solo cambian datos bancarios', async () => {
    vi.mocked(usuarioRepository.findNomina).mockResolvedValueOnce({
      salario_base: 1_800_000, tipo_pago: 'mensual',
    } as never);

    await usuarioService.upsertNomina(5, undefined, {
      salario_base: 1_800_000, tipo_pago: 'mensual', banco: 'Bancolombia',
    }, 9);

    expect(usuarioRepository.createHistorialSalario).not.toHaveBeenCalled();
  });

  it('registra historial si cambia la frecuencia de pago', async () => {
    vi.mocked(usuarioRepository.findNomina).mockResolvedValueOnce({
      salario_base: 1_800_000, tipo_pago: 'mensual',
    } as never);

    await usuarioService.upsertNomina(5, undefined,
      { salario_base: 1_800_000, tipo_pago: 'quincenal' }, 9);

    expect(usuarioRepository.createHistorialSalario).toHaveBeenCalledTimes(1);
  });

  it('no guarda vigencia_desde ni motivo dentro de NominaEmpleado', async () => {
    vi.mocked(usuarioRepository.findNomina).mockResolvedValueOnce(null);

    await usuarioService.upsertNomina(5, undefined, {
      salario_base: 1_800_000, tipo_pago: 'mensual',
      vigencia_desde: '2026-04-01', motivo: 'Ajuste anual',
    }, 9);

    const guardado = vi.mocked(usuarioRepository.upsertNomina).mock.calls[0][1];
    expect(guardado).not.toHaveProperty('vigencia_desde');
    expect(guardado).not.toHaveProperty('motivo');

    const h = vi.mocked(usuarioRepository.createHistorialSalario).mock.calls[0][0];
    expect(h.vigencia_desde).toEqual(new Date('2026-04-01'));
  });
});
