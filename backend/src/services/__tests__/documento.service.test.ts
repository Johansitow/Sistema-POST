/**
 * Tests de documentoService — certificación laboral.
 *
 * Cubre las brechas cerradas al extender el módulo de documentos:
 *   · Aislamiento multi-tenant: un empleado de OTRO grupo → NotFound (404).
 *   · Toggle incluirSalario: oculta/muestra el párrafo de salario del certificado.
 *   · Redacción activo vs retirado: presente vs pasado con fecha de retiro.
 *   · Guard assertPuedeEmitir: sin grupo ni superadmin → Forbidden (403).
 *
 * Se prueba sobre `previsualizar`, que recorre el mismo ensamblado y render que
 * la emisión pero sin persistir (sin transacción).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/usuario.repository', () => ({
  usuarioRepository: {
    findById:        vi.fn(),
    perteneceAGrupo: vi.fn(),
    findNomina:      vi.fn(),
  },
}));

vi.mock('../../repositories/documento.repository', () => ({
  documentoRepository: {
    findUltimoDelAnio:         vi.fn(),
    create:                    vi.fn(),
    findByEmpleado:            vi.fn(),
    findContenido:             vi.fn(),
    anular:                    vi.fn(),
    findByCodigo:              vi.fn(),
    findDesprendibleDePeriodo: vi.fn(),
  },
}));

vi.mock('../../repositories/plantilla.repository', () => ({
  plantillaRepository: { findAll: vi.fn() },
}));

vi.mock('../../config/database', () => ({
  default: {
    grupoNegocio:  { findUnique: vi.fn() },
    restaurante:   { findUnique: vi.fn() },
    nominaDetalle: { findUnique: vi.fn(), findMany: vi.fn() },
    $transaction: <T>(fn: (tx: unknown) => T): T => fn({}),
  },
}));

vi.mock('../../config/env', () => ({
  config: { cors: { origin: 'http://localhost:5173' } },
}));

import { documentoService, assertPuedeEmitir } from '../documento.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../exceptions/HttpErrors';
import { usuarioRepository } from '../../repositories/usuario.repository';
import { documentoRepository } from '../../repositories/documento.repository';
import { plantillaRepository } from '../../repositories/plantilla.repository';
import prisma from '../../config/database';

// ── Helpers ─────────────────────────────────────────────────────────────────

const GRUPO_ID = 7;
const TIPO = 'documento_certificado_laboral';

function empleadoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    nombre_completo:     'María Rodríguez Gómez',
    tipo_documento:      'cc',
    documento_identidad: '1020304050',
    cargo:               'Chef Principal',
    fecha_ingreso:       new Date(Date.UTC(2024, 2, 15)),
    fecha_retiro:        null,
    motivo_retiro:       null,
    tipo_contrato:       'indefinido',
    jornada:             'completa',
    codigo_empleado:     'EMP-0042',
    email:               'maria@empresa.com',
    telefono:            '3001234567',
    estado_laboral:      'activo',
    restaurante_base:    null,
    ...overrides,
  };
}

/** Configura los mocks para que el ensamblado del certificado funcione. */
function armarEscenario(empleado: Record<string, unknown>) {
  vi.mocked(usuarioRepository.findById).mockResolvedValue(empleado as never);
  vi.mocked(usuarioRepository.perteneceAGrupo).mockResolvedValue(true as never);
  vi.mocked(usuarioRepository.findNomina).mockResolvedValue(
    { salario_base: 1_800_000, tipo_pago: 'mensual' } as never,
  );
  vi.mocked(plantillaRepository.findAll).mockResolvedValue([] as never); // usa catálogo
  vi.mocked(prisma.grupoNegocio.findUnique).mockResolvedValue(
    { id: GRUPO_ID, nombre: 'Restaurante Ejemplo S.A.S.', nit: '900123456-7', logo_url: null } as never,
  );
}

const previsualizar = (opts: { incluirSalario?: boolean } = {}) =>
  documentoService.previsualizar(
    TIPO, 42, { firmante: 'Juan Pérez', ...opts }, GRUPO_ID,
  );

beforeEach(() => vi.clearAllMocks());

// ── Multi-tenant ──────────────────────────────────────────────────────────────

describe('documentoService — aislamiento multi-tenant', () => {
  it('empleado de otro grupo → NotFound (no filtra datos cross-tenant)', async () => {
    vi.mocked(usuarioRepository.findById).mockResolvedValue(empleadoBase() as never);
    vi.mocked(usuarioRepository.perteneceAGrupo).mockResolvedValue(false as never);

    await expect(previsualizar()).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ── Toggle de salario ─────────────────────────────────────────────────────────

describe('documentoService — toggle incluirSalario', () => {
  it('incluirSalario:true → el certificado incluye la línea de salario', async () => {
    armarEscenario(empleadoBase());
    const { html } = await previsualizar({ incluirSalario: true });
    expect(html).toContain('asignación salarial');
  });

  it('incluirSalario:false → el certificado NO incluye la línea de salario', async () => {
    armarEscenario(empleadoBase());
    const { html } = await previsualizar({ incluirSalario: false });
    expect(html).not.toContain('asignación salarial');
  });

  it('por defecto (sin flag) muestra el salario', async () => {
    armarEscenario(empleadoBase());
    const { html } = await previsualizar();
    expect(html).toContain('asignación salarial');
  });
});

// ── Redacción activo vs retirado ───────────────────────────────────────────────

describe('documentoService — redacción activo vs retirado', () => {
  it('empleado activo → presente ("labora") y sin fecha de retiro', async () => {
    armarEscenario(empleadoBase());
    const { html } = await previsualizar();
    expect(html).toContain('labora en esta empresa desde el');
    expect(html).not.toContain('laboró'); // sin redacción en pasado
  });

  it('empleado retirado → pasado ("laboró") con fecha de retiro', async () => {
    armarEscenario(empleadoBase({
      estado_laboral: 'retirado',
      fecha_retiro:   new Date(Date.UTC(2026, 5, 30)),
      motivo_retiro:  'renuncia voluntaria',
    }));
    const { html } = await previsualizar();
    expect(html).toContain('laboró en esta empresa');
    expect(html).toContain('hasta el');
    expect(html).toContain('30 de junio de 2026');
  });
});

// ── Guard de permiso (respalda el 403 de ruta) ─────────────────────────────────

describe('assertPuedeEmitir', () => {
  it('sin grupo ni superadmin → Forbidden', () => {
    expect(() => assertPuedeEmitir(false, undefined)).toThrow(ForbiddenError);
  });

  it('superadmin → permitido', () => {
    expect(() => assertPuedeEmitir(true, undefined)).not.toThrow();
  });

  it('admin de grupo → permitido', () => {
    expect(() => assertPuedeEmitir(false, GRUPO_ID)).not.toThrow();
  });
});

// ── Portal del trabajador — autoservicio ───────────────────────────────────────

describe('documentoService — autoservicio del trabajador', () => {
  it('listarMisDocumentos consulta por el id del token', async () => {
    vi.mocked(documentoRepository.findByEmpleado).mockResolvedValue([] as never);
    await documentoService.listarMisDocumentos(42);
    expect(documentoRepository.findByEmpleado).toHaveBeenCalledWith(42);
  });

  it('obtenerMiContenido: documento de OTRO empleado → NotFound (anti-IDOR)', async () => {
    vi.mocked(documentoRepository.findContenido).mockResolvedValue(
      { id: 5, id_empleado: 999, contenido_html: '<html></html>' } as never,
    );
    await expect(documentoService.obtenerMiContenido(5, 42)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('obtenerMiContenido: documento propio → lo devuelve', async () => {
    const doc = { id: 5, id_empleado: 42, contenido_html: '<html>ok</html>' };
    vi.mocked(documentoRepository.findContenido).mockResolvedValue(doc as never);
    await expect(documentoService.obtenerMiContenido(5, 42)).resolves.toBe(doc);
  });

  it('emitirMiDesprendible: idempotente — reutiliza el existente sin crear otro', async () => {
    const existente = { id: 8, consecutivo: 'DP-2026-0003' };
    vi.mocked(documentoRepository.findDesprendibleDePeriodo).mockResolvedValue(existente as never);

    const doc = await documentoService.emitirMiDesprendible(42, 'María', 10);

    expect(doc).toBe(existente);
    expect(documentoRepository.findUltimoDelAnio).not.toHaveBeenCalled();
    expect(documentoRepository.create).not.toHaveBeenCalled();
  });

  it('emitirMiDesprendible: sin liquidación en el periodo → BadRequest', async () => {
    vi.mocked(documentoRepository.findDesprendibleDePeriodo).mockResolvedValue(null as never);
    // Empleado con sede base para que se resuelva la empresa…
    vi.mocked(usuarioRepository.findById).mockResolvedValue(
      empleadoBase({ restaurante_base: { id: 1 } }) as never,
    );
    vi.mocked(prisma.restaurante.findUnique).mockResolvedValue(
      { id: 1, nombre: 'Sede', nit: null, ciudad: null, direccion: null, telefono: null, logo_url: null, id_grupo: GRUPO_ID } as never,
    );
    vi.mocked(prisma.grupoNegocio.findUnique).mockResolvedValue(
      { id: GRUPO_ID, nombre: 'Empresa', nit: null, logo_url: null } as never,
    );
    vi.mocked(usuarioRepository.findNomina).mockResolvedValue(
      { salario_base: 1_800_000, tipo_pago: 'mensual' } as never,
    );
    vi.mocked(plantillaRepository.findAll).mockResolvedValue([] as never);
    // …pero el empleado no tiene NominaDetalle en ese periodo.
    vi.mocked(prisma.nominaDetalle.findUnique).mockResolvedValue(null as never);

    await expect(documentoService.emitirMiDesprendible(42, 'María', 10))
      .rejects.toBeInstanceOf(BadRequestError);
  });

  it('listarMisPeriodos: solo periodos aprobados/pagados del propio empleado', async () => {
    vi.mocked(prisma.nominaDetalle.findMany).mockResolvedValue([
      { neto_pagar: 1_500_000, periodo: { id: 10, nombre: 'Julio 2026', fecha_inicio: new Date(), fecha_fin: new Date(), estado: 'aprobada' } },
    ] as never);

    const periodos = await documentoService.listarMisPeriodos(42);

    expect(periodos).toHaveLength(1);
    expect(periodos[0].id_periodo).toBe(10);
    const arg = vi.mocked(prisma.nominaDetalle.findMany).mock.calls[0][0] as { where: { id_empleado: number } };
    expect(arg.where.id_empleado).toBe(42);
  });
});
