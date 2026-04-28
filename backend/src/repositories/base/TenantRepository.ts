/**
 * TenantRepository — clase base para repositorios con aislamiento de tenant.
 *
 * Uso para NUEVOS repositorios (class-based):
 *
 *   class LoteRepo extends TenantRepository {
 *     findAll() {
 *       return this.prisma.lote.findMany({ where: this.scope() });
 *     }
 *     create(data: CreateLoteDto) {
 *       return this.prisma.lote.create({ data: this.scopeData(data) });
 *     }
 *   }
 *
 * Para repositorios EXISTENTES (object-literal), usar tenantScope() en su lugar.
 */

import { PrismaClient } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../../exceptions/HttpErrors';

export abstract class TenantRepository {
  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly idRestaurante: number,
    protected readonly idGrupo?: number
  ) {}

  /**
   * scope() — retorna el filtro WHERE para queries de este tenant.
   * Mezcla el id_restaurante obligatorio con cualquier filtro adicional.
   *
   * @example
   *   prisma.lote.findMany({ where: this.scope({ estado_lote: 'activo' }) })
   */
  protected scope(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { id_restaurante: this.idRestaurante, ...extra };
  }

  /**
   * scopeData() — inyecta id_restaurante (y opcionalmente id_grupo) en los
   * datos antes de un create/update. Previene omisión accidental del campo.
   */
  protected scopeData<T extends Record<string, unknown>>(data: T): T & { id_restaurante: number } {
    return { ...data, id_restaurante: this.idRestaurante };
  }

  /**
   * assertBelongsToTenant() — valida que un registro recuperado pertenece
   * al tenant activo. Lanza ForbiddenError si hay mismatch (IDOR prevention).
   *
   * @example
   *   const lote = await prisma.lote.findUnique({ where: { id } });
   *   this.assertBelongsToTenant(lote, id);
   *   return lote;
   */
  protected assertBelongsToTenant<T extends { id_restaurante?: number | null }>(
    record: T | null,
    id: number
  ): asserts record is T {
    if (!record) {
      throw new NotFoundError(`Registro ${id} no encontrado`);
    }
    if (record.id_restaurante !== this.idRestaurante) {
      // Log de intento de acceso cruzado — posible IDOR
      console.warn(
        `[TenantGuard] IDOR attempt: restaurante=${this.idRestaurante} intentó acceder ` +
        `a registro con id_restaurante=${record.id_restaurante} (id=${id})`
      );
      throw new ForbiddenError('No tienes acceso a este recurso');
    }
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
 *   const lotes = await loteRepository.findAll(pagination, scope.filters());
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
