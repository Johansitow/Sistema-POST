/**
 * UsuarioService - Lógica de negocio para usuarios y roles
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PROTECCIÓN DEL SUPER ADMIN ÚNICO — dos capas de defensa
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Capa 1 — por UUID (identidad inmutable):
 *   protegerSuperAdmin() bloquea cualquier mutación sobre el usuario cuyo
 *   uuid coincide con SUPER_ADMIN_UUID del entorno. Esta protección funciona
 *   incluso si alguien altera la DB directamente y desactiva el flag.
 *
 * Capa 2 — por flag es_super_admin (del Usuario, no del Rol):
 *   protegerSuperAdmin() también bloquea si target.es_super_admin === true.
 *   Esto protege incluso si el SUPER_ADMIN_UUID no está configurado en el env.
 *
 * Puntos donde se aplica:
 *   • actualizar()     → nadie puede modificar datos del superadmin
 *   • cambiarEstado()  → no se puede desactivar/eliminar al superadmin
 *   • resetPassword()  → no se puede resetear su contraseña externamente
 *   • asignarRol()     → no se puede cambiar su rol
 *
 * Protección de roles (conservada del diseño anterior):
 *   • crearRol()       → no puede existir un segundo rol con es_super_admin=true
 *   • actualizarRol()  → no se puede desactivar ni alterar el rol superadmin
 *
 * Restricción adicional: nadie puede otorgarse es_super_admin via actualizar().
 */

import bcrypt from 'bcrypt';
import { EstadoGeneral, RolGrupo } from '@prisma/client';
import { usuarioRepository } from '../repositories/usuario.repository';
import { grupoNegocioRepository } from '../repositories/grupo-negocio.repository';
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from '../exceptions/HttpErrors';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { config } from '../config/env';

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

/** UUID del superadmin único — viene del entorno para ser inmutable */
const SUPER_ADMIN_UUID = config.superAdmin.uuid;

// ─── HELPER INTERNO ──────────────────────────────────────────────────────────

/**
 * protegerSuperAdmin — lanza ForbiddenError si el target es el superadmin.
 *
 * Dos condiciones para mayor robustez:
 *   1. UUID coincide con SUPER_ADMIN_UUID del entorno (identidad externa)
 *   2. El flag es_super_admin está activo en el registro del usuario (DB)
 *
 * Se usa en TODAS las operaciones de mutación de usuarios.
 * @param target — usuario que se intenta modificar (debe venir de findById)
 */
const protegerSuperAdmin = (target: { uuid: string; es_super_admin: boolean }) => {
  const esSuperAdminPorUuid  = target.uuid === SUPER_ADMIN_UUID;
  const esSuperAdminPorFlag  = target.es_super_admin === true;

  if (esSuperAdminPorUuid || esSuperAdminPorFlag) {
    throw new ForbiddenError(
      'El super administrador del sistema no puede ser modificado. ' +
      'Esta restricción es definitiva e irreversible.'
    );
  }
};

/**
 * assertUsuarioDelGrupo — anti-IDOR para admins de grupo.
 * Si hay scope de grupo (admin de grupo, no superadmin) y el usuario objetivo
 * no pertenece a ese grupo, responde NotFound (no revela su existencia).
 */
const assertUsuarioDelGrupo = async (idUsuario: number, grupoId?: number) => {
  if (!grupoId) return; // superadmin — sin scope
  const pertenece = await usuarioRepository.perteneceAGrupo(idUsuario, grupoId);
  if (!pertenece) throw new NotFoundError('Usuario');
};

// ─── SERVICE ─────────────────────────────────────────────────────────────────

export const usuarioService = {

  // ── USUARIOS ──────────────────────────────────────────────────────────────

  /**
   * @param grupoId — scope multi-tenant: presente cuando administra un admin
   *                  de grupo (req.grupoAdminId); undefined para superadmin.
   */
  async listar(params: {
    page?: unknown; limit?: unknown;
    search?: string; estado?: EstadoGeneral; id_rol?: number;
  }, grupoId?: number) {
    const pagination = getPaginationParams(params.page, params.limit);
    const [usuarios, total] = await usuarioRepository.findAll(pagination, {
      search:   params.search,
      estado:   params.estado,
      id_rol:   params.id_rol,
      id_grupo: grupoId,
    });
    return buildPaginatedResult(usuarios, total, pagination);
  },

  async obtenerPorId(id: number, grupoId?: number) {
    await assertUsuarioDelGrupo(id, grupoId);
    const usuario = await usuarioRepository.findById(id);
    if (!usuario) throw new NotFoundError('Usuario');
    return usuario;
  },

  async crear(
    data: {
      nombre_completo: string; email: string; usuario: string;
      password: string; telefono?: string; id_rol: number;
    },
    creadoPorId: number,
    grupoId?: number
  ) {
    const existeEmail = await usuarioRepository.findByEmail(data.email);
    if (existeEmail) throw new ConflictError('El email ya está registrado');

    const existeUsuario = await usuarioRepository.findByUsuario(data.usuario);
    if (existeUsuario) throw new ConflictError('El nombre de usuario ya está en uso');

    const rol = await usuarioRepository.findRolById(data.id_rol);
    if (!rol) throw new NotFoundError('Rol');

    // Nadie puede crear usuarios con es_super_admin (no está en el DTO por diseño)
    // es_super_admin solo se asigna en seed con UUID fijo

    // Un admin de grupo solo puede crear usuarios con roles operativos
    if (grupoId && rol.es_super_admin) {
      throw new ForbiddenError('No puedes asignar el rol de super administrador');
    }

    // Si el rol tiene es_super_admin (rol informativo), verificar que no haya
    // otro usuario activo con ese rol
    if (rol.es_super_admin) {
      const superAdminExistente = await usuarioRepository.findUsuarioActivoConRol(rol.id);
      if (superAdminExistente) {
        throw new ConflictError(
          `Ya existe un superadmin activo (${superAdminExistente.usuario}). ` +
          `Solo puede haber uno en el sistema.`
        );
      }
    }

    const password_hash = await bcrypt.hash(data.password, 10);
    const usuario = await usuarioRepository.create({
      nombre_completo: data.nombre_completo,
      email:           data.email,
      usuario:         data.usuario,
      password_hash,
      telefono:        data.telefono,
      id_rol:          data.id_rol,
      creado_por:      creadoPorId,
      // es_super_admin NO se puede asignar desde esta función (solo en seed)
    });

    // Un usuario creado por un admin de grupo nace como operador de SU grupo
    // (así queda dentro del scope y visible en su panel)
    if (grupoId) {
      await grupoNegocioRepository.upsertMiembro(usuario.id, grupoId, RolGrupo.operador);
    }

    return usuario;
  },

  async actualizar(
    id: number,
    data: Partial<{
      nombre_completo: string; email: string; telefono: string; id_rol: number;
      // Campos de empleado — fecha puede venir como string desde Zod o como Date
      documento_identidad:         string; fecha_nacimiento: string | Date;
      direccion: string; cargo: string; fecha_ingreso: string | Date;
      turno: string; tipo_contrato: string;
      contacto_emergencia_nombre:  string; contacto_emergencia_telefono: string;
      notas: string;
    }>,
    grupoId?: number
  ) {
    await assertUsuarioDelGrupo(id, grupoId);
    const target = await usuarioRepository.findById(id);
    if (!target) throw new NotFoundError('Usuario');

    // ── PROTECCIÓN: superadmin no puede ser modificado ────────────────────────
    protegerSuperAdmin(target as any);

    // Nadie puede asignarse es_super_admin a través de esta función
    if ('es_super_admin' in data) {
      throw new ForbiddenError('No se puede modificar el flag de super administrador');
    }

    if (data.email) {
      const existe = await usuarioRepository.findByEmail(data.email, id);
      if (existe) throw new ConflictError('El email ya está en uso por otro usuario');
    }

    if (data.id_rol) {
      const rol = await usuarioRepository.findRolById(data.id_rol);
      if (!rol) throw new NotFoundError('Rol');
      // Si se cambia el rol via actualizar(), redirige a asignarRol
      return this.asignarRol(id, data.id_rol, id, grupoId);
    }

    // Cast necesario: Zod puede enviar fechas como string; Prisma las convierte correctamente
    return usuarioRepository.update(id, data as any);
  },

  /**
   * cambiarEstado — no permite desactivar al superadmin.
   * @param solicitanteId — ID del usuario que hace la petición (de req.user)
   */
  async cambiarEstado(id: number, estado: EstadoGeneral, solicitanteId: number, grupoId?: number) {
    if (id === solicitanteId)
      throw new BadRequestError('No puedes cambiar tu propio estado');

    await assertUsuarioDelGrupo(id, grupoId);
    const usuario = await usuarioRepository.findById(id);
    if (!usuario) throw new NotFoundError('Usuario');

    // ── PROTECCIÓN: superadmin no puede ser desactivado/eliminado ─────────────
    if (estado !== EstadoGeneral.activo) {
      protegerSuperAdmin(usuario as any);
    }

    // Protección adicional: no dejar el sistema sin ningún superadmin activo
    if (estado !== EstadoGeneral.activo && (usuario as any).rol?.es_super_admin) {
      const otroSuperAdmin = await usuarioRepository.findUsuarioActivoConRol(
        (usuario as any).rol.id,
        id
      );
      if (!otroSuperAdmin) {
        throw new ForbiddenError(
          'No puedes desactivar al único superadmin activo del sistema.'
        );
      }
    }

    const actualizado = await usuarioRepository.update(id, { estado });
    return {
      message: `Usuario ${estado === 'activo' ? 'activado' : 'desactivado'} correctamente`,
      usuario: actualizado,
    };
  },

  /**
   * resetPassword — no permite resetear la contraseña del superadmin
   * desde el panel de administración.
   */
  async resetPassword(id: number, newPassword: string, grupoId?: number) {
    await assertUsuarioDelGrupo(id, grupoId);
    const target = await usuarioRepository.findById(id);
    if (!target) throw new NotFoundError('Usuario');

    // ── PROTECCIÓN: superadmin no puede ser alterado externamente ─────────────
    protegerSuperAdmin(target as any);

    if (newPassword.length < 8)
      throw new BadRequestError('La contraseña debe tener al menos 8 caracteres');

    const password_hash = await bcrypt.hash(newPassword, 10);
    await usuarioRepository.update(id, { password_hash });
    return { message: 'Contraseña reseteada correctamente' };
  },

  /**
   * asignarRol — no permite cambiar el rol del superadmin.
   * Valida además las dos direcciones del cambio de rol superadmin.
   * @param solicitanteId — ID del usuario que hace la petición
   */
  async asignarRol(id: number, id_rol: number, solicitanteId: number, grupoId?: number) {
    if (id === solicitanteId)
      throw new BadRequestError('No puedes cambiar tu propio rol');

    await assertUsuarioDelGrupo(id, grupoId);
    const usuario = await usuarioRepository.findById(id);
    if (!usuario) throw new NotFoundError('Usuario');

    // ── PROTECCIÓN: el rol del superadmin no puede cambiarse ─────────────────
    protegerSuperAdmin(usuario as any);

    const rolNuevo = await usuarioRepository.findRolById(id_rol);
    if (!rolNuevo) throw new NotFoundError('Rol');

    // Un admin de grupo solo puede asignar roles operativos
    if (grupoId && rolNuevo.es_super_admin) {
      throw new ForbiddenError('No puedes asignar el rol de super administrador');
    }

    // Sin cambio real — evitar operación innecesaria
    if ((usuario as any).rol.id === id_rol) {
      return { message: 'El usuario ya tiene ese rol', usuario };
    }

    // [ROL SUPERADMIN] Caso A: el rol nuevo tiene es_super_admin
    if (rolNuevo.es_super_admin) {
      const superAdminExistente = await usuarioRepository.findUsuarioActivoConRol(
        rolNuevo.id,
        id
      );
      if (superAdminExistente) {
        throw new ConflictError(
          `Ya existe un superadmin activo (${superAdminExistente.usuario}). ` +
          `Solo puede haber uno en el sistema.`
        );
      }
    }

    // [ROL SUPERADMIN] Caso B: el usuario tiene rol superadmin y se le quita
    if ((usuario as any).rol.es_super_admin && !rolNuevo.es_super_admin) {
      const otroSuperAdmin = await usuarioRepository.findUsuarioActivoConRol(
        (usuario as any).rol.id,
        id
      );
      if (!otroSuperAdmin) {
        throw new ForbiddenError(
          'No puedes quitarle el rol superadmin si no hay otro superadmin activo.'
        );
      }
    }

    const actualizado = await usuarioRepository.update(id, { id_rol } as any);
    return { message: `Rol "${rolNuevo.nombre}" asignado correctamente`, usuario: actualizado };
  },

  async listarRoles(grupoId?: number) {
    const roles = await usuarioRepository.findRoles();
    // Un admin de grupo no ve (ni puede asignar) el rol superadmin
    return grupoId ? roles.filter(r => !r.es_super_admin) : roles;
  },

  async estadisticas(grupoId?: number) {
    const [total, activos, inactivos] = await Promise.all([
      usuarioRepository.count(grupoId),
      usuarioRepository.countByEstado(EstadoGeneral.activo, grupoId),
      usuarioRepository.countByEstado(EstadoGeneral.inactivo, grupoId),
    ]);
    return { total, activos, inactivos };
  },

  async getNomina(id: number, grupoId?: number) {
    await this.obtenerPorId(id, grupoId);
    return usuarioRepository.findNomina(id);
  },

  async upsertNomina(id: number, grupoId: number | undefined, data: {
    salario_base:   number;
    tipo_pago:      string;
    banco?:         string;
    tipo_cuenta?:   string;
    numero_cuenta?: string;
    observaciones?: string;
  }) {
    await this.obtenerPorId(id, grupoId);
    return usuarioRepository.upsertNomina(id, data);
  },

  // ── PERMISOS DIRECTOS (UsuarioPermiso) — solo superadmin ──────────────────
  // El SA decide, admin por admin, qué módulos del panel de administración
  // puede usar cada dueño de grupo. Se reflejan en el JWT al refresh/re-login.

  async listarAdminsDeGrupo() {
    return usuarioRepository.findAdminsDeGrupo();
  },

  async listarPermisosDirectos(id: number) {
    await this.obtenerPorId(id); // 404 si no existe
    const asignaciones = await usuarioRepository.findPermisosDirectos(id);
    return asignaciones.map(a => a.permiso);
  },

  async sincronizarPermisosDirectos(id: number, ids_permisos: number[]) {
    const target = await usuarioRepository.findById(id);
    if (!target) throw new NotFoundError('Usuario');
    // El superadmin no necesita permisos (bypasa todo) — evitar asignaciones sin sentido
    protegerSuperAdmin(target as any);

    const permisos = await usuarioRepository.findPermisosByIds(ids_permisos);
    if (permisos.length !== ids_permisos.length)
      throw new BadRequestError('Uno o más permisos no existen');

    const asignaciones = await usuarioRepository.syncPermisosDirectos(id, ids_permisos);
    return asignaciones.map(a => a.permiso);
  },

  // ── ROLES ─────────────────────────────────────────────────────────────────

  /**
   * crearRol — garantiza que no se cree un segundo rol con es_super_admin=true.
   */
  async crearRol(data: {
    nombre:         string;
    descripcion?:   string;
    es_super_admin: boolean;
    color?:         string;
  }) {
    if (data.es_super_admin) {
      const existente = await usuarioRepository.findSuperAdminRol();
      if (existente) {
        throw new ConflictError(
          `Ya existe el rol superadmin "${existente.nombre}". ` +
          `Solo puede haber uno en el sistema.`
        );
      }
    }
    return usuarioRepository.createRol(data);
  },

  /**
   * actualizarRol — tres guards de superadmin:
   * 1. No crear un segundo rol con es_super_admin
   * 2. No quitar es_super_admin al único rol superadmin
   * 3. No desactivar el rol superadmin
   */
  async actualizarRol(id: number, data: Partial<{
    nombre:         string;
    descripcion:    string;
    es_super_admin: boolean;
    color:          string;
    estado:         EstadoGeneral;
  }>) {
    const rol = await usuarioRepository.findRolById(id);
    if (!rol) throw new NotFoundError('Rol');

    // Guard 1: intentar convertir otro rol en superadmin
    if (data.es_super_admin === true && !rol.es_super_admin) {
      const existente = await usuarioRepository.findSuperAdminRol(id);
      if (existente) {
        throw new ConflictError(
          `Ya existe el rol superadmin "${existente.nombre}". ` +
          `Solo puede haber uno en el sistema.`
        );
      }
    }

    // Guard 2: quitar flag superadmin al único rol superadmin
    if (data.es_super_admin === false && rol.es_super_admin) {
      throw new ForbiddenError(
        'No puedes quitar el flag superadmin al único rol superadmin del sistema.'
      );
    }

    // Guard 3: desactivar el rol superadmin
    if (data.estado && data.estado !== EstadoGeneral.activo && rol.es_super_admin) {
      throw new ForbiddenError('No se puede desactivar el rol superadmin.');
    }

    return usuarioRepository.updateRol(id, data);
  },
};
