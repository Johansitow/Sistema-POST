/**
 * AuthMiddleware - Verifica JWT y permisos
 *
 * CAMBIO ARQUITECTÓNICO (Fase Crítica):
 * ─────────────────────────────────────────────────────────────────────────────
 * El flag `es_super_admin` ahora vive en DOS lugares:
 *
 *   1. TokenPayload.es_super_admin  → viene de Usuario.es_super_admin (DB)
 *      ← ESTE es el que se evalúa en TODOS los guards de seguridad.
 *
 *   2. TokenPayload.rol.es_super_admin → campo informativo heredado, se conserva
 *      para compatibilidad con código existente pero NO debe usarse para auth.
 *
 * Por qué es más seguro:
 *   - El flag en Usuario es INMUTABLE por diseño (protegerSuperAdmin en service).
 *   - Incluso si alguien manipula el Rol en DB, el token del superadmin
 *     seguirá leyendo su propio flag personal.
 *   - Un índice único parcial en DB garantiza unicidad de es_super_admin=true.
 *
 * Regla de oro: SIEMPRE usar `req.user.es_super_admin` (o req.esSuperAdmin),
 * NUNCA `req.user.rol.es_super_admin` para decisiones de acceso.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { UnauthorizedError, ForbiddenError } from '../exceptions/HttpErrors';
import { cacheGet, cacheSet } from '../config/redis';
import prisma from '../config/database';

/**
 * TokenPayload — estructura del JWT.
 * Debe coincidir exactamente con la interfaz UsuarioAuth del frontend.
 *
 * IMPORTANTE: es_super_admin al nivel raíz viene de Usuario.es_super_admin.
 * rol.es_super_admin se conserva solo para retrocompatibilidad de display.
 */
export interface TokenPayload {
  id:              number;
  uuid:            string;
  usuario:         string;
  email:           string;
  nombre_completo?: string;
  /** Flag de identidad del super admin — viene de Usuario.es_super_admin, NO del rol */
  es_super_admin:  boolean;
  /** Permisos efectivos: rol (RolPermiso) ∪ directos (UsuarioPermiso) */
  permisos?:       string[];
  /** Grupos donde el usuario es owner/admin — para el panel de administración */
  grupos_admin?:   { id_grupo: number; rol_en_grupo: string }[];
  rol: {
    id:             number;
    nombre:         string;
    /** @deprecated Usar TokenPayload.es_super_admin para decisiones de acceso */
    es_super_admin: boolean;
    color?:         string | null;
  };
  restaurantes: { id: number; nombre: string; es_default: boolean; id_grupo: number }[];
}

declare global {
  namespace Express {
    interface Request {
      user?:           TokenPayload;
      auditContext?:   { ip: string; userAgent: string; id_restaurante?: number; id_grupo?: number };
      /** ID del restaurante activo para esta request (inyectado por tenantContext middleware) */
      restauranteId?:  number;
      /** ID del grupo de negocio del restaurante activo (inyectado por tenantContext middleware) */
      grupoId?:        number;
      /**
       * true solo cuando el JWT contiene es_super_admin=true a nivel de usuario.
       * Inyectado por `authenticate` para evitar acceder a req.user.es_super_admin
       * repetidamente en cada guard.
       */
      esSuperAdmin?:   boolean;
    }
  }
}

/**
 * authenticate — verifica el JWT y popula req.user + req.esSuperAdmin.
 *
 * req.esSuperAdmin es un shortcut seguro: se asigna UNA SOLA VEZ aquí
 * desde el token firmado, y queda disponible para todos los middlewares
 * y controllers siguientes sin necesidad de volver a leer req.user.
 *
 * Verificación adicional para tokens SA:
 *   Cuando el JWT afirma es_super_admin=true, se re-verifica el valor real
 *   desde la base de datos (con cache Redis de 60s). Esto protege contra:
 *     1. JWT secrets comprometidos que generen tokens SA falsos.
 *     2. Estados de DB stale en escenarios de recuperación de emergencia.
 *   Para usuarios normales (es_super_admin=false) se confía en la firma JWT.
 */
export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return next(new UnauthorizedError('Token de autenticación requerido'));

  try {
    const payload = jwt.verify(authHeader.split(' ')[1], config.jwt.secret) as TokenPayload;
    req.user = payload;

    if (payload.es_super_admin === true) {
      // Tokens que afirman ser SA: verificar contra DB con cache Redis (60s)
      const cacheKey = `auth:sa_verify:${payload.id}`;
      const cached   = await cacheGet<boolean>(cacheKey);

      if (cached !== null) {
        req.esSuperAdmin = cached;
      } else {
        const usuario = await prisma.usuario.findUnique({
          where:  { id: payload.id },
          select: { es_super_admin: true, estado: true },
        });
        const verified = usuario?.es_super_admin === true && usuario?.estado !== 'eliminado';
        await cacheSet(cacheKey, verified, 60);
        req.esSuperAdmin = verified;
      }
    } else {
      // Usuario normal: la firma JWT es garantía suficiente
      req.esSuperAdmin = false;
    }

    next();
  } catch {
    next(new UnauthorizedError('Token inválido o expirado'));
  }
};

/**
 * requireSuperAdmin — solo el superadmin real pasa.
 *
 * Evalúa req.esSuperAdmin (inyectado por authenticate desde el campo
 * Usuario.es_super_admin del JWT), NO el rol.
 */
export const requireSuperAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.esSuperAdmin)
    return next(new ForbiddenError('Se requieren permisos de super administrador'));
  next();
};

/**
 * requireRole — verifica que el usuario tenga uno de los roles indicados.
 * El superadmin siempre pasa (bypass total).
 */
export const requireRole = (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user)
      return next(new UnauthorizedError('No autenticado'));
    // Superadmin bypass — usa req.esSuperAdmin, no el rol
    if (req.esSuperAdmin)
      return next();
    if (!roles.includes(req.user.rol.nombre))
      return next(new ForbiddenError('No tienes permisos para esta acción'));
    next();
  };
