/**
 * PlanesController — catálogo público de planes y consulta del plan del grupo.
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { listarPlanes } from '../lib/planes/catalogo';
import { planService } from '../services/plan.service';
import { BadRequestError } from '../exceptions/HttpErrors';

/** GET /planes — catálogo público (sin sesión) para la página de precios. */
export const getPlanes = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: listarPlanes() });
});

/**
 * GET /planes/mi-plan — plan + uso del grupo del usuario autenticado.
 * El grupo se deriva del contexto de tenant (tenantContextOptional) o, si no hay
 * sede activa en el header, de la primera membresía admin del token. Nunca se
 * acepta el grupo desde el cliente (seguridad multi-tenant).
 */
export const getMiPlan = asyncHandler(async (req: Request, res: Response) => {
  const grupoId = req.grupoId ?? (req as any).user?.grupos_admin?.[0]?.id_grupo;
  if (!grupoId) throw new BadRequestError('No hay un grupo activo en el contexto');
  const data = await planService.getPlanYUso(Number(grupoId));
  res.json({ success: true, data });
});
