/**
 * ConfiguracionService
 *
 * Gestiona la configuración dinámica del sistema.
 * Solo superadmin (o permiso config.sistema) puede editar.
 *
 * Incluye también gestión de permisos: qué permisos puede
 * otorgar un superadmin a otros roles/usuarios.
 */

import prisma from '../config/database';
import { configuracionRepository } from '../repositories/configuracion.repository';
import { configuracionRestauranteRepository } from '../repositories/configuracion-restaurante.repository';
import { configuracionGrupoRepository } from '../repositories/configuracion-grupo.repository';
import { NotFoundError, BadRequestError, ForbiddenError } from '../exceptions/HttpErrors';

// Claves que NUNCA se pueden editar desde el frontend (solo via seed/migration)
const CLAVES_SISTEMA = ['prefijo_orden'];

export const configuracionService = {

  // ── LECTURA ──────────────────────────────────────────────────────────────

  async listar(categoria?: string) {
    const configs = await configuracionRepository.findAll(categoria);
    // Parsear valores al tipo correcto
    return configs.map(c => ({
      ...c,
      valor_parseado: configuracionRepository.parseValor(c),
    }));
  },

  async obtenerPorClave(clave: string) {
    const config = await configuracionRepository.findByClave(clave);
    if (!config) throw new NotFoundError(`Configuración '${clave}'`);
    return { ...config, valor_parseado: configuracionRepository.parseValor(config) };
  },

  /** Shortcut para leer un valor ya parseado directo */
  async getValor<T = unknown>(clave: string): Promise<T> {
    const config = await configuracionRepository.findByClave(clave);
    if (!config) throw new NotFoundError(`Configuración '${clave}'`);
    return configuracionRepository.parseValor(config) as T;
  },

  /**
   * Resuelve una clave de configuración con precedencia sede → grupo → global.
   *
   * 1. Busca en ConfiguracionRestaurante (valor específico de la sede).
   * 2. Si no existe, busca en ConfiguracionGrupo (default del grupo).
   * 3. Si no existe, busca en Configuracion (valor global del sistema).
   * 4. Si no existe en ninguna capa → null.
   *
   * Usado por el wizard de onboarding y cualquier servicio que necesite
   * respetar la jerarquía de configuración multi-tenant.
   */
  async resolverParaRestaurante(
    clave: string,
    restauranteId: number,
    grupoId: number,
  ): Promise<{ valor: string; origen: 'sede' | 'grupo' | 'global' } | null> {
    const deSede = await configuracionRestauranteRepository.findByClave(restauranteId, clave);
    if (deSede) return { valor: deSede.valor, origen: 'sede' };

    const deGrupo = await configuracionGrupoRepository.findByClave(grupoId, clave);
    if (deGrupo) return { valor: deGrupo.valor, origen: 'grupo' };

    const global = await configuracionRepository.findByClave(clave);
    if (global) return { valor: global.valor, origen: 'global' };

    return null;
  },

  /**
   * Resuelve el impuesto de facturación (IVA o impoconsumo) para un restaurante,
   * con la misma precedencia sede → grupo → global que `resolverParaRestaurante`.
   *
   * Lee las claves que escribe el onboarding: `facturacion.impuesto_tarifa` (%)
   * y `facturacion.impuesto_tipo` ('iva' | 'impoconsumo').
   *
   * Si no hay tarifa configurada en ninguna capa → null (sin impuesto), nunca
   * un fallback silencioso a un porcentaje hardcodeado.
   */
  async resolverTasaImpuesto(
    restauranteId: number,
    grupoId: number,
  ): Promise<{ tarifa: number; tipo: string } | null> {
    const tarifa = await this.resolverParaRestaurante('facturacion.impuesto_tarifa', restauranteId, grupoId);
    if (!tarifa) return null;

    const tipo = await this.resolverParaRestaurante('facturacion.impuesto_tipo', restauranteId, grupoId);

    return {
      tarifa: Number(tarifa.valor),
      tipo:   tipo?.valor ?? 'impoconsumo',
    };
  },

  /**
   * Igual que `resolverTasaImpuesto`, pero resuelve `grupoId` automáticamente
   * a partir del restaurante — conveniencia para call sites que solo tienen
   * `id_restaurante` a mano (no un `TenantCtx` completo).
   */
  async resolverTasaImpuestoDeRestaurante(
    restauranteId: number,
  ): Promise<{ tarifa: number; tipo: string } | null> {
    const restaurante = await prisma.restaurante.findUnique({
      where: { id: restauranteId },
      select: { id_grupo: true },
    });
    if (!restaurante) return null;
    return this.resolverTasaImpuesto(restauranteId, restaurante.id_grupo);
  },

  // ── ESCRITURA (solo superadmin / config.sistema) ──────────────────────────

  async actualizar(clave: string, valor: string) {
    if (CLAVES_SISTEMA.includes(clave))
      throw new ForbiddenError(`La clave '${clave}' no es editable`);

    const config = await configuracionRepository.findByClave(clave);
    if (!config) throw new NotFoundError(`Configuración '${clave}'`);
    if (!config.es_editable) throw new ForbiddenError(`La clave '${clave}' no es editable`);

    // Validar tipo
    this._validarTipo(valor, config.tipo_dato);

    return configuracionRepository.update(clave, valor);
  },

  async actualizarVarias(items: { clave: string; valor: string }[]) {
    // Validar todas antes de escribir ninguna
    for (const item of items) {
      if (CLAVES_SISTEMA.includes(item.clave))
        throw new ForbiddenError(`La clave '${item.clave}' no es editable`);
      const config = await configuracionRepository.findByClave(item.clave);
      if (!config) throw new NotFoundError(`Configuración '${item.clave}'`);
      if (!config.es_editable) throw new ForbiddenError(`La clave '${item.clave}' no es editable`);
      this._validarTipo(item.valor, config.tipo_dato);
    }
    return configuracionRepository.updateMany(items);
  },

  _validarTipo(valor: string, tipo: string) {
    if (tipo === 'number' && isNaN(Number(valor)))
      throw new BadRequestError(`El valor '${valor}' no es un número válido`);
    if (tipo === 'boolean' && !['true', 'false'].includes(valor))
      throw new BadRequestError(`El valor debe ser 'true' o 'false'`);
    if (tipo === 'json') {
      try { JSON.parse(valor); }
      catch { throw new BadRequestError(`El valor no es JSON válido`); }
    }
  },

  // ── GESTIÓN DE PERMISOS ───────────────────────────────────────────────────

  /** Lista todos los permisos disponibles en el sistema */
  async listarPermisos() {
    return prisma.permiso.findMany({ orderBy: [{ modulo: 'asc' }, { nombre: 'asc' }] });
  },

  /** Lista permisos asignados a un rol */
  async listarPermisosRol(id_rol: number) {
    const rol = await prisma.rol.findUnique({
      where: { id: id_rol },
      include: { permisos: { include: { permiso: true } } },
    });
    if (!rol) throw new NotFoundError('Rol');
    return rol.permisos.map(rp => rp.permiso);
  },

  /**
   * Asigna un permiso a un rol.
   * @param esSuperAdmin — un admin de grupo (false) no puede tocar roles de
   *   sistema/superadmin ni otorgar permisos del módulo 'administracion'
   *   (evitaría que se escale privilegios a sí mismo vía su propio rol).
   */
  async asignarPermiso(id_rol: number, id_permiso: number, esSuperAdmin = true) {
    const [rol, permiso] = await Promise.all([
      prisma.rol.findUnique({ where: { id: id_rol } }),
      prisma.permiso.findUnique({ where: { id: id_permiso } }),
    ]);
    if (!rol)     throw new NotFoundError('Rol');
    if (!permiso) throw new NotFoundError('Permiso');

    assertRolEditablePorNoSA(rol, esSuperAdmin);
    if (!esSuperAdmin && permiso.modulo === 'administracion') {
      throw new ForbiddenError('Los permisos de administración solo los otorga el super administrador');
    }

    // Verificar que no exista ya
    const existente = await prisma.rolPermiso.findFirst({
      where: { id_rol, id_permiso },
    });
    if (existente) throw new BadRequestError('El rol ya tiene ese permiso');

    return prisma.rolPermiso.create({ data: { id_rol, id_permiso } });
  },

  /** Revoca un permiso de un rol */
  async revocarPermiso(id_rol: number, id_permiso: number, esSuperAdmin = true) {
    const rol = await prisma.rol.findUnique({ where: { id: id_rol } });
    if (!rol) throw new NotFoundError('Rol');
    assertRolEditablePorNoSA(rol, esSuperAdmin);

    const rolPermiso = await prisma.rolPermiso.findFirst({
      where: { id_rol, id_permiso },
    });
    if (!rolPermiso) throw new NotFoundError('Asignación de permiso');
    return prisma.rolPermiso.delete({ where: { id: rolPermiso.id } });
  },

  /** Reemplaza todos los permisos de un rol en una sola operación */
  async sincronizarPermisos(id_rol: number, ids_permisos: number[], esSuperAdmin = true) {
    const rol = await prisma.rol.findUnique({ where: { id: id_rol } });
    if (!rol) throw new NotFoundError('Rol');
    assertRolEditablePorNoSA(rol, esSuperAdmin);

    // Verificar que todos los permisos existen
    const permisos = await prisma.permiso.findMany({ where: { id: { in: ids_permisos } } });
    if (permisos.length !== ids_permisos.length)
      throw new BadRequestError('Uno o más permisos no existen');

    if (!esSuperAdmin && permisos.some(p => p.modulo === 'administracion')) {
      throw new ForbiddenError('Los permisos de administración solo los otorga el super administrador');
    }

    return prisma.$transaction(async (tx) => {
      await tx.rolPermiso.deleteMany({ where: { id_rol } });
      await tx.rolPermiso.createMany({
        data: ids_permisos.map(id_permiso => ({ id_rol, id_permiso })),
      });
      return tx.rol.findUnique({
        where: { id: id_rol },
        include: { permisos: { include: { permiso: true } } },
      });
    });
  },
};

/**
 * Un no-superadmin (admin de grupo con permisos.gestionar) solo puede editar
 * roles operativos: nunca el rol superadmin ni roles de sistema.
 */
function assertRolEditablePorNoSA(
  rol: { es_super_admin: boolean; es_sistema: boolean },
  esSuperAdmin: boolean
) {
  if (esSuperAdmin) return;
  if (rol.es_super_admin || rol.es_sistema) {
    throw new ForbiddenError('Este rol solo puede ser gestionado por el super administrador');
  }
}
