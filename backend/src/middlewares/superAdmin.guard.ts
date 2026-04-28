/**
 * superAdmin.guard.ts — guards de seguridad para proteger al super admin.
 *
 * Exporta dos middlewares independientes:
 *
 *   sanitizarSuperAdminFlag
 *     Elimina el campo `es_super_admin` del body en cualquier request de
 *     creación o actualización de usuarios. Impide que llegue al controller
 *     y de ahí al ORM, incluso si los triggers de DB ya lo bloquean.
 *     Aplicar en: POST /usuarios, PUT /usuarios/:id
 *
 *   protegerSuperAdmin
 *     Evita que cualquier usuario (incluidos admins) pueda modificar al
 *     super admin a través de la API. Si el target del request (`:id`) es
 *     el super admin, solo el propio super admin puede continuar (ej. cambiar
 *     su propia contraseña). Cualquier otro actor recibe 403.
 *     Aplicar en: PUT /usuarios/:id, PATCH /usuarios/:id/*
 *
 * Estas capas son defense-in-depth: los triggers de PostgreSQL son la última
 * línea, pero es mejor no llegar hasta allá.
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { cacheGet, cacheSet } from '../config/redis';
import { ForbiddenError } from '../exceptions/HttpErrors';

// TTL del cache para la comprobación de si un usuario es SA (30s)
const SA_CHECK_TTL = 30;

/**
 * sanitizarSuperAdminFlag — extrae el campo es_super_admin del body entrante.
 *
 * Sin importar quién envíe la request ni qué rol tenga, este campo no puede
 * llegar al controller. La asignación del flag de super admin es una
 * operación exclusiva del seed de base de datos.
 */
export const sanitizarSuperAdminFlag = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (req.body && typeof req.body === 'object' && 'es_super_admin' in req.body) {
    delete req.body.es_super_admin;
  }
  next();
};

/**
 * protegerSuperAdmin — bloquea modificaciones al super admin por terceros.
 *
 * Reglas:
 *   1. Si req no tiene :id, pasa (no aplica).
 *   2. Si el actor ES el super admin Y es el mismo target (automodificación),
 *      pasa (puede cambiar su propia contraseña, etc.).
 *   3. Si el actor NO es super admin y el target SÍ es SA → 403.
 *   4. Si el actor ES super admin pero intenta modificar al SA siendo otra
 *      persona (imposible por diseño de unicidad, pero se cubre igual) → 403.
 *
 * El resultado de la consulta DB se cachea 30s por id_usuario para no
 * impactar el rendimiento en endpoints de alta frecuencia.
 */
export const protegerSuperAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawId    = (req.params['id'] ?? req.params['usuarioId'] ?? '') as string;
    const targetId = parseInt(rawId, 10);
    if (!targetId || isNaN(targetId)) return next();

    // El SA puede modificarse a sí mismo (cambio de contraseña, etc.)
    if (req.esSuperAdmin && req.user!.id === targetId) return next();

    // Para cualquier otro caso: verificar si el target es el SA
    const cacheKey = `guard:is_sa:${targetId}` as string;
    const cached   = await cacheGet<boolean>(cacheKey);

    let targetEsSuperAdmin: boolean;
    if (cached !== null) {
      targetEsSuperAdmin = cached;
    } else {
      const target = await prisma.usuario.findUnique({
        where:  { id: targetId },
        select: { es_super_admin: true },
      });
      targetEsSuperAdmin = target?.es_super_admin === true;
      await cacheSet(cacheKey, targetEsSuperAdmin, SA_CHECK_TTL);
    }

    if (targetEsSuperAdmin) {
      return next(
        new ForbiddenError(
          'No tienes permiso para modificar al super administrador del sistema.'
        )
      );
    }

    next();
  } catch (err) {
    next(err);
  }
};
