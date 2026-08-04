/**
 * SuscripcionController — checkout, cancelación y estado de la suscripción SaaS.
 * El grupo se toma de `req.grupoAdminId` (resuelto por requireGrupoAdmin), nunca
 * del cliente. El email del pagador se toma del token, no del body.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { MetodoSuscripcion, PlanSaaS } from '@prisma/client';
import { asyncHandler } from '../middlewares/error.middleware';
import { suscripcionService } from '../services/suscripcion.service';
import { BadRequestError } from '../exceptions/HttpErrors';

const checkoutSchema = z.object({
  plan:        z.nativeEnum(PlanSaaS),
  metodo:      z.enum(['nequi', 'pse']), // tarjeta desactivada en el MVP
  datosMetodo: z.record(z.unknown()).optional(),
  redirectUrl: z.string().url().optional(),
});

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const { plan, metodo, datosMetodo, redirectUrl } = checkoutSchema.parse(req.body);
  const grupoId = req.grupoAdminId;
  const emailCliente = req.user?.email;
  if (!grupoId || !emailCliente) throw new BadRequestError('No se pudo resolver el grupo o el correo del usuario');

  const data = await suscripcionService.iniciarCheckout(grupoId, {
    plan,
    metodo: metodo as MetodoSuscripcion,
    emailCliente,
    datosMetodo,
    redirectUrl,
  });
  res.json({ success: true, data });
});

export const cancelar = asyncHandler(async (req: Request, res: Response) => {
  const data = await suscripcionService.cancelar(req.grupoAdminId!);
  res.json({ success: true, data, message: 'Suscripción cancelada; conservas el plan hasta el fin del período.' });
});

export const estado = asyncHandler(async (req: Request, res: Response) => {
  const data = await suscripcionService.getEstado(req.grupoAdminId!);
  res.json({ success: true, data });
});
