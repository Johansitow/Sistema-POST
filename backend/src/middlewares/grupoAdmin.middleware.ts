/**
 * requireGrupoAdmin — verifica que el usuario autenticado sea owner o admin
 * de un GrupoNegocio y resuelve cuál grupo está administrando.
 *
 * A diferencia de requireGrupoMember (membresía simple para reportes
 * consolidados), este middleware exige rol de administración en el grupo
 * (UsuarioGrupo.rol_en_grupo ∈ {owner, admin}) y NO recibe el grupo por
 * params: lo deriva del propio usuario.
 *
 * Resolución del grupo (inyectado en req.grupoAdminId):
 *   1. Superadmin → usa req.grupoId (del tenantContextOptional previo) o el
 *      grupo de su primera sede. Bypass del check de rol.
 *   2. Usuario normal → sus membresías owner/admin activas; si administra
 *      varios grupos, gana el que coincide con la sede activa (req.grupoId),
 *      si no, el primero.
 *
 * Montar SIEMPRE después de authenticate y tenantContextOptional:
 *   router.use(authenticate, tenantContextOptional, requireGrupoAdmin)
 */

import { Request, Response, NextFunction } from 'express';
import { RolGrupo } from '@prisma/client';
import { grupoNegocioRepository } from '../repositories/grupo-negocio.repository';
import { ForbiddenError, BadRequestError } from '../exceptions/HttpErrors';

declare global {
  namespace Express {
    interface Request {
      /** Grupo que el usuario está administrando (resuelto por requireGrupoAdmin) */
      grupoAdminId?: number;
      /** Rol del usuario en ese grupo ('owner' | 'admin'; superadmin no lo setea) */
      rolEnGrupo?: RolGrupo;
    }
  }
}

export const requireGrupoAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 1. Superadmin administra cualquier grupo — usa el contexto de la sede activa
    if (req.esSuperAdmin) {
      const grupo = req.grupoId ?? req.user?.restaurantes?.[0]?.id_grupo;
      if (!grupo) {
        return next(new BadRequestError(
          'No se pudo determinar el grupo a administrar (envía X-Restaurante-Id)'
        ));
      }
      req.grupoAdminId = grupo;
      return next();
    }

    // 2. Usuario normal: debe ser owner/admin de al menos un grupo
    const membresias = await grupoNegocioRepository.findMembresiasAdmin(req.user!.id);
    if (membresias.length === 0) {
      return next(new ForbiddenError(
        'Necesitas ser owner o admin del grupo de negocio para administrarlo'
      ));
    }

    const activa = membresias.find(m => m.id_grupo === req.grupoId) ?? membresias[0];
    req.grupoAdminId = activa.id_grupo;
    req.rolEnGrupo   = activa.rol_en_grupo;
    next();
  } catch (err) {
    next(err);
  }
};
