/**
 * tenantIsolation middleware
 *
 * Capa de seguridad adicional para restaurantes con tipo_tenant = 'aislado'.
 * Garantiza que un usuario de un tenant aislado NUNCA pueda acceder a datos
 * de otro grupo, incluso si el frontend envía un X-Restaurante-Id incorrecto.
 *
 * Debe montarse DESPUÉS de authenticate + tenantContext.
 *
 * Lógica:
 *   - superadmin → bypass total
 *   - tipo_tenant = 'compartido' → pasa (el tenantContext ya validó acceso)
 *   - tipo_tenant = 'aislado'    → verifica que el restaurante pertenece
 *                                   al mismo grupo que el usuario
 *
 * Uso en rutas que requieren aislamiento estricto:
 *   router.get('/', authenticate, tenantContext, tenantIsolation, handler)
 *
 * Uso como middleware global (server.ts):
 *   app.use('/api/v1', authenticate, tenantContext, tenantIsolation)
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { ForbiddenError, NotFoundError } from '../exceptions/HttpErrors';

// Cache en memoria para evitar queries repetidas en cada request
// TTL corto (30s) para no servir datos stale si cambia tipo_tenant
const tenantCache = new Map<number, { tipo_tenant: string; id_grupo: number; ts: number }>();
const CACHE_TTL_MS = 30_000;

async function getTenantInfo(idRestaurante: number) {
  const cached = tenantCache.get(idRestaurante);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached;

  const r = await prisma.restaurante.findUnique({
    where:  { id: idRestaurante },
    select: { tipo_tenant: true, id_grupo: true },
  });
  if (!r) return null;

  const entry = { tipo_tenant: r.tipo_tenant, id_grupo: r.id_grupo, ts: Date.now() };
  tenantCache.set(idRestaurante, entry);
  return entry;
}

export const tenantIsolation = async (
  req: Request, _res: Response, next: NextFunction
): Promise<void> => {
  try {
    // Superadmin: acceso total, sin validación
    if (req.esSuperAdmin) return next();

    // Sin restaurante resuelto: no aplica (ruta global o pública)
    if (!req.restauranteId) return next();

    const info = await getTenantInfo(req.restauranteId);
    if (!info) return next(new NotFoundError('Restaurante no encontrado'));

    // Tenant compartido: tenantContext ya validó; nada más que verificar
    if (info.tipo_tenant === 'compartido') return next();

    // Tenant aislado: el usuario DEBE pertenecer al mismo grupo que el restaurante
    const perteneceAlGrupo = await prisma.usuarioGrupo.findFirst({
      where: {
        id_usuario: req.user!.id,
        id_grupo:   info.id_grupo,
        es_activo:  true,
      },
      select: { id: true },
    });

    if (!perteneceAlGrupo) {
      return next(new ForbiddenError(
        'Acceso denegado: este restaurante pertenece a un tenant aislado'
      ));
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Invalida la entrada de caché para un restaurante.
 * Llamar si se cambia tipo_tenant o id_grupo de un restaurante.
 */
export function invalidateTenantCache(idRestaurante: number): void {
  tenantCache.delete(idRestaurante);
}
