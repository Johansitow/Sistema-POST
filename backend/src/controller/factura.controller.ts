/**
 * FacturaController - Recibe requests HTTP para facturas
 */

import { Request, Response } from 'express';
import { facturaService } from '../services/factura.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { EstadoFactura } from '@prisma/client';

export const facturaController = {

  getAll: asyncHandler(async (req: Request, res: Response) => {
    const facturas = await facturaService.listar({
      page:           req.query.page,
      limit:          req.query.limit,
      estado_factura: req.query.estado_factura as EstadoFactura,
      fecha_desde:    req.query.fecha_desde    ? new Date(req.query.fecha_desde as string) : undefined,
      fecha_hasta:    req.query.fecha_hasta    ? new Date(req.query.fecha_hasta as string) : undefined,
      id_restaurante: req.restauranteId ?? (req.query.id_restaurante ? Number(req.query.id_restaurante) : undefined),
      search:         req.query.search as string | undefined,
    });
    res.json({ success: true, ...facturas });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const factura = await facturaService.obtenerPorId(Number(req.params.id));
    res.json({ success: true, data: factura });
  }),

  getByOrden: asyncHandler(async (req: Request, res: Response) => {
    const factura = await facturaService.obtenerPorOrden(Number(req.params.id));
    res.json({ success: true, data: factura });
  }),
};
