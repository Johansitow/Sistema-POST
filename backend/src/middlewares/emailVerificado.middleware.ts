/**
 * requireEmailVerificado — exige que el usuario tenga el correo verificado.
 *
 * Verificación SUAVE: el usuario entra y opera con el correo sin verificar (ve un
 * banner recordatorio), pero ciertas acciones sensibles pasan por este guard. Es
 * un punto de extensión: agregar la acción es montar este middleware en su ruta.
 *
 * Consulta la BD (con cache de 60s, mismo criterio que la re-verificación de
 * superadmin en auth.middleware) para NO confiar en JWTs emitidos antes de
 * verificar. El superadmin siempre pasa.
 */

import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../exceptions/HttpErrors';
import { cacheGet, cacheSet } from '../config/redis';
import prisma from '../config/database';

export const requireEmailVerificado = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) return next(new UnauthorizedError('No autenticado'));
  if (req.esSuperAdmin) return next(); // el superadmin del sistema no requiere verificación

  try {
    const cacheKey = `auth:email_verificado:${req.user.id}`;
    const cached   = await cacheGet<boolean>(cacheKey);

    let verificado: boolean;
    if (cached !== null) {
      verificado = cached;
    } else {
      const u = await prisma.usuario.findUnique({
        where:  { id: req.user.id },
        select: { email_verificado: true },
      });
      verificado = u?.email_verificado === true;
      await cacheSet(cacheKey, verificado, 60);
    }

    if (!verificado)
      return next(new ForbiddenError('Verifica tu correo para realizar esta acción'));
    next();
  } catch (err) {
    next(err);
  }
};
