/**
 * ReportesController — despacha via QueryBus (CQRS read side)
 *
 * getVentas          → QueryBus (GetReporteVentasQuery)
 * getReporteCompleto → QueryBus (GetReporteCompletoQuery)
 * El resto llama al service directamente (migración gradual).
 *
 * Endpoints consolidados por grupo:
 *   GET /reportes/consolidado/:id_grupo             → getConsolidadoGrupo
 *   GET /reportes/consolidado/:id_grupo/ventas      → getVentasGrupo
 *   GET /reportes/consolidado/:id_grupo/productos   → getProductosGrupo
 *   GET /reportes/consolidado/:id_grupo/pagos       → getPagosGrupo
 *   GET /reportes/consolidado/:id_grupo/clientes    → getClientesGrupo
 */

import { Request, Response } from 'express';
import { TipoOrden } from '@prisma/client';
import { reporteService } from '../services/reporte.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { queryBus } from '../application/queries/QueryBus';
import { GetReporteVentasQuery }   from '../application/queries/reportes/GetReporteVentasQuery';
import { GetReporteCompletoQuery } from '../application/queries/reportes/GetReporteCompletoQuery';
import { GetResumenVentasQuery }   from '../application/queries/reportes/GetResumenVentasQuery';
import { successResponse } from '../lib/response';

const qs = (val: unknown): string | undefined => Array.isArray(val) ? val[0] : val as string | undefined;

const parseFechas = (req: Request) => ({
  fecha_desde: req.query.fecha_desde ? new Date(qs(req.query.fecha_desde)!) : undefined,
  fecha_hasta: req.query.fecha_hasta ? new Date(qs(req.query.fecha_hasta)!) : undefined,
});

export const getVentas = asyncHandler(async (req: Request, res: Response) => {
  const result = await queryBus.execute(new GetReporteVentasQuery({
    ...parseFechas(req),
    tipo_orden:    qs(req.query.tipo_orden) as TipoOrden | undefined,
    agrupar_por:   qs(req.query.agrupar_por),
    restauranteId: req.restauranteId,
  }));
  res.json(result);
});

export const getReporteCompleto = asyncHandler(async (req: Request, res: Response) => {
  const result = await queryBus.execute(new GetReporteCompletoQuery({
    ...parseFechas(req),
    restauranteId: req.restauranteId,
  }));
  res.json(result);
});

export const getResumenVentas = asyncHandler(async (req: Request, res: Response) => {
  const dias = req.query.dias ? Number(req.query.dias) : 30;
  const result = await queryBus.execute(new GetResumenVentasQuery(dias, req.restauranteId));
  res.json({ success: true, data: result });
});

export const getProductosMasVendidos = asyncHandler(async (req: Request, res: Response) => {
  const result = await reporteService.getProductosMasVendidos({
    ...parseFechas(req),
    limit:          req.query.limit ? Number(req.query.limit) : 20,
    id_restaurante: req.restauranteId,
  });
  res.json(result);
});

export const getVentasPorCategoria = asyncHandler(async (req: Request, res: Response) => {
  const result = await reporteService.getVentasPorCategoria({
    ...parseFechas(req),
    id_restaurante: req.restauranteId,
  });
  res.json(result);
});

export const getMetodosPago = asyncHandler(async (req: Request, res: Response) => {
  const result = await reporteService.getMetodosPago({
    ...parseFechas(req),
    id_restaurante: req.restauranteId,
  });
  res.json(result);
});

export const getVentasPorHora = asyncHandler(async (req: Request, res: Response) => {
  const result = await reporteService.getVentasPorHora({
    ...parseFechas(req),
    id_restaurante: req.restauranteId,
  });
  res.json(result);
});

export const getValorMerma = asyncHandler(async (req: Request, res: Response) => {
  const result = await reporteService.getValorMerma(parseFechas(req));
  res.json(result);
});

export const getTendenciasConsumo = asyncHandler(async (_req: Request, res: Response) => {
  const result = await reporteService.getTendenciasConsumo();
  res.json(result);
});

export const getTopClientes = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const result = await reporteService.getTopClientes(limit);
  res.json(result);
});

export const getLotesPorVencer = asyncHandler(async (req: Request, res: Response) => {
  const dias = req.query.dias ? Number(req.query.dias) : 30;
  const result = await reporteService.getLotesPorVencer(dias);
  res.json(result);
});

// ─── Handlers consolidados por grupo ─────────────────────────────────────────

/** Extrae y valida el id_grupo de los params */
const parseIdGrupo = (req: Request): number => parseInt(req.params['id_grupo'] as string, 10);

/**
 * GET /reportes/consolidado/:id_grupo
 * Reporte completo del grupo: ventas + productos + pagos + clientes.
 */
export const getConsolidadoGrupo = asyncHandler(async (req: Request, res: Response) => {
  const idGrupo = parseIdGrupo(req);
  const result  = await reporteService.getReporteConsolidadoGrupo(idGrupo, parseFechas(req));
  res.json(successResponse(result));
});

/**
 * GET /reportes/consolidado/:id_grupo/ventas
 * Solo ventas consolidadas del grupo, desglosadas por restaurante y periodo.
 */
export const getVentasGrupo = asyncHandler(async (req: Request, res: Response) => {
  const idGrupo    = parseIdGrupo(req);
  const agrupar_por = qs(req.query.agrupar_por);
  const result     = await reporteService.getVentasConsolidadasGrupo(idGrupo, {
    ...parseFechas(req),
    agrupar_por,
  });
  res.json(successResponse(result));
});

/**
 * GET /reportes/consolidado/:id_grupo/productos
 * Top productos vendidos en todos los restaurantes del grupo.
 */
export const getProductosGrupo = asyncHandler(async (req: Request, res: Response) => {
  const idGrupo = parseIdGrupo(req);
  const result  = await reporteService.getProductosMasVendidosGrupo(idGrupo, {
    ...parseFechas(req),
    limit: req.query.limit ? Number(req.query.limit) : 20,
  });
  res.json(successResponse(result));
});

/**
 * GET /reportes/consolidado/:id_grupo/pagos
 * Métodos de pago consolidados (PagoGrupo + Pago) para el grupo.
 */
export const getPagosGrupo = asyncHandler(async (req: Request, res: Response) => {
  const idGrupo = parseIdGrupo(req);
  const result  = await reporteService.getMetodosPagoGrupo(idGrupo, parseFechas(req));
  res.json(successResponse(result));
});

/**
 * GET /reportes/consolidado/:id_grupo/clientes
 * Top clientes por gasto total en el grupo.
 */
export const getClientesGrupo = asyncHandler(async (req: Request, res: Response) => {
  const idGrupo = parseIdGrupo(req);
  const limit   = req.query.limit ? Number(req.query.limit) : 20;
  const result  = await reporteService.getTopClientesGrupo(idGrupo, limit);
  res.json(successResponse(result));
});

/**
 * GET /reportes/super-consolidado
 * Reporte maestro: agrega TODOS los grupos del sistema.
 * Exclusivo del super admin — el router lo protege con requireSuperAdmin.
 */
export const getSuperConsolidado = asyncHandler(async (req: Request, res: Response) => {
  const result = await reporteService.getSuperConsolidado(parseFechas(req));
  res.json(successResponse(result));
});
