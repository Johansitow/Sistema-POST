/**
 * WompiWebhookController — endpoint público que recibe los eventos de Wompi.
 * La firma inválida lanza UnauthorizedError (401) desde el service; el resto
 * devuelve 200 rápido (Wompi reintenta ante no-2xx).
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { wompiWebhookService } from '../services/wompiWebhook.service';

export const recibirWebhookWompi = asyncHandler(async (req: Request, res: Response) => {
  const resultado = await wompiWebhookService.procesar(req.body);
  res.status(200).json({ success: true, ...resultado });
});
