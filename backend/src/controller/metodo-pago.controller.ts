/**
 * MetodoPagoController - Métodos de pago disponibles en el sistema
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import prisma from '../config/database';

export const getAll = asyncHandler(async (_req: Request, res: Response) => {
  const metodos = await prisma.metodoPago.findMany({
    where: { activo: true },
    orderBy: { orden: 'asc' },
    select: {
      id:                  true,
      nombre:              true,
      codigo:              true,
      icono:               true,
      requiere_referencia: true,
      activo:              true,
      orden:               true,
    },
  });
  res.json({ success: true, data: metodos });
});
