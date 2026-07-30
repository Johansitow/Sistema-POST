/**
 * PlantillaRepository — extiende TenantRepository (llave id_grupo).
 *
 * findByIdScoped(id, ctx): 404 si la plantilla no existe o pertenece a otro grupo.
 * Plantillas globales (id_grupo=null) solo las toca el superadmin (bypass).
 */

import { EstadoGeneral, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { TenantRepository } from './base/TenantRepository';
import type { TenantCtx } from '../lib/tenantCtx';

class PlantillaRepositoryImpl extends TenantRepository {
  constructor() {
    super(prisma);
  }

  findAll(tipo?: string, tenant?: { id_restaurante?: number; id_grupo?: number }) {
    const tenantFilter = tenant?.id_restaurante || tenant?.id_grupo
      ? {
          OR: [
            { id_restaurante: null, id_grupo: null },
            ...(tenant.id_restaurante ? [{ id_restaurante: tenant.id_restaurante }] : []),
            ...(tenant.id_grupo       ? [{ id_grupo:       tenant.id_grupo       }] : []),
          ],
        }
      : {};

    return prisma.plantillaImpresion.findMany({
      where: {
        estado: { not: EstadoGeneral.eliminado },
        ...(tipo ? { tipo } : {}),
        ...tenantFilter,
      },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    });
  }

  findById(id: number) {
    return prisma.plantillaImpresion.findUnique({ where: { id } });
  }

  /**
   * Lookup guardado por id_grupo.
   * NotFoundError si no existe O es de otro grupo (incluye globales para usuarios normales).
   * ForbiddenError si ctx no tiene grupoId y no es superadmin.
   * Superadmin: accede sin restricción.
   */
  findByIdScoped(id: number, ctx: TenantCtx) {
    return this._scopedLookup(
      (i) => prisma.plantillaImpresion.findUnique({ where: { id: i } }),
      id,
      ctx,
      'id_grupo',
    );
  }

  /**
   * Plantilla por defecto de un tipo, con precedencia multi-tenant:
   *   1. sede    (id_restaurante = tenant.id_restaurante)   ← mayor precedencia
   *   2. grupo   (id_grupo = tenant.id_grupo, sin sede)
   *   3. global  (id_grupo = null, id_restaurante = null)
   * Devuelve la primera que exista. Sin tenant, solo busca la global.
   */
  async findDefault(tipo: string, tenant?: { id_restaurante?: number; id_grupo?: number }) {
    const base = { tipo, es_default: true, estado: { not: EstadoGeneral.eliminado } };

    if (tenant?.id_restaurante) {
      const sede = await prisma.plantillaImpresion.findFirst({
        where: { ...base, id_restaurante: tenant.id_restaurante },
      });
      if (sede) return sede;
    }

    if (tenant?.id_grupo) {
      const grupo = await prisma.plantillaImpresion.findFirst({
        where: { ...base, id_grupo: tenant.id_grupo, id_restaurante: null },
      });
      if (grupo) return grupo;
    }

    return prisma.plantillaImpresion.findFirst({
      where: { ...base, id_grupo: null, id_restaurante: null },
    });
  }

  create(data: {
    nombre: string;
    tipo: string;
    es_default?: boolean;
    plantilla: Record<string, unknown>;
    id_grupo: number | null;
    estado?: EstadoGeneral;
  }) {
    return prisma.plantillaImpresion.create({
      data: { ...data, plantilla: data.plantilla as Prisma.InputJsonValue },
    });
  }

  update(id: number, data: Partial<{
    nombre: string;
    tipo: string;
    es_default: boolean;
    plantilla: Record<string, unknown>;
    estado: EstadoGeneral;
  }>) {
    const { plantilla, ...rest } = data;
    return prisma.plantillaImpresion.update({
      where: { id },
      data: {
        ...rest,
        ...(plantilla !== undefined && { plantilla: plantilla as Prisma.InputJsonValue }),
      },
    });
  }

  clearDefaults(tipo: string, exceptId?: number) {
    return prisma.plantillaImpresion.updateMany({
      where: {
        tipo,
        es_default: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { es_default: false },
    });
  }

  softDelete(id: number) {
    return prisma.plantillaImpresion.update({
      where: { id },
      data: { estado: EstadoGeneral.eliminado },
    });
  }
}

export const plantillaRepository = new PlantillaRepositoryImpl();
