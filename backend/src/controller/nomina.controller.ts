/**
 * NominaController — recibe, valida y delega. Toda operación que mueve dinero
 * (liquidar, aprobar, marcar pagado) queda auditada.
 */

import { Request, Response } from 'express';
import { nominaService } from '../services/nomina.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { BadRequestError, ForbiddenError } from '../exceptions/HttpErrors';
import { registrarAuditoria } from '../repositories/auditoria.repository';
import prisma from '../config/database';
import {
  parametrosNominaSchema, crearPeriodoSchema, crearNovedadSchema, simularCostoSchema,
} from '../dto/nomina.dto';

const pid = (val: string | string[]): number => {
  const n = parseInt(Array.isArray(val) ? val[0] : val, 10);
  if (isNaN(n)) throw new BadRequestError('ID inválido');
  return n;
};

const qs = (val: unknown): string | undefined =>
  Array.isArray(val) ? val[0] : val as string | undefined;

const grupoScope = (req: Request): number | undefined =>
  req.esSuperAdmin ? undefined : req.grupoAdminId;

/**
 * Grupo al que pertenece un periodo nuevo.
 *
 * Un admin de grupo siempre liquida en el suyo. El superadmin no tiene grupo
 * propio, así que se DERIVA de la sede elegida — el frontend no debería tener
 * que conocer los ids de grupo. Solo si tampoco hay sede se pide explícito.
 */
const grupoDestino = async (req: Request): Promise<number> => {
  if (req.grupoAdminId) return req.grupoAdminId;

  const idSede = req.body?.id_restaurante;
  if (idSede) {
    const sede = await prisma.restaurante.findUnique({
      where:  { id: Number(idSede) },
      select: { id_grupo: true },
    });
    if (sede) return sede.id_grupo;
  }

  const explicito = qs(req.query.id_grupo) ?? (req.body?.id_grupo as string | undefined);
  const id = explicito ? parseInt(String(explicito), 10) : NaN;
  if (isNaN(id)) {
    throw new BadRequestError(
      'Elige una sede para el periodo, o indica el grupo de negocio al que pertenece.'
    );
  }
  return id;
};

const auditar = (req: Request, accion: string, idRegistro: number, datos?: unknown) =>
  registrarAuditoria({
    id_usuario:           (req as any).user!.id,
    accion,
    modulo:               'nomina',
    tabla_afectada:       'periodos_nomina',
    id_registro_afectado: idRegistro,
    datos_nuevos:         datos,
    ip_address:           req.auditContext?.ip,
    user_agent:           req.auditContext?.userAgent,
  });

// ── Parámetros legales ────────────────────────────────────────────────────────

export const listarParametros = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ parametros: await nominaService.listarParametros() });
});

export const obtenerParametros = asyncHandler(async (req: Request, res: Response) => {
  res.json({ parametros: await nominaService.obtenerParametros(pid(req.params.anio)) });
});

export const guardarParametros = asyncHandler(async (req: Request, res: Response) => {
  const anio = pid(req.params.anio);
  const data = parametrosNominaSchema.parse(req.body);
  const parametros = await nominaService.guardarParametros(anio, data);

  auditar(req, 'GUARDAR_PARAMETROS_NOMINA', parametros.id, { anio, ...data });
  res.json({
    message: 'Parámetros guardados. Verifícalos antes de liquidar.',
    parametros,
  });
});

export const verificarParametros = asyncHandler(async (req: Request, res: Response) => {
  const anio = pid(req.params.anio);
  const parametros = await nominaService.verificarParametros(anio, (req as any).user!.id);

  auditar(req, 'VERIFICAR_PARAMETROS_NOMINA', parametros.id, { anio });
  res.json({ message: `Parámetros de ${anio} verificados`, parametros });
});

// ── Periodos ──────────────────────────────────────────────────────────────────

export const listarPeriodos = asyncHandler(async (req: Request, res: Response) => {
  const anio = qs(req.query.anio) ? parseInt(qs(req.query.anio)!, 10) : undefined;
  res.json({ periodos: await nominaService.listarPeriodos(grupoScope(req), anio) });
});

export const obtenerPeriodo = asyncHandler(async (req: Request, res: Response) => {
  res.json({ periodo: await nominaService.obtenerPeriodo(pid(req.params.id), grupoScope(req)) });
});

export const crearPeriodo = asyncHandler(async (req: Request, res: Response) => {
  const data = crearPeriodoSchema.parse(req.body);
  const periodo = await nominaService.crearPeriodo(data, await grupoDestino(req));

  auditar(req, 'CREAR_PERIODO_NOMINA', periodo.id, { nombre: periodo.nombre });
  res.status(201).json({ message: 'Periodo creado', periodo });
});

export const prenomina = asyncHandler(async (req: Request, res: Response) => {
  res.json(await nominaService.prenomina(pid(req.params.id), grupoScope(req)));
});

export const liquidar = asyncHandler(async (req: Request, res: Response) => {
  const id = pid(req.params.id);
  const periodo = await nominaService.liquidarPeriodo(id, (req as any).user!.id, grupoScope(req));

  auditar(req, 'LIQUIDAR_NOMINA', id, {
    empleados: periodo.empleados_liquidados,
    total_neto: periodo.total_neto,
  });
  res.json({ message: `Periodo liquidado: ${periodo.empleados_liquidados} empleados`, periodo });
});

export const aprobar = asyncHandler(async (req: Request, res: Response) => {
  const id = pid(req.params.id);
  const periodo = await nominaService.aprobarPeriodo(id, (req as any).user!.id, grupoScope(req));

  auditar(req, 'APROBAR_NOMINA', id, { total_neto: periodo.total_neto });
  res.json({ message: 'Periodo aprobado', periodo });
});

export const marcarPagado = asyncHandler(async (req: Request, res: Response) => {
  const id = pid(req.params.id);
  const periodo = await nominaService.marcarPagado(id, grupoScope(req));

  auditar(req, 'PAGAR_NOMINA', id, { total_neto: periodo.total_neto });
  res.json({ message: 'Periodo marcado como pagado', periodo });
});

export const reabrir = asyncHandler(async (req: Request, res: Response) => {
  const id = pid(req.params.id);
  const periodo = await nominaService.reabrirPeriodo(id, grupoScope(req));

  auditar(req, 'REABRIR_NOMINA', id);
  res.json({ message: 'Periodo reabierto para corrección', periodo });
});

// ── Novedades ─────────────────────────────────────────────────────────────────

export const listarNovedades = asyncHandler(async (req: Request, res: Response) => {
  await nominaService.obtenerPeriodo(pid(req.params.id), grupoScope(req));
  res.json({ novedades: await nominaService.listarNovedades(pid(req.params.id)) });
});

export const crearNovedad = asyncHandler(async (req: Request, res: Response) => {
  const data = crearNovedadSchema.parse(req.body);
  const novedad = await nominaService.crearNovedad(
    pid(req.params.id), data, (req as any).user!.id, grupoScope(req),
  );
  res.status(201).json({ message: 'Novedad registrada', novedad });
});

export const eliminarNovedad = asyncHandler(async (req: Request, res: Response) => {
  await nominaService.eliminarNovedad(pid(req.params.idNovedad), grupoScope(req));
  res.json({ message: 'Novedad eliminada' });
});

// ── Detalles y métricas ───────────────────────────────────────────────────────

export const listarDetalles = asyncHandler(async (req: Request, res: Response) => {
  await nominaService.obtenerPeriodo(pid(req.params.id), grupoScope(req));
  res.json({ detalles: await nominaService.listarDetalles(pid(req.params.id)) });
});

export const obtenerDetalle = asyncHandler(async (req: Request, res: Response) => {
  const detalle = await nominaService.obtenerDetalle(
    pid(req.params.id), pid(req.params.idEmpleado), grupoScope(req),
  );
  res.json({ detalle });
});

export const costoLaboral = asyncHandler(async (req: Request, res: Response) => {
  res.json({ costo: await nominaService.costoLaboral(pid(req.params.id), grupoScope(req)) });
});

export const simularCosto = asyncHandler(async (req: Request, res: Response) => {
  const { salario, anio, nivel_riesgo_arl } = simularCostoSchema.parse(req.body);
  res.json({
    simulacion: await nominaService.simularCosto(
      salario, anio ?? new Date().getFullYear(), nivel_riesgo_arl,
    ),
  });
});

/**
 * Los parámetros legales los toca solo el superadmin: un error ahí afecta a
 * TODOS los grupos que liquiden ese año.
 */
export const soloSuperAdmin = (req: Request, _res: Response, next: (e?: unknown) => void) => {
  if (!req.esSuperAdmin) {
    return next(new ForbiddenError('Solo el super administrador modifica los parámetros legales'));
  }
  next();
};
