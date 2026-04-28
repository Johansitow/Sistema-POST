/**
 * EstadoController - Recibe requests HTTP para estados y transiciones
 */

import { Request, Response } from 'express';
import { estadoService } from '../services/estado.service';
import { asyncHandler } from '../middlewares/error.middleware';

export const estadoController = {

  getAll: asyncHandler(async (_req: Request, res: Response) => {
    const estados = await estadoService.listar();
    res.json({ success: true, data: estados });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const estado = await estadoService.obtenerPorId(Number(req.params.id));
    res.json({ success: true, data: estado });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const estado = await estadoService.actualizar(Number(req.params.id), req.body);
    res.json({ success: true, data: estado, message: 'Estado actualizado correctamente' });
  }),

  // ─── Transiciones ─────────────────────────────────────────────────────────

  getTransiciones: asyncHandler(async (req: Request, res: Response) => {
    const transiciones = await estadoService.listarTransiciones(Number(req.params.id));
    res.json({ success: true, data: transiciones });
  }),

  addTransicion: asyncHandler(async (req: Request, res: Response) => {
    const transicion = await estadoService.agregarTransicion({
      id_estado_desde:       Number(req.params.id),
      id_estado_hacia:       req.body.id_estado_hacia,
      requiere_permiso:      req.body.requiere_permiso,
      puede_ser_automatico:  req.body.puede_ser_automatico,
      orden:                 req.body.orden,
    });
    res.status(201).json({ success: true, data: transicion, message: 'Transición agregada correctamente' });
  }),

  deleteTransicion: asyncHandler(async (req: Request, res: Response) => {
    await estadoService.eliminarTransicion(Number(req.params.transicionId));
    res.json({ success: true, message: 'Transición eliminada correctamente' });
  }),
};
