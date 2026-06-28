/**
 * TenantCtx — contexto de tenant extraído de req.
 *
 * Se construye en el controller/route a partir de req.restauranteId,
 * req.grupoId y req.esSuperAdmin, y se pasa por parámetro al service.
 * El service nunca toca req directamente.
 */
import { ForbiddenError } from '../exceptions/HttpErrors';

export type TenantCtx = {
  restauranteId?: number;
  grupoId?:       number;
  esSuperAdmin?:  boolean;
};

/** Helper para armar TenantCtx desde cualquier objeto con los campos de req */
export function buildTenantCtx(req: {
  restauranteId?: number;
  grupoId?:       number;
  esSuperAdmin?:  boolean;
}): TenantCtx {
  return {
    restauranteId: req.restauranteId,
    grupoId:       req.grupoId,
    esSuperAdmin:  req.esSuperAdmin,
  };
}

/**
 * Lanza ForbiddenError si ctx no tiene grupoId y no es superadmin.
 * Útil en operaciones de escritura con llave id_grupo (ej. proveedor.crear).
 */
export function assertGrupoCtx(ctx: TenantCtx): void {
  if (!ctx.esSuperAdmin && (ctx.grupoId === undefined || ctx.grupoId === null)) {
    throw new ForbiddenError('Se requiere contexto de grupo para esta operación');
  }
}
