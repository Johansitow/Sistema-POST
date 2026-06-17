/**
 * FeatureFlagService - Gestión y evaluación de feature flags
 *
 * Lógica de resolución:
 *   1. Si el flag no existe → false
 *   2. Si el flag global está deshabilitado → false
 *   3. Si scope = 'global' → retorna habilitado global
 *   4. Si scope = 'contexto' → busca asignación específica, fallback al global
 *
 * Uso:
 *   const enabled = await featureFlagService.isEnabled('variantes_productos');
 *   const flags   = await featureFlagService.getClientFlags();
 */

import { featureFlagRepository } from '../repositories/feature-flag.repository';
import { NotFoundError, ConflictError } from '../exceptions/HttpErrors';
import { cacheGetOrSet, cacheDel, CACHE_TTL } from '../config/redis';
import { socketGateway } from '../config/socket.gateway';
import { resolveAsignacion } from '../lib/flagContexto';

const KEY_ALL  = 'ff:all';
const keyOne   = (nombre: string) => `ff:${nombre}`;

export const featureFlagService = {
  async listar() {
    return cacheGetOrSet(KEY_ALL, CACHE_TTL.MID, () => featureFlagRepository.findAll());
  },

  async obtenerPorId(id: number) {
    const flag = await featureFlagRepository.findById(id);
    if (!flag) throw new NotFoundError('Feature Flag');
    return flag;
  },

  /**
   * Verifica si un feature flag está habilitado.
   *
   * Resolución para scope=contexto:
   *   1. Asignación de restaurante (más específica) → gana si existe
   *   2. Asignación de grupo (default de grupo) → gana si no hay de restaurante
   *   3. false → sin asignación explícita
   *
   * @param nombre           Nombre del flag (ej: 'modulo.recetas')
   * @param restauranteCtx   Contexto de sede, ej: buildContexto('restaurante', id)
   * @param grupoCtx         Contexto de grupo, ej: buildContexto('grupo', id)
   */
  async isEnabled(nombre: string, restauranteCtx?: string, grupoCtx?: string): Promise<boolean> {
    const cacheKey = restauranteCtx
      ? `${keyOne(nombre)}:${restauranteCtx}:${grupoCtx ?? ''}`
      : keyOne(nombre);

    return cacheGetOrSet(cacheKey, CACHE_TTL.SHORT, async () => {
      const flag = await featureFlagRepository.findByNombre(nombre);
      if (!flag || !flag.habilitado) return false;
      if (flag.scope === 'global') return true;
      return resolveAsignacion(flag.asignaciones, restauranteCtx, grupoCtx);
    });
  },

  /**
   * Retorna todos los flags como mapa nombre→boolean para el cliente.
   * El grupo se deriva en el backend (req.grupoId via tenantContextOptional);
   * nunca se acepta como parámetro del cliente por seguridad multi-tenant.
   *
   * @param restauranteCtx   buildContexto('restaurante', req.restauranteId)
   * @param grupoCtx         buildContexto('grupo', req.grupoId)
   */
  async getClientFlags(restauranteCtx?: string, grupoCtx?: string): Promise<Record<string, boolean>> {
    const flags = await this.listar();
    const result: Record<string, boolean> = {};

    for (const flag of flags) {
      if (!flag.habilitado) {
        result[flag.nombre] = false;
        continue;
      }
      if (flag.scope === 'global') {
        result[flag.nombre] = true;
        continue;
      }
      result[flag.nombre] = resolveAsignacion(flag.asignaciones, restauranteCtx, grupoCtx);
    }
    return result;
  },

  async crear(data: {
    nombre: string;
    descripcion?: string;
    habilitado?: boolean;
    scope?: string;
    metadata?: Record<string, unknown>;
  }) {
    const existente = await featureFlagRepository.findByNombre(data.nombre);
    if (existente) throw new ConflictError(`Ya existe un feature flag con el nombre '${data.nombre}'`);

    const flag = await featureFlagRepository.create(data);
    await cacheDel(KEY_ALL);
    socketGateway.emitFeatureFlagChanged({ nombre: flag.nombre, habilitado: flag.habilitado, accion: 'crear' });
    return flag;
  },

  async actualizar(id: number, data: Partial<{
    nombre: string;
    descripcion: string;
    habilitado: boolean;
    scope: string;
    metadata: Record<string, unknown>;
  }>) {
    const existente = await this.obtenerPorId(id); // includes asignaciones
    const flag = await featureFlagRepository.update(id, data);

    // Siempre invalidar la clave global del flag y el listado
    const keysParaInvalidar: string[] = [KEY_ALL, keyOne(existente.nombre)];

    // Si cambió el nombre, también invalidar:
    //   1. Las claves contexto del nombre VIEJO (ff:old_name:restaurante_X)
    //   2. La clave del nombre NUEVO (por si había una entrada stale)
    if (data.nombre && data.nombre !== existente.nombre) {
      for (const asignacion of existente.asignaciones ?? []) {
        keysParaInvalidar.push(`${keyOne(existente.nombre)}:${asignacion.contexto}`);
      }
      keysParaInvalidar.push(keyOne(data.nombre));
    }

    await cacheDel(...keysParaInvalidar);
    socketGateway.emitFeatureFlagChanged({ nombre: flag.nombre, habilitado: flag.habilitado, accion: 'actualizar' });
    return flag;
  },

  async eliminar(id: number) {
    const existente = await this.obtenerPorId(id);
    await featureFlagRepository.delete(id);
    await cacheDel(KEY_ALL, keyOne(existente.nombre));
    socketGateway.emitFeatureFlagChanged({ nombre: existente.nombre, habilitado: false, accion: 'eliminar' });
  },

  async setAsignacion(id: number, contexto: string, habilitado: boolean) {
    const flag = await this.obtenerPorId(id);
    const asignacion = await featureFlagRepository.setAsignacion(id, contexto, habilitado);
    await cacheDel(KEY_ALL, keyOne(flag.nombre), `${keyOne(flag.nombre)}:${contexto}`);
    socketGateway.emitFeatureFlagChanged({ nombre: flag.nombre, habilitado: flag.habilitado, accion: 'asignacion' });
    return asignacion;
  },

  async eliminarAsignacion(id: number, contexto: string) {
    const flag = await this.obtenerPorId(id);
    await featureFlagRepository.deleteAsignacion(id, contexto);
    await cacheDel(KEY_ALL, keyOne(flag.nombre), `${keyOne(flag.nombre)}:${contexto}`);
    socketGateway.emitFeatureFlagChanged({ nombre: flag.nombre, habilitado: flag.habilitado, accion: 'asignacion' });
  },
};
