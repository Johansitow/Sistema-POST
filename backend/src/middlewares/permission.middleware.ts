/**
 * permission.middleware.ts
 * Verifica que el usuario autenticado tenga el permiso requerido.
 * Debe usarse siempre después de `authenticate`.
 */

import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../exceptions/HttpErrors';
import prisma from '../config/database';

export const requirePermission = (codigoPermiso: string) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      // Superadmin siempre tiene acceso.
      // CORRECTO: usa req.esSuperAdmin (de Usuario.es_super_admin del JWT),
      // NO user.rol.es_super_admin (campo deprecated, manipulable via rol en DB).
      if (req.esSuperAdmin) return next();

      if (!user?.rol?.id) return next(new ForbiddenError('No autorizado'));

      // Buscar si el rol tiene el permiso requerido
      const rolPermiso = await prisma.rolPermiso.findFirst({
        where: {
          id_rol:  user.rol.id,
          permiso: { codigo: codigoPermiso },
        },
        include: { permiso: true },
      });

      if (!rolPermiso) {
        return next(new ForbiddenError(`No tienes el permiso requerido: ${codigoPermiso}`));
      }

      next();
    } catch (e) {
      next(e);
    }
  };
