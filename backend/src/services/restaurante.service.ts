/**
 * RestauranteService — Lógica de negocio para gestión multi-restaurante
 */

import { restauranteRepository } from '../repositories/restaurante.repository';
import { usuarioRepository }    from '../repositories/usuario.repository';
import { configuracionRestauranteRepository } from '../repositories/configuracion-restaurante.repository';
import { cacheGetOrSet, cacheDel } from '../config/redis';
import { NotFoundError, BadRequestError } from '../exceptions/HttpErrors';
import { invalidateTenantCache } from '../middlewares/tenantIsolation.middleware';

const CACHE_KEY = 'restaurantes:all';

export const restauranteService = {

  listar: () =>
    cacheGetOrSet(CACHE_KEY, 300, () => restauranteRepository.findAll()),

  listarTodos: () =>
    restauranteRepository.findAllIncludeInactive(),

  obtenerPorId: async (id: number) => {
    const r = await restauranteRepository.findById(id);
    if (!r) throw new NotFoundError('Restaurante');
    return r;
  },

  obtenerDefault: () =>
    restauranteRepository.findDefault(),

  crear: async (data: Parameters<typeof restauranteRepository.create>[0]) => {
    // Primer restaurante siempre es default
    const total = await restauranteRepository.count();
    if (total === 0) data = { ...data, es_default: true };
    const r = await restauranteRepository.create(data);
    await cacheDel(CACHE_KEY);
    return r;
  },

  actualizar: async (id: number, data: Parameters<typeof restauranteRepository.update>[1]) => {
    await restauranteService.obtenerPorId(id);
    const r = await restauranteRepository.update(id, data!);
    await cacheDel(CACHE_KEY);
    // Si cambia tipo_tenant, invalidar la cache de aislamiento para que
    // tenantIsolation middleware evalúe el nuevo valor en el próximo request
    if (data && 'tipo_tenant' in data) invalidateTenantCache(id);
    return r;
  },

  toggleActivo: async (id: number) => {
    const r = await restauranteRepository.findById(id);
    if (!r) throw new NotFoundError('Restaurante');
    if (r.es_default && r.activo) {
      throw new BadRequestError(
        'No se puede desactivar el restaurante por defecto. Asigna otro como default primero.'
      );
    }
    const updated = await restauranteRepository.toggleActivo(id);
    await cacheDel(CACHE_KEY);
    return updated;
  },

  // ── Gestión de usuarios por restaurante ───────────────────────────────────

  listarUsuarios: async (id_restaurante: number) => {
    await restauranteService.obtenerPorId(id_restaurante); // valida que exista
    return restauranteRepository.findUsuarios(id_restaurante);
  },

  asignarUsuario: async (id_restaurante: number, id_usuario: number) => {
    await restauranteService.obtenerPorId(id_restaurante);
    const usuario = await usuarioRepository.findById(id_usuario);
    if (!usuario) throw new NotFoundError('Usuario');
    return restauranteRepository.asignarUsuario(id_restaurante, id_usuario);
  },

  removerUsuario: async (id_restaurante: number, id_usuario: number) => {
    await restauranteService.obtenerPorId(id_restaurante);
    try {
      return await restauranteRepository.removerUsuario(id_restaurante, id_usuario);
    } catch {
      throw new BadRequestError('El usuario no está asignado a este restaurante');
    }
  },

  // ── ConfiguracionRestaurante ──────────────────────────────────────────────

  listarConfig: async (id_restaurante: number) => {
    await restauranteService.obtenerPorId(id_restaurante);
    return configuracionRestauranteRepository.findAll(id_restaurante);
  },

  getConfig: async (id_restaurante: number, clave: string) => {
    await restauranteService.obtenerPorId(id_restaurante);
    const config = await configuracionRestauranteRepository.findByClave(id_restaurante, clave);
    if (!config) throw new NotFoundError(`Configuración '${clave}'`);
    return config;
  },

  setConfig: async (id_restaurante: number, clave: string, valor: string) => {
    await restauranteService.obtenerPorId(id_restaurante);
    return configuracionRestauranteRepository.upsert(id_restaurante, clave, valor);
  },

  setConfigBulk: async (id_restaurante: number, items: { clave: string; valor: string }[]) => {
    await restauranteService.obtenerPorId(id_restaurante);
    return configuracionRestauranteRepository.upsertMany(id_restaurante, items);
  },

  deleteConfig: async (id_restaurante: number, clave: string) => {
    await restauranteService.obtenerPorId(id_restaurante);
    const existe = await configuracionRestauranteRepository.findByClave(id_restaurante, clave);
    if (!existe) throw new NotFoundError(`Configuración '${clave}'`);
    return configuracionRestauranteRepository.delete(id_restaurante, clave);
  },
};
