/**
 * AuditMiddleware - Adjunta contexto de auditoría al request.
 *
 * Lee IP real considerando proxies (X-Forwarded-For, X-Real-IP)
 * y User-Agent del request HTTP. Los controladores lo usan para
 * llamar a registrarAuditoria sin acceder directamente a req.
 *
 * IMPORTANTE: debe montarse DESPUÉS de authenticate y tenantContext
 * para que req.restauranteId y req.user estén disponibles.
 */

import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      auditContext?: {
        ip:              string;
        userAgent:       string;
        id_restaurante?: number;
        id_grupo?:       number;
      };
    }
  }
}

export const attachAuditContext = (req: Request, _res: Response, next: NextFunction): void => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ||
    (req.headers['x-real-ip'] as string) ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown';

  // Contexto tenant: disponible si authenticate + tenantContext ya corrieron.
  // Para rutas donde solo corre attachAuditContext sin tenant, estos serán undefined.
  req.auditContext = {
    ip,
    userAgent:       req.headers['user-agent'] || 'unknown',
    id_restaurante:  req.restauranteId,
    id_grupo:        (req.user as any)?.id_grupo ?? undefined,
  };

  next();
};
