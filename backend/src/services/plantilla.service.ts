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

const KEY_ALL  = 'plantillas:all';
const keyOne   = (id: number) => `plantilla:${id}`;
const keyDefault = (tipo: string) => `plantilla:default:${tipo}`;

/**
 * Tipos de impresión térmica (tirilla) + familia `documento_*` de documentos
 * laborales en A4. Comparten modelo, scoping y CRUD; solo cambia el renderer:
 * los primeros los pinta ticketRenderer.ts en el frontend, los segundos
 * documentoRenderer.ts en el backend (ver documento.service.ts).
 */
const TIPOS_VALIDOS = ['comanda', 'factura', 'ticket', 'cocina', ...TIPOS_DOCUMENTO];

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

  async obtenerDefault(tipo: string) {
    return cacheGetOrSet(
      keyDefault(tipo),
      CACHE_TTL.LONG,
      () => plantillaRepository.findDefault(tipo)
    );
  },

  async crear(data: {
    nombre: string;
    tipo: string;
    es_default?: boolean;
    plantilla: Record<string, unknown>;
  }, ctx: TenantCtx) {
    assertGrupoCtx(ctx);

    if (!TIPOS_VALIDOS.includes(data.tipo)) {
      throw new ConflictError(`Tipo inválido. Tipos válidos: ${TIPOS_VALIDOS.join(', ')}`);
    }

    // Superadmin sin grupoId crea plantilla global (id_grupo=null)
    const id_grupo: number | null = ctx.grupoId ?? null;

    // clearDefaults + create en una sola transacción para evitar que dos requests
    // concurrentes dejen dos plantillas con es_default=true del mismo tipo y grupo
    const plantilla = await prisma.$transaction(async (tx) => {
      if (data.es_default) {
        await tx.plantillaImpresion.updateMany({
          where: { tipo: data.tipo, es_default: true, id_grupo },
          data:  { es_default: false },
        });
      }
      return tx.plantillaImpresion.create({
        data: { ...data, id_grupo, plantilla: data.plantilla as Prisma.InputJsonValue },
      });
    });

    await cacheDel(KEY_ALL, `plantillas:tipo:${data.tipo}`, keyDefault(data.tipo));
    return plantilla;
  },

  async actualizar(id: number, data: Partial<{
    nombre: string;
    tipo: string;
    es_default: boolean;
    plantilla: Record<string, unknown>;
  }>, ctx: TenantCtx) {
    const existente = await plantillaRepository.findByIdScoped(id, ctx);

    if (data.tipo && !TIPOS_VALIDOS.includes(data.tipo)) {
      throw new ConflictError(`Tipo inválido. Tipos válidos: ${TIPOS_VALIDOS.join(', ')}`);
    }

    const tipo = data.tipo || existente.tipo;

    // clearDefaults scoped al mismo grupo — evita limpiar defaults de otras cadenas
    const plantilla = await prisma.$transaction(async (tx) => {
      if (data.es_default) {
        await tx.plantillaImpresion.updateMany({
          where: { tipo, es_default: true, id: { not: id }, id_grupo: existente.id_grupo },
          data:  { es_default: false },
        });
      }
      const { plantilla: plantillaJson, ...restData } = data;
      return tx.plantillaImpresion.update({
        where: { id },
        data:  {
          ...restData,
          ...(plantillaJson !== undefined && { plantilla: plantillaJson as Prisma.InputJsonValue }),
        },
      });
    });

    // Si cambió el tipo, también invalidar el caché del tipo ANTERIOR
    const keysToDelete = [KEY_ALL, keyOne(id), `plantillas:tipo:${tipo}`, keyDefault(tipo)];
    if (data.tipo && data.tipo !== existente.tipo) {
      keysToDelete.push(`plantillas:tipo:${existente.tipo}`, keyDefault(existente.tipo));
    }
    await cacheDel(...keysToDelete);
    return plantilla;
  },

  async eliminar(id: number, ctx: TenantCtx) {
    const existente = await plantillaRepository.findByIdScoped(id, ctx);
    await plantillaRepository.softDelete(id);
    await cacheDel(KEY_ALL, keyOne(id), `plantillas:tipo:${existente.tipo}`, keyDefault(existente.tipo));
  },
};
