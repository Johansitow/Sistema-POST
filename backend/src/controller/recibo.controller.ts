/**
 * ReciboController — endpoints para generación de recibos.
 *
 * Rutas:
 *   GET /api/v1/recibos/orden/:id  → recibo de una orden individual
 */

import { Request, Response, NextFunction } from 'express';
import { reciboService } from '../services/recibo.service';
import { buildTenantCtx } from '../lib/tenantCtx';
import { successResponse } from '../lib/response';

export const reciboController = {

  /**
   * GET /recibos/orden/:id
   * Genera un recibo simple para una orden específica.
   */
  async porOrden(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idOrden = parseInt(req.params['id'] as string, 10);
      const recibo  = await reciboService.generarReciboSimple(idOrden, buildTenantCtx(req));
      res.json(successResponse(recibo));
    } catch (err) {
      next(err);
    }
  },
};
