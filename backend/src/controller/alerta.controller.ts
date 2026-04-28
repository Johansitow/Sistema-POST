/**
 * AlertaController - Recibe requests HTTP para alertas
 */

import { Request, Response } from 'express';
import { alertaService } from '../services/alerta.service';
import { asyncHandler } from '../middlewares/error.middleware';

export const alertaController = {

  // ─── Tipos de alerta ─────────────────────────────────────────────────────────

  getTipos: asyncHandler(async (_req: Request, res: Response) => {
    const tipos = await alertaService.listarTipos();
    res.json({ success: true, data: tipos });
  }),

  createTipo: asyncHandler(async (req: Request, res: Response) => {
    const tipo = await alertaService.crearTipo(req.body);
    res.status(201).json({ success: true, data: tipo, message: 'Tipo de alerta creado correctamente' });
  }),

  updateTipo: asyncHandler(async (req: Request, res: Response) => {
    const tipo = await alertaService.actualizarTipo(Number(req.params.id), req.body);
    res.json({ success: true, data: tipo, message: 'Tipo de alerta actualizado correctamente' });
  }),

  // ─── Alertas ─────────────────────────────────────────────────────────────────

  getAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await alertaService.listar({
      page:            req.query.page,
      limit:           req.query.limit,
      id_restaurante:  req.restauranteId!,
      es_leida:        req.query.es_leida !== undefined ? req.query.es_leida === 'true' : undefined,
      nivel_prioridad: req.query.nivel_prioridad as string,
      id_tipo_alerta:  req.query.id_tipo_alerta ? Number(req.query.id_tipo_alerta) : undefined,
    });
    res.json({ success: true, ...result });
  }),

  /**
   * getCountNoLeidas — endpoint liviano para el badge del Layout
   */
  getCountNoLeidas: asyncHandler(async (req: Request, res: Response) => {
    const count = await alertaService.countNoLeidas(req.restauranteId!);
    res.json({ success: true, data: count });
  }),

  marcarLeida: asyncHandler(async (req: Request, res: Response) => {
    const alerta = await alertaService.marcarLeida(Number(req.params.id));
    res.json({ success: true, data: alerta, message: 'Alerta marcada como leída' });
  }),

  marcarTodasLeidas: asyncHandler(async (req: Request, res: Response) => {
    const result = await alertaService.marcarTodasLeidas(req.restauranteId!);
    res.json({ success: true, ...result });
  }),

  sincronizar: asyncHandler(async (_req: Request, res: Response) => {
    const resultado = await alertaService.sincronizar();
    res.json({ success: true, data: resultado, message: `Sincronización completada: ${resultado.creadas} creadas, ${resultado.resueltas} resueltas` });
  }),
};
