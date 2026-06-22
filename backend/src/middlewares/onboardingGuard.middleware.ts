/**
 * onboardingGuard — middleware que bloquea el acceso a una ruta si el restaurante
 * no completó el wizard de onboarding.
 *
 * Uso (Entregable 3 decidirá en qué rutas se aplica):
 *   router.use(authenticate, tenantContext, requireOnboardingCompleto, handler)
 *
 * Seguridad multi-tenant: lee el flag 'onboarding_completado' con el contexto
 * del restaurante activo (buildContexto('restaurante', req.restauranteId)).
 * Nunca usa el contexto global — marcar 'habilitado=true' en el flag global
 * daría por completado el onboarding de TODAS las sedes del sistema.
 *
 * Si no hay restauranteId (rutas sin tenantContext), el guard pasa sin bloquear.
 */

import { Request, Response, NextFunction } from 'express';
import { featureFlagService } from '../services/feature-flag.service';
import { buildContexto } from '../lib/flagContexto';

export const requireOnboardingCompleto = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.restauranteId) {
    next();
    return;
  }

  const restauranteCtx = buildContexto('restaurante', req.restauranteId);
  const completado = await featureFlagService.isEnabled('onboarding_completado', restauranteCtx);

  if (!completado) {
    res.status(403).json({
      success: false,
      code:    'ONBOARDING_PENDIENTE',
      message: 'El restaurante debe completar el wizard de configuración inicial antes de continuar.',
    });
    return;
  }

  next();
};
