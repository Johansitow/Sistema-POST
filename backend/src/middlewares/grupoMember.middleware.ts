/**
 * requireGrupoMember — verifica que el usuario autenticado tenga acceso
 * al GrupoNegocio indicado en req.params.id_grupo.
 *
 * Uso:
 *   router.get('/consolidado/:id_grupo', authenticate, requireGrupoMember, handler)
 *
 * Estrategia de verificación (en orden):
 *   1. req.esSuperAdmin                      → bypass total
 *   2. JWT restaurantes[].id_grupo === grupo → usuario tiene al menos un
 *      restaurante del grupo asignado (camino principal para usuarios normales)
 *   3. UsuarioGrupo en DB                    → membresía explícita al grupo
 *      (usada cuando el usuario no tiene restaurantes directamente)
 *
 * Lanza ForbiddenError si ninguna de las tres condiciones se cumple.
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { ForbiddenError, BadRequestError } from '../exceptions/HttpErrors';

export const requireGrupoMember = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 1. Superadmin puede acceder a cualquier grupo
    if (req.esSuperAdmin) return next();

    const rawId   = req.params['id_grupo'] as string;
    const idGrupo = parseInt(rawId, 10);

    if (!idGrupo || isNaN(idGrupo)) {
      return next(new BadRequestError('id_grupo debe ser un número válido'));
    }

    // 2. Verificar vía JWT — si el usuario tiene un restaurante del grupo,
    //    tiene acceso implícito a los reportes consolidados del grupo.
    //    Esto cubre el caso más común: usuario con múltiples restaurantes.
    const tieneRestauranteDelGrupo = req.user!.restaurantes.some(
      r => r.id_grupo === idGrupo
    );

    if (tieneRestauranteDelGrupo) {
      req.grupoId = idGrupo;
      return next();
    }

    // 3. Fallback: membresía explícita en UsuarioGrupo
    //    (para usuarios sin restaurantes pero con acceso directo al grupo)
    const pertenece = await prisma.usuarioGrupo.findFirst({
      where: {
        id_usuario: req.user!.id,
        id_grupo:   idGrupo,
        es_activo:  true,
      },
      select: { id: true },
    });

    if (!pertenece) {
      return next(new ForbiddenError(
        'Acceso denegado: no tienes acceso a este grupo de negocio'
      ));
    }

    // Exponer el grupoId resuelto en el request para uso downstream
    req.grupoId = idGrupo;

    next();
  } catch (err) {
    next(err);
  }
};
