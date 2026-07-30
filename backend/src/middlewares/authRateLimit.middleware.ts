/**
 * authRateLimit — límite estricto por IP para endpoints públicos sensibles de auth
 * (registro, solicitar/confirmar reset, verificar-email).
 *
 * El `tenantRateLimit()` global (300/min) es demasiado holgado y compartido por
 * todas las rutas v1. Estos endpoints necesitan su propia ventana estricta
 * (default 5 por 15min, configurable por env) para frenar abuso automatizado.
 */

import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { config } from '../config/env';

export const authRateLimit = (maxOverride?: number) =>
  rateLimit({
    windowMs: config.authRateLimit.windowMs,
    max:      maxOverride ?? config.authRateLimit.max,
    // Endpoints públicos sin tenant → la clave es la IP.
    keyGenerator: (req: Request) => req.ip ?? 'unknown',
    standardHeaders: true,
    legacyHeaders:   false,
    message: {
      success: false,
      error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
    },
  });
