/**
 * DashboardController — despacha via QueryBus (CQRS read side)
 *
 * getStats → QueryBus (GetDashboardStatsQuery)
 * El resto llama al service directamente (migración gradual).
 */

import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { queryBus } from '../application/queries/QueryBus';
import { GetDashboardStatsQuery } from '../application/queries/dashboard/GetDashboardStatsQuery';
import { GetResumenVentasQuery }  from '../application/queries/reportes/GetResumenVentasQuery';

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await queryBus.execute(new GetDashboardStatsQuery(req.restauranteId));
  res.json({ success: true, data: stats });
});

export const getResumenVentas = asyncHandler(async (req: Request, res: Response) => {
  const dias = req.query.dias ? Number(req.query.dias) : 30;
  const ventas = await queryBus.execute(new GetResumenVentasQuery(dias, req.restauranteId));
  res.json({ success: true, data: ventas });
});

export const getAlertasInventario = asyncHandler(async (req: Request, res: Response) => {
  const alertas = await dashboardService.getAlertasInventario(req.restauranteId);
  res.json({ success: true, data: alertas });
});
