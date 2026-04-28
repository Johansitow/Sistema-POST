/**
 * flagGate — Middleware que bloquea una ruta si un feature flag está deshabilitado
 *
 * Uso en routes:
 *   router.get('/ruta', requireFlag('mi_feature'), authenticate, handler);
 *
 * Si el flag está habilitado → continúa la cadena normalmente.
 * Si el flag está deshabilitado (o no existe) → responde 403 con mensaje claro.
 *
 * Contexto opcional:
 *   requireFlag('mi_feature', 'restaurante_2')
 *   → evalúa la asignación específica del contexto antes del flag global.
 *
 * Notas:
 *   - El middleware usa caché interno del featureFlagService (Redis/SHORT TTL).
 *   - Los errores de DB no bloquean la ruta (fail-open para evitar outages).
 */

import type { Request, Response, NextFunction } from 'express';
import { featureFlagService } from '../services/feature-flag.service';
import logger from '../config/logger';

/**
 * Genera un middleware que permite el acceso solo si el feature flag está activo.
 *
 * @param flagName  Nombre del feature flag a evaluar
 * @param contexto  Contexto opcional para asignaciones específicas
 */
export const requireFlag = (flagName: string, contexto?: string) =>
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const enabled = await featureFlagService.isEnabled(flagName, contexto);
      if (enabled) {
        return next();
      }
      res.status(403).json({
        success: false,
        error:   `La funcionalidad "${flagName}" no está habilitada en este entorno.`,
        code:    'FEATURE_DISABLED',
      });
    } catch (err) {
      // Fail-open: si no podemos verificar el flag, no bloqueamos la ruta.
      // Esto evita que un fallo de Redis/DB derribe funcionalidad crítica.
      logger.warn(`[flagGate] Error evaluando flag "${flagName}" — fail-open:`, err);
      next();
    }
  };
