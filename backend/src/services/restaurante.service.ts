/**
 * RestauranteService — Lógica de negocio para gestión multi-restaurante
 *
 * Scope multi-tenant (admins de grupo):
 * Los métodos de mutación y de usuarios-por-sede aceptan un `grupoId` opcional
 * (req.grupoAdminId resuelto por requireAdminAccess). Cuando está presente:
 * - Anti-IDOR: una sede de otro grupo produce NotFoundError (no revela existencia).
 * - crear() fuerza id_grupo al grupo administrado y respeta plan_max_restaurantes.
 * - actualizar() aplica whitelist: nunca id_grupo, es_default, tipo_tenant ni
 *   config (escalación de privilegios / romper aislamiento).
 * - asignarUsuario() exige que el usuario ya sea miembro del grupo (UsuarioGrupo).
 * Para superadmin (grupoId undefined) el comportamiento es global, sin cambios.
 */

import { restauranteRepository } from '../repositories/restaurante.repository';
import { usuarioRepository }    from '../repositories/usuario.repository';
import { grupoNegocioRepository } from '../repositories/grupo-negocio.repository';
import { configuracionRestauranteRepository } from '../repositories/configuracion-restaurante.repository';
import { cacheGetOrSet, cacheDel } from '../config/redis';
import { NotFoundError, BadRequestError, ForbiddenError } from '../exceptions/HttpErrors';
import { invalidateTenantCache } from '../middlewares/tenantIsolation.middleware';

const CACHE_KEY = 'restaurantes:all';

/** Campos de sede editables por un admin de grupo (whitelist) */
const CAMPOS_SEDE_ADMIN_GRUPO = new Set([
  'nombre', 'descripcion', 'logo_url', 'direccion', 'ciudad',
  'telefono', 'email', 'zona_horaria', 'moneda', 'activo',
]);

export const restauranteService = {

  listar: () =>
    cacheGetOrSet(CACHE_KEY, 300, () => restauranteRepository.findAll()),

  /** @param grupoId — si viene, solo las sedes de ese grupo (admin de grupo) */
  listarTodos: (grupoId?: number) =>
    grupoId
      ? restauranteRepository.findByGrupo(grupoId)
      : restauranteRepository.findAllIncludeInactive(),

  obtenerPorId: async (id: number) => {
    const r = await restauranteRepository.findById(id);
    if (!r) throw new NotFoundError('Restaurante');
    return r;
  },

  /** Anti-IDOR: valida que la sede exista Y pertenezca al grupo administrado. */
  assertSedeDelGrupo: async (id_restaurante: number, grupoId?: number) => {
    const sede = await restauranteService.obtenerPorId(id_restaurante);
    if (grupoId && sede.id_grupo !== grupoId) {
      console.warn(`[Sedes] intento de acceso cross-grupo: sede=${id_restaurante} grupo=${grupoId}`);
      throw new NotFoundError('Restaurante');
    }
    return sede;
  },

  obtenerDefault: () =>
    restauranteRepository.findDefault(),

  crear: async (data: Parameters<typeof restauranteRepository.create>[0], grupoId?: number) => {
    if (grupoId) {
      // Admin de grupo: la sede nace en SU grupo, sin flags de aislamiento,
      // y respetando el límite del plan SaaS
      const grupo = await grupoNegocioRepository.findById(grupoId);
      if (!grupo) throw new NotFoundError('Grupo de negocio');
      const activas = await grupoNegocioRepository.countRestaurantesActivos(grupoId);
      if (activas >= grupo.plan_max_restaurantes) {
        throw new ForbiddenError(
          `Tu plan (${grupo.plan}) permite máximo ${grupo.plan_max_restaurantes} sedes activas. ` +
          'Contacta al administrador del sistema para ampliarlo.'
        );
      }
      const { es_default, tipo_tenant, config, ...basicos } = data as any;
      data = { ...basicos, id_grupo: grupoId };
    } else if (!(data as any).id_grupo) {
      throw new BadRequestError('id_grupo es requerido');
    }
    // Primer restaurante siempre es default
    const total = await restauranteRepository.count();
    if (total === 0) data = { ...data, es_default: true };
    const r = await restauranteRepository.create(data);
    await cacheDel(CACHE_KEY);
    return r;
  },

  actualizar: async (
    id: number,
    data: Parameters<typeof restauranteRepository.update>[1],
    grupoId?: number
  ) => {
    await restauranteService.assertSedeDelGrupo(id, grupoId);
    if (grupoId && data) {
      // Whitelist para admins de grupo: solo datos básicos de la sede
      data = Object.fromEntries(
        Object.entries(data).filter(([k]) => CAMPOS_SEDE_ADMIN_GRUPO.has(k))
      ) as typeof data;
    }
    const r = await restauranteRepository.update(id, data!);
    await cacheDel(CACHE_KEY);
    // Si cambia tipo_tenant, invalidar la cache de aislamiento para que
    // tenantIsolation middleware evalúe el nuevo valor en el próximo request
    if (data && 'tipo_tenant' in data) invalidateTenantCache(id);
    return r;
  },

  toggleActivo: async (id: number, grupoId?: number) => {
    const r = await restauranteService.assertSedeDelGrupo(id, grupoId);
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

  listarUsuarios: async (id_restaurante: number, grupoId?: number) => {
    await restauranteService.assertSedeDelGrupo(id_restaurante, grupoId);
    return restauranteRepository.findUsuarios(id_restaurante);
  },

  asignarUsuario: async (id_restaurante: number, id_usuario: number, grupoId?: number) => {
    await restauranteService.assertSedeDelGrupo(id_restaurante, grupoId);
    const usuario = await usuarioRepository.findById(id_usuario);
    if (!usuario) throw new NotFoundError('Usuario');
    if (grupoId) {
      // Un admin de grupo solo vincula usuarios que pertenecen a su grupo
      const pertenece = await usuarioRepository.perteneceAGrupo(id_usuario, grupoId);
      if (!pertenece) throw new NotFoundError('Usuario');
    }
    return restauranteRepository.asignarUsuario(id_restaurante, id_usuario);
  },

  removerUsuario: async (id_restaurante: number, id_usuario: number, grupoId?: number) => {
    await restauranteService.assertSedeDelGrupo(id_restaurante, grupoId);
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
