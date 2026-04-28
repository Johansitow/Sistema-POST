/**
 * PlantillaService - Lógica de negocio para plantillas de impresión
 *
 * Tipos soportados:
 *   'comanda'  → para cocina
 *   'factura'  → factura completa
 *   'ticket'   → ticket de caja
 *   'cocina'   → comanda simplificada para cocina
 */

import { EstadoGeneral } from '@prisma/client';
import { plantillaRepository } from '../repositories/plantilla.repository';
import { NotFoundError, ConflictError } from '../exceptions/HttpErrors';
import { cacheGetOrSet, cacheDel, CACHE_TTL } from '../config/redis';
import prisma from '../config/database';

const KEY_ALL  = 'plantillas:all';
const keyOne   = (id: number) => `plantilla:${id}`;
const keyDefault = (tipo: string) => `plantilla:default:${tipo}`;

const TIPOS_VALIDOS = ['comanda', 'factura', 'ticket', 'cocina'];

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
  }) {
    if (!TIPOS_VALIDOS.includes(data.tipo)) {
      throw new ConflictError(`Tipo inválido. Tipos válidos: ${TIPOS_VALIDOS.join(', ')}`);
    }

    // clearDefaults + create en una sola transacción para evitar que dos requests
    // concurrentes dejen dos plantillas con es_default=true del mismo tipo
    const plantilla = await prisma.$transaction(async (tx) => {
      if (data.es_default) {
        await tx.plantillaImpresion.updateMany({
          where: { tipo: data.tipo, es_default: true },
          data:  { es_default: false },
        });
      }
      return tx.plantillaImpresion.create({ data: data as any });
    });

    await cacheDel(KEY_ALL, `plantillas:tipo:${data.tipo}`, keyDefault(data.tipo));
    return plantilla;
  },

  async actualizar(id: number, data: Partial<{
    nombre: string;
    tipo: string;
    es_default: boolean;
    plantilla: Record<string, unknown>;
  }>) {
    const existente = await this.obtenerPorId(id);

    if (data.tipo && !TIPOS_VALIDOS.includes(data.tipo)) {
      throw new ConflictError(`Tipo inválido. Tipos válidos: ${TIPOS_VALIDOS.join(', ')}`);
    }

    const tipo = data.tipo || existente.tipo;

    // clearDefaults + update en una sola transacción (mismo motivo que en crear)
    const plantilla = await prisma.$transaction(async (tx) => {
      if (data.es_default) {
        await tx.plantillaImpresion.updateMany({
          where: { tipo, es_default: true, id: { not: id } },
          data:  { es_default: false },
        });
      }
      return tx.plantillaImpresion.update({ where: { id }, data: data as any });
    });

    // Si cambió el tipo, también invalidar el caché del tipo ANTERIOR
    const keysToDelete = [KEY_ALL, keyOne(id), `plantillas:tipo:${tipo}`, keyDefault(tipo)];
    if (data.tipo && data.tipo !== existente.tipo) {
      keysToDelete.push(`plantillas:tipo:${existente.tipo}`, keyDefault(existente.tipo));
    }
    await cacheDel(...keysToDelete);
    return plantilla;
  },

  async eliminar(id: number) {
    const existente = await this.obtenerPorId(id);
    await plantillaRepository.softDelete(id);
    await cacheDel(KEY_ALL, keyOne(id), `plantillas:tipo:${existente.tipo}`, keyDefault(existente.tipo));
  },
};
