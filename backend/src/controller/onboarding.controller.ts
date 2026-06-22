/**
 * OnboardingController — thin controller para el wizard de configuración inicial.
 *
 * POST /api/v1/onboarding/apply?preview=true   → previsualiza sin persistir
 * POST /api/v1/onboarding/apply                → aplica y persiste transaccionalmente
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/error.middleware';
import { onboardingService } from '../services/onboarding.service';
import { successResponse } from '../lib/response';
import { BadRequestError } from '../exceptions/HttpErrors';

const ApplyBodySchema = z.object({
  arquetipo: z.string().optional(),
  ejes:      z.record(z.string()).optional(),
});

export const apply = asyncHandler(async (req: Request, res: Response) => {
  const { restauranteId, grupoId } = req;
  if (!restauranteId || !grupoId) {
    throw new BadRequestError('Contexto de restaurante requerido. Incluye el header X-Restaurante-Id.');
  }

  const preview = req.query['preview'] === 'true';
  const body    = ApplyBodySchema.parse(req.body);

  const result = preview
    ? onboardingService.previsualizarPerfil(body)
    : await onboardingService.aplicarPerfil(restauranteId, grupoId, body);

  const message = preview ? 'Vista previa del perfil (sin cambios aplicados)' : 'Perfil aplicado correctamente';
  res.status(preview ? 200 : 201).json(successResponse(result, message));
});
