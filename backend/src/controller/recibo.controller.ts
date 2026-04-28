/**
 * ReciboController — endpoints para generación de recibos.
 *
 * Rutas:
 *   GET /api/v1/recibos/orden/:id           → recibo de una orden individual
 *   GET /api/v1/recibos/orden-grupo/:id     → recibo unificado de un grupo de órdenes
 *   GET /api/v1/recibos/auto/:id            → detecta si la orden es parte de un grupo
 *                                             y devuelve el recibo correspondiente
 */

import { Request, Response, NextFunction } from 'express';
import { reciboService } from '../services/recibo.service';
import { successResponse } from '../lib/response';

export const reciboController = {

  /**
   * GET /recibos/orden/:id
   * Genera un recibo simple para una orden específica.
   */
  async porOrden(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idOrden = parseInt(req.params['id'] as string, 10);
      const recibo  = await reciboService.generarReciboSimple(idOrden);
      res.json(successResponse(recibo));
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /recibos/orden-grupo/:id
   * Genera el recibo unificado para un grupo de órdenes multi-restaurante.
   */
  async porOrdenGrupo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idGrupo = parseInt(req.params['id'] as string, 10);
      const recibo  = await reciboService.generarReciboUnificado(idGrupo);
      res.json(successResponse(recibo));
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /recibos/auto/:id
   * Punto de entrada inteligente: recibe el id de una orden y detecta
   * automáticamente si forma parte de un grupo para devolver el recibo adecuado.
   *
   * Ideal para el frontend cuando no sabe si la orden es simple o grupal.
   */
  async auto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idOrden = parseInt(req.params['id'] as string, 10);
      const recibo  = await reciboService.generarRecibo({ idOrden });
      res.json(successResponse(recibo));
    } catch (err) {
      next(err);
    }
  },
};
