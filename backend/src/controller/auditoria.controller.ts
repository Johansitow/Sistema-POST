/**
 * AuditoriaController - Solo lectura, protegido por permiso auditoria.ver
 */

import { Request, Response } from 'express';
import { auditoriaService } from '../services/auditoria.service';
import { asyncHandler } from '../middlewares/error.middleware';

export const auditoriaController = {
  getAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await auditoriaService.listar({
      page:        req.query.page,
      limit:       req.query.limit,
      id_usuario:  req.query.id_usuario  ? Number(req.query.id_usuario)  : undefined,
      modulo:      req.query.modulo      as string,
      accion:      req.query.accion      as string,
      fecha_desde: req.query.fecha_desde ? new Date(req.query.fecha_desde as string) : undefined,
      fecha_hasta: req.query.fecha_hasta ? new Date(req.query.fecha_hasta as string) : undefined,
    });
    res.json({ success: true, ...result });
  }),
};
