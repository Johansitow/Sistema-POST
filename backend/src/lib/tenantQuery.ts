/**
 * tenantQuery.ts — primitivas de aislamiento de tenant para queries de Prisma.
 *
 * Regla de oro del sistema multi-restaurante:
 *   Toda query sobre tablas operativas DEBE incluir id_restaurante o id_grupo.
 *   Estas funciones hacen ese requisito explícito y verificable en tiempo de compilación.
 *
 * Clasificación de tablas:
 *   - Operativas (id_restaurante): ProductoStock, Lote, Receta, ListaCompras,
 *     TurnoCaja, Proveedor, Orden, Alerta, ConfiguracionRestaurante, Auditoria.
 *   - Catálogo (id_grupo): Producto, Categoria, Cliente.
 *   - Globales (sin filtro): Rol, Permiso, MetodoPago, EstadoOrden, TipoAlerta.
 *
 * Uso:
 *   const lotes = await prisma.lote.findMany({
 *     where: withRestaurant({ estado: 'activo' }, req.restauranteId!),
 *   });
 *
 *   const productos = await prisma.producto.findMany({
 *     where: withGroup({ estado: 'activo' }, req.grupoId!),
 *   });
 */

import { ForbiddenError } from '../exceptions/HttpErrors';

// ─── Filtros de tenant ────────────────────────────────────────────────────────

/**
 * withRestaurant — añade id_restaurante a cualquier cláusula where de Prisma.
 * Para tablas operativas que son estrictamente por restaurante.
 */
export function withRestaurant<T extends Record<string, unknown>>(
  where: T,
  restauranteId: number
): T & { id_restaurante: number } {
  return { ...where, id_restaurante: restauranteId };
}

/**
 * withGroup — añade id_grupo a cualquier cláusula where de Prisma.
 * Para recursos de catálogo compartidos a nivel de grupo empresarial
 * (Producto, Categoria, Cliente).
 */
export function withGroup<T extends Record<string, unknown>>(
  where: T,
  grupoId: number
): T & { id_grupo: number } {
  return { ...where, id_grupo: grupoId };
}

/**
 * withTenant — añade AMBOS filtros (id_restaurante + id_grupo).
 * Para queries que cruzan contexto operativo y de catálogo.
 */
export function withTenant<T extends Record<string, unknown>>(
  where: T,
  restauranteId: number,
  grupoId: number
): T & { id_restaurante: number; id_grupo: number } {
  return { ...where, id_restaurante: restauranteId, id_grupo: grupoId };
}

// ─── Guards de runtime ────────────────────────────────────────────────────────

/**
 * assertRestauranteId — fail-fast si el contexto de restaurante no está disponible.
 *
 * Llamar al inicio de cualquier service que opere sobre tablas con id_restaurante.
 * Evita que una query accidentalmente lea datos de todos los restaurantes.
 *
 * @example
 *   export async function getLotes(restauranteId: number | undefined) {
 *     assertRestauranteId(restauranteId);  // lanza si undefined/NaN
 *     return prisma.lote.findMany({ where: withRestaurant({}, restauranteId) });
 *   }
 */
export function assertRestauranteId(
  restauranteId: number | undefined
): asserts restauranteId is number {
  if (!restauranteId || !Number.isInteger(restauranteId) || restauranteId <= 0) {
    throw new ForbiddenError(
      'Contexto de restaurante requerido. Esta operación no puede ejecutarse sin un restaurante activo.'
    );
  }
}

/**
 * assertGrupoId — fail-fast si el contexto de grupo no está disponible.
 * Llamar en services de catálogo (Producto, Categoria, Cliente).
 */
export function assertGrupoId(
  grupoId: number | undefined
): asserts grupoId is number {
  if (!grupoId || !Number.isInteger(grupoId) || grupoId <= 0) {
    throw new ForbiddenError(
      'Contexto de grupo empresarial requerido. Esta operación no puede ejecutarse sin un grupo activo.'
    );
  }
}

// ─── Tipo utilitario ──────────────────────────────────────────────────────────

/**
 * TenantContext — contexto completo inyectado por los middlewares de tenant.
 * Refleja los campos que tenantContext e tenantIsolation ponen en req.
 */
export interface TenantContext {
  restauranteId: number;
  grupoId: number;
}
