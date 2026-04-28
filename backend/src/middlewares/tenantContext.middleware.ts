/**
 * tenantContext middleware — resuelve el restaurante activo para la request.
 *
 * Estrategia de resolución (en orden):
 *   1. Header `X-Restaurante-Id` (enviado por el frontend selector)
 *   2. Primer restaurante activo del usuario (fallback automático)
 *   3. undefined — para rutas donde no importa (ej. endpoints de admin global)
 *
 * Validaciones:
 *   - superadmin: acceso a cualquier restaurante sin restricción.
 *     Evaluado con req.esSuperAdmin (Usuario.es_super_admin), NO req.user.rol.es_super_admin.
 *   - otros roles: el id_restaurante debe estar en jwt.restaurantes[]
 *   - si el restaurante no existe en la lista, se rechaza con 403
 *
 * Uso en rutas que requieren contexto de restaurante:
 *   router.get('/', authenticate, tenantContext, handler)
 *
 * Uso opcional (no rechaza si falta):
 *   router.get('/', authenticate, tenantContextOptional, handler)
 */

import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../exceptions/HttpErrors';

/**
 * tenantContext — obligatorio. Rechaza la request si no puede resolver
 * un restaurante válido para el usuario.
 *
 * CAMBIO: usa req.esSuperAdmin (inyectado por authenticate desde
 * Usuario.es_super_admin) en lugar de req.user.rol.es_super_admin.
 */
export const tenantContext = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new ForbiddenError('No autenticado'));

  const idFromHeader = req.headers['x-restaurante-id']
    ? parseInt(req.headers['x-restaurante-id'] as string, 10)
    : undefined;

  // ─── SUPER ADMIN: bypass total — accede a cualquier restaurante ───────────
  // Usa req.esSuperAdmin (de Usuario.es_super_admin), NO el rol
  if (req.esSuperAdmin) {
    const r = req.user.restaurantes.find(x => x.id === idFromHeader) ?? req.user.restaurantes[0];
    req.restauranteId = r?.id;
    req.grupoId       = r?.id_grupo;
    return next();
  }

  const lista = req.user.restaurantes ?? [];

  if (idFromHeader) {
    // Validar que el restaurante solicitado esté en la lista del usuario
    const permitido = lista.find(r => r.id === idFromHeader);
    if (!permitido) {
      return next(new ForbiddenError('No tienes acceso al restaurante especificado'));
    }
    req.restauranteId = idFromHeader;
    req.grupoId       = permitido.id_grupo;
    return next();
  }

  // Fallback: restaurante default o el primero de la lista
  const def = lista.find(r => r.es_default) ?? lista[0];
  if (!def) {
    return next(new ForbiddenError('No tienes ningún restaurante asignado'));
  }
  req.restauranteId = def.id;
  req.grupoId       = def.id_grupo;
  next();
};

/**
 * tenantContextOptional — igual pero no rechaza si no hay restaurante.
 * Útil para endpoints globales (reportes de superadmin, config global, etc.)
 *
 * CAMBIO: usa req.esSuperAdmin en lugar de req.user.rol.es_super_admin.
 */
export const tenantContextOptional = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next();

  const idFromHeader = req.headers['x-restaurante-id']
    ? parseInt(req.headers['x-restaurante-id'] as string, 10)
    : undefined;

  // Superadmin bypass — usa req.esSuperAdmin
  if (req.esSuperAdmin) {
    const r = req.user.restaurantes.find(x => x.id === idFromHeader) ?? req.user.restaurantes[0];
    req.restauranteId = r?.id;
    req.grupoId       = r?.id_grupo;
    return next();
  }

  const lista = req.user.restaurantes ?? [];

  if (idFromHeader) {
    const permitido = lista.find(r => r.id === idFromHeader);
    if (permitido) {
      req.restauranteId = idFromHeader;
      req.grupoId       = permitido.id_grupo;
    }
    // Si no está en la lista, simplemente no asignamos (no rechaza)
    return next();
  }

  const def = lista.find(r => r.es_default) ?? lista[0];
  if (def) {
    req.restauranteId = def.id;
    req.grupoId       = def.id_grupo;
  }
  next();
};
