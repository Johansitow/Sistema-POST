/**
 * tenantRateLimit — Rate limiting por tenant (restaurante).
 *
 * Limita el número de requests por restaurante en lugar de por IP.
 * Útil para SaaS multi-tenant: un tenant con muchos usuarios comparte
 * una sola ventana de rate-limit, evitando que un tenant abuse del sistema.
 *
 * Requiere que `tenantContext` ya haya corrido para que `req.restauranteId` esté disponible.
 * Si no hay restaurante resuelto, usa la IP como clave (comportamiento seguro por defecto).
 *
 * Uso:
 *   router.use(authenticate, tenantContext, tenantRateLimit());
 *
 * Configuración por entorno:
 *   TENANT_RATE_LIMIT_MAX      (default: 300 req)
 *   TENANT_RATE_LIMIT_WINDOW   (default: 60000 ms = 1 min)
 */

import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

export const tenantRateLimit = (options?: { max?: number; windowMs?: number }) =>
  rateLimit({
    windowMs: options?.windowMs ?? Number(process.env.TENANT_RATE_LIMIT_WINDOW ?? 60_000),
    max:      options?.max      ?? Number(process.env.TENANT_RATE_LIMIT_MAX    ?? 300),

    // Clave por restaurante — desacopla del IP del cliente final
    keyGenerator: (req: Request) =>
      req.restauranteId ? `tenant:${req.restauranteId}` : (req.ip ?? 'unknown'),

    standardHeaders: true,
    legacyHeaders:   false,
    message: {
      success: false,
      error: 'Límite de solicitudes alcanzado para este restaurante. Intenta en unos segundos.',
    },

    // El superadmin nunca es limitado
    skip: (req: Request) => req.esSuperAdmin === true,
  });
