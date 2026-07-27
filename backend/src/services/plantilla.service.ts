/**
 * PlantillaService - Lógica de negocio para plantillas de impresión
 *
 * Tipos soportados:
 *   'comanda'  → para cocina
 *   'factura'  → factura completa
 *   'ticket'   → ticket de caja
 *   'cocina'   → comanda simplificada para cocina
 */

import { EstadoGeneral, Prisma } from '@prisma/client';
import { plantillaRepository } from '../repositories/plantilla.repository';
import { NotFoundError, ConflictError } from '../exceptions/HttpErrors';
import { assertGrupoCtx, type TenantCtx } from '../lib/tenantCtx';
import { cacheGetOrSet, cacheDel, CACHE_TTL } from '../config/redis';
import prisma from '../config/database';
import { TIPOS_DOCUMENTO } from '../lib/documentos/catalogo';
import { TIPOS_TERMICOS } from '../lib/plantillas/tipos';

const KEY_ALL  = 'plantillas:all';
const keyOne   = (id: number) => `plantilla:${id}`;

/**
 * Tipos de impresión térmica (tirilla) + familia `documento_*` de documentos
 * laborales en A4. Comparten modelo, scoping y CRUD; solo cambia el renderer:
 * los primeros los pinta ticketRenderer.ts en el frontend, los segundos
 * documentoRenderer.ts en el backend (ver documento.service.ts).
 */
const TIPOS_VALIDOS: readonly string[] = [...TIPOS_TERMICOS, ...TIPOS_DOCUMENTO];

export const plantillaService = {
  async listar(tipo?: string, tenant?: { id_restaurante?: number; id_grupo?: number }) {
    const key = tipo ? `plantillas:tipo:${tipo}` : KEY_ALL;
    return cacheGetOrSet(key, CACHE_TTL.LONG, () => plantillaRepository.findAll(tipo, tenant));
  },

  async obtenerPorId(id: number) {
    const plantilla = await cacheGetOrSet(
      keyOne(id),
      CACHE_TTL.LONG,
      () => plantillaRepository.findById(id)
    );
    if (!plantilla || plantilla.estado === EstadoGeneral.eliminado) {
      throw new NotFoundError('Plantilla de impresión');
    }
    return plantilla;
  },

  /**
   * Plantilla por defecto de un tipo, resuelta por precedencia
   * sede (id_restaurante) → grupo (id_grupo) → global. NO se cachea: la
   * resolución depende del tenant que consulta y la invalidación por sede
   * sería frágil (un cambio en el default del grupo no podría invalidar las
   * claves cacheadas por cada sede que hace fallback a él). Son consultas
   * indexadas y la impresión no es hot-path.
   */
  async obtenerDefault(tipo: string, tenant?: { id_restaurante?: number; id_grupo?: number }) {
    return plantillaRepository.findDefault(tipo, tenant);
  },

  async crear(data: {
    nombre: string;
    tipo: string;
    es_default?: boolean;
    /** true → aplica solo a la sede activa; false/omitido → a todo el grupo. */
    solo_sede?: boolean;
    plantilla: Record<string, unknown>;
  }, ctx: TenantCtx) {
    assertGrupoCtx(ctx);

    if (!TIPOS_VALIDOS.includes(data.tipo)) {
      throw new ConflictError(`Tipo inválido. Tipos válidos: ${TIPOS_VALIDOS.join(', ')}`);
    }

    // Superadmin sin grupoId crea plantilla global (id_grupo=null)
    const id_grupo: number | null = ctx.grupoId ?? null;
    // Scoping por sede: solo la sede ACTIVA del ctx (nunca un id arbitrario del body → evita IDOR)
    const id_restaurante: number | null =
      data.solo_sede && ctx.restauranteId ? ctx.restauranteId : null;

    const { solo_sede: _omit, ...campos } = data;

    // clearDefaults + create en una sola transacción para evitar que dos requests
    // concurrentes dejen dos plantillas con es_default=true del mismo tipo y ámbito
    const plantilla = await prisma.$transaction(async (tx) => {
      if (data.es_default) {
        // El default se limpia SOLO dentro del mismo ámbito (grupo o sede), para que
        // una sede pueda tener su propio default sin pisar el default del grupo.
        await tx.plantillaImpresion.updateMany({
          where: { tipo: data.tipo, es_default: true, id_grupo, id_restaurante },
          data:  { es_default: false },
        });
      }
      return tx.plantillaImpresion.create({
        data: { ...campos, id_grupo, id_restaurante, plantilla: data.plantilla as Prisma.InputJsonValue },
      });
    });

    await cacheDel(KEY_ALL, `plantillas:tipo:${data.tipo}`);
    return plantilla;
  },

  async actualizar(id: number, data: Partial<{
    nombre: string;
    tipo: string;
    es_default: boolean;
    solo_sede: boolean;
    plantilla: Record<string, unknown>;
  }>, ctx: TenantCtx) {
    const existente = await plantillaRepository.findByIdScoped(id, ctx);

    if (data.tipo && !TIPOS_VALIDOS.includes(data.tipo)) {
      throw new ConflictError(`Tipo inválido. Tipos válidos: ${TIPOS_VALIDOS.join(', ')}`);
    }

    const tipo = data.tipo || existente.tipo;
    // Ámbito efectivo: si el body trae solo_sede lo aplicamos (sede activa del ctx),
    // si no, conservamos el ámbito existente de la plantilla.
    const id_restaurante: number | null = data.solo_sede === undefined
      ? existente.id_restaurante
      : (data.solo_sede && ctx.restauranteId ? ctx.restauranteId : null);

    // clearDefaults scoped al mismo grupo Y ámbito — no pisa defaults de otras cadenas ni ámbitos
    const plantilla = await prisma.$transaction(async (tx) => {
      if (data.es_default) {
        await tx.plantillaImpresion.updateMany({
          where: { tipo, es_default: true, id: { not: id }, id_grupo: existente.id_grupo, id_restaurante },
          data:  { es_default: false },
        });
      }
      const { plantilla: plantillaJson, solo_sede: _omit, ...restData } = data;
      return tx.plantillaImpresion.update({
        where: { id },
        data:  {
          ...restData,
          ...(data.solo_sede !== undefined && { id_restaurante }),
          ...(plantillaJson !== undefined && { plantilla: plantillaJson as Prisma.InputJsonValue }),
        },
      });
    });

    // Si cambió el tipo, también invalidar el caché del tipo ANTERIOR
    const keysToDelete = [KEY_ALL, keyOne(id), `plantillas:tipo:${tipo}`];
    if (data.tipo && data.tipo !== existente.tipo) {
      keysToDelete.push(`plantillas:tipo:${existente.tipo}`);
    }
    await cacheDel(...keysToDelete);
    return plantilla;
  },

  async eliminar(id: number, ctx: TenantCtx) {
    const existente = await plantillaRepository.findByIdScoped(id, ctx);
    await plantillaRepository.softDelete(id);
    await cacheDel(KEY_ALL, keyOne(id), `plantillas:tipo:${existente.tipo}`);
  },
};
