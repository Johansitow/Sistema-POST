/**
 * TenantRepository — clase base stateless para repositorios con aislamiento de tenant.
 *
 * El contexto de tenant NO va en el constructor; se pasa POR MÉTODO en cada
 * operación que lo necesite. Esto permite reutilizar una única instancia del
 * repositorio a lo largo de toda la aplicación (singleton-safe).
 *
 * Uso para NUEVOS repositorios (class-based):
 *
 *   class MiRepo extends TenantRepository {
 *     async findByIdScoped(id: number, ctx: TenantCtx) {
 *       return this._scopedLookup(
 *         (i) => prisma.miModelo.findUnique({ where: { id: i } }),
 *         id,
 *         ctx,
 *         'id_restaurante',
 *       );
 *     }
 *   }
 *
 * Para repositorios EXISTENTES (object-literal), usar tenantScope() en su lugar.
 */

import { PrismaClient } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../../exceptions/HttpErrors';
import type { TenantCtx } from '../../lib/tenantCtx';

export abstract class TenantRepository {
  constructor(protected readonly prisma: PrismaClient) {}

  /**
   * _scopedLookup — lookup guardado con verificación de tenant.
   *
   * Reglas de autorización:
   *   - superadmin            → fetch sin filtro, accede a cualquier tenant
   *   - ctx sin tenant        → ForbiddenError (el middleware de tenant no resolvió)
   *   - fila inexistente      → NotFoundError
   *   - fila de otro tenant   → NotFoundError (mismo error: no revelamos existencia)
   *
   * @param finder    Función que busca la fila por id (sin filtro de tenant).
   * @param id        PK del registro buscado.
   * @param ctx       Contexto del usuario autenticado (viene de req).
   * @param tenantKey Campo de la fila que contiene el id del tenant.
   */
  protected async _scopedLookup<T extends Record<string, unknown>>(
    finder:    (id: number) => Promise<T | null>,
    id:        number,
    ctx:       TenantCtx,
    tenantKey: 'id_restaurante' | 'id_grupo',
  ): Promise<T> {
    const tenantId = tenantKey === 'id_restaurante' ? ctx.restauranteId : ctx.grupoId;

    if (!ctx.esSuperAdmin && (tenantId === undefined || tenantId === null)) {
      throw new ForbiddenError('Se requiere contexto de restaurante para esta operación');
    }

    const record = await finder(id);

    if (!record) {
      throw new NotFoundError(`Registro ${id} no encontrado`);
    }

    if (!ctx.esSuperAdmin) {
      const recordTenantVal = (record as Record<string, unknown>)[tenantKey];
      if (recordTenantVal !== tenantId) {
        // Mismo error que "no encontrado": no revelamos si el id existe en otro tenant
        console.warn(
          `[TenantGuard] IDOR attempt: ${tenantKey}=${tenantId} tried to access ` +
          `record with ${tenantKey}=${recordTenantVal} (id=${id})`,
        );
        throw new NotFoundError(`Registro ${id} no encontrado`);
      }
    }

    return record;
  }
}

// =============================================================================
// tenantScope — utilidad para repositorios object-literal EXISTENTES
// =============================================================================

/**
 * tenantScope() crea un objeto helper que se pasa a los métodos del repo
 * para garantizar que siempre se aplique el filtro de tenant.
 *
 * Uso en repositorios existentes sin refactorizar a clases:
 *
 *   // En el controller:
 *   const scope = tenantScope(req.restauranteId!);
 *   const lotes = await loteRepository.findAll(pagination, scope.where());
 *
 *   // En el repository (nueva firma que acepta scope):
 *   findAll: (pagination, filters) => {
 *     const where = { ...filters };           // ya incluye id_restaurante
 *     return prisma.lote.findMany({ where });
 *   }
 */
export function tenantScope(idRestaurante: number, idGrupo?: number) {
  return {
    /** Filtros base de tenant para un WHERE clause */
    where(): { id_restaurante: number } {
      return { id_restaurante: idRestaurante };
    },

    /** Mezcla el filtro de tenant con filtros adicionales */
    mergeWhere(extra: Record<string, unknown> = {}) {
      return { id_restaurante: idRestaurante, ...extra };
    },

    /** Inyecta id_restaurante en datos para create/update */
    data<T extends Record<string, unknown>>(d: T): T & { id_restaurante: number } {
      return { ...d, id_restaurante: idRestaurante };
    },

    /** Valida que un registro pertenece a este tenant */
    assert<T extends { id_restaurante?: number | null }>(record: T | null, id: number): T {
      if (!record) throw new NotFoundError(`Registro ${id} no encontrado`);
      if (record.id_restaurante !== idRestaurante) {
        throw new ForbiddenError('No tienes acceso a este recurso');
      }
      return record;
    },

    idRestaurante,
    idGrupo,
  };
}
