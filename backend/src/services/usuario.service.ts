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
import { EstadoGeneral, EstadoLaboral, RolGrupo } from '@prisma/client';
import { usuarioRepository, type EmpleadoFields } from '../repositories/usuario.repository';
import { grupoNegocioRepository } from '../repositories/grupo-negocio.repository';
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from '../exceptions/HttpErrors';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { config } from '../config/env';
import prisma from '../config/database';

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

// ─── EMPLEADO — normalización y código consecutivo ───────────────────────────

/** Prefijo del código de empleado. EMP-0001, EMP-0002, … */
const CODIGO_EMPLEADO_PREFIJO = 'EMP-';
const CODIGO_EMPLEADO_PADDING = 4;

/**
 * Datos de empleado tal como llegan del DTO: las fechas son strings ISO.
 * Se convierten a Date antes de tocar Prisma.
 */
export type EmpleadoInput = Partial<
  Omit<EmpleadoFields, 'fecha_nacimiento' | 'fecha_ingreso' | 'fecha_retiro' | 'codigo_empleado'>
> & {
  fecha_nacimiento?: string | Date | null;
  fecha_ingreso?:    string | Date | null;
  fecha_retiro?:     string | Date | null;
};

const aFecha = (v: string | Date | null | undefined): Date | null | undefined => {
  if (v === undefined) return undefined;   // no enviado → no tocar
  if (v === null || v === '') return null; // enviado vacío → limpiar
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) throw new BadRequestError('Fecha inválida');
  return d;
};

/**
 * normalizarEmpleado — convierte el input del DTO en datos aptos para Prisma.
 * Solo incluye las claves realmente enviadas, para no sobreescribir con
 * undefined campos que el cliente no quiso tocar.
 */
const normalizarEmpleado = (data: EmpleadoInput) => {
  const { fecha_nacimiento, fecha_ingreso, fecha_retiro, ...resto } = data;
  const out: Record<string, unknown> = { ...resto };

  if ('fecha_nacimiento' in data) out.fecha_nacimiento = aFecha(fecha_nacimiento);
  if ('fecha_ingreso'    in data) out.fecha_ingreso    = aFecha(fecha_ingreso);
  if ('fecha_retiro'     in data) out.fecha_retiro     = aFecha(fecha_retiro);

  return out;
};

/**
 * assertCoherenciaRetiro — un empleado retirado necesita fecha de retiro, y
 * una fecha de retiro sin estado retirado es un dato inconsistente. Se valida
 * sobre el resultado de fusionar lo que ya está en base con lo que llega.
 */
const assertCoherenciaRetiro = (
  estadoLaboral: EstadoLaboral | null | undefined,
  fechaRetiro:   Date | null | undefined,
) => {
  if (estadoLaboral === EstadoLaboral.retirado && !fechaRetiro) {
    throw new BadRequestError('Un empleado retirado requiere fecha de retiro');
  }
  if (fechaRetiro && estadoLaboral !== EstadoLaboral.retirado) {
    throw new BadRequestError(
      'La fecha de retiro solo aplica a empleados con estado laboral "retirado"'
    );
  }
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

  /**
   * generarCodigoEmpleado — siguiente consecutivo EMP-#### del grupo.
   *
   * Se comparan los códigos NUMÉRICAMENTE (no por orden lexicográfico, que
   * pondría EMP-10000 antes que EMP-9999). Se ignoran los códigos con formato
   * distinto para no romper si alguien cargó uno manual.
   *
   * Nota: el código es un identificador de presentación, no una clave de
   * negocio, y Usuario no tiene columna id_grupo sobre la que poner un UNIQUE
   * compuesto. Por eso la unicidad se resuelve aquí, dentro de la transacción
   * de creación, en lugar de con una restricción de base de datos.
   */
  async generarCodigoEmpleado(grupoId?: number, tx?: Parameters<typeof usuarioRepository.findCodigosEmpleado>[1]) {
    const existentes = await usuarioRepository.findCodigosEmpleado(grupoId, tx);
    const maximo = existentes.reduce((max, { codigo_empleado }) => {
      const m = codigo_empleado?.match(/^EMP-(\d+)$/);
      if (!m) return max;
      return Math.max(max, parseInt(m[1], 10));
    }, 0);
    return `${CODIGO_EMPLEADO_PREFIJO}${String(maximo + 1).padStart(CODIGO_EMPLEADO_PADDING, '0')}`;
  },

  async crear(
    data: {
      nombre_completo: string; email: string; usuario: string;
      password: string; telefono?: string; id_rol: number;
    } & EmpleadoInput,
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

    // Los campos de empleado viajan en el mismo DTO que los de cuenta.
    // Antes se descartaban aquí y solo se guardaban al editar: los datos que
    // el administrador llenaba en el formulario de alta se perdían.
    const {
      nombre_completo, email, usuario: nombreUsuario, password, telefono, id_rol,
      ...empleado
    } = data;

    const empleadoData = normalizarEmpleado(empleado);
    assertCoherenciaRetiro(
      empleadoData.estado_laboral as EstadoLaboral | undefined,
      empleadoData.fecha_retiro   as Date | null | undefined,
    );

    // Código consecutivo + creación + membresía de grupo en una sola
    // transacción: si algo falla no queda un código "quemado" ni un usuario
    // sin grupo.
    const usuario = await prisma.$transaction(async (tx) => {
      const codigo_empleado = await this.generarCodigoEmpleado(grupoId, tx);

      const creado = await usuarioRepository.create({
        nombre_completo,
        email,
        usuario:    nombreUsuario,
        password_hash,
        telefono,
        id_rol,
        creado_por: creadoPorId,
        codigo_empleado,
        ...empleadoData,
        // es_super_admin NO se puede asignar desde esta función (solo en seed)
      }, tx);

      // Un usuario creado por un admin de grupo nace como operador de SU grupo
      // (así queda dentro del scope y visible en su panel)
      if (grupoId) {
        await grupoNegocioRepository.upsertMiembro(creado.id, grupoId, RolGrupo.operador, tx);
      }

      return creado;
    });

    return usuario;
  },

  async actualizar(
    id: number,
    data: Partial<{
      nombre_completo: string; email: string; telefono: string; id_rol: number;
    }> & EmpleadoInput,
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

    const { nombre_completo, email, telefono, id_rol, ...empleado } = data;
    const empleadoData = normalizarEmpleado(empleado);

    // La coherencia se valida sobre el ESTADO RESULTANTE (lo que ya hay en
    // base fusionado con lo que llega), no solo sobre el payload: marcar a
    // alguien como retirado sin enviar fecha debe fallar aunque la fecha no
    // venga en esta petición.
    assertCoherenciaRetiro(
      ('estado_laboral' in empleadoData
        ? empleadoData.estado_laboral
        : target.estado_laboral) as EstadoLaboral | undefined,
      ('fecha_retiro' in empleadoData
        ? empleadoData.fecha_retiro
        : target.fecha_retiro) as Date | null | undefined,
    );

    return usuarioRepository.update(id, {
      ...(nombre_completo !== undefined && { nombre_completo }),
      ...(email           !== undefined && { email }),
      ...(telefono        !== undefined && { telefono }),
      ...empleadoData,
    });
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

  /**
   * upsertNomina — guarda el salario VIGENTE y deja rastro del cambio.
   *
   * NominaEmpleado tiene una sola fila por empleado, así que sobreescribir el
   * salario borraba el valor anterior sin dejar evidencia. Aquí cada cambio
   * (y el alta inicial) escribe además una fila en HistorialSalario dentro de
   * la misma transacción: sin ese histórico no se puede liquidar un periodo
   * pasado ni sustentar una liquidación definitiva.
   *
   * Si el salario y la frecuencia no cambian, no se registra historial: evita
   * llenar la tabla de ruido al editar solo el banco o las observaciones.
   */
  async upsertNomina(id: number, grupoId: number | undefined, data: {
    salario_base:   number;
    tipo_pago:      string;
    banco?:         string;
    tipo_cuenta?:   string;
    numero_cuenta?: string;
    observaciones?: string;
    vigencia_desde?: string | Date;
    motivo?:        string;
  }, registradoPorId?: number) {
    await this.obtenerPorId(id, grupoId);

    const { vigencia_desde, motivo, ...nominaData } = data;

    return prisma.$transaction(async (tx) => {
      const anterior = await usuarioRepository.findNomina(id, tx);
      const nomina   = await usuarioRepository.upsertNomina(id, nominaData, tx);

      const salarioAnterior = anterior ? Number(anterior.salario_base) : null;
      const huboCambio =
        salarioAnterior === null ||
        salarioAnterior !== nominaData.salario_base ||
        anterior?.tipo_pago !== nominaData.tipo_pago;

      if (huboCambio) {
        await usuarioRepository.createHistorialSalario({
          id_usuario:        id,
          salario_anterior:  salarioAnterior,
          salario_nuevo:     nominaData.salario_base,
          tipo_pago:         nominaData.tipo_pago,
          vigencia_desde:    aFecha(vigencia_desde) ?? new Date(),
          motivo:            motivo ?? (anterior ? 'Cambio de salario' : 'Salario inicial'),
          id_registrado_por: registradoPorId,
        }, tx);
      }

      return nomina;
    });
  },

  async listarHistorialSalarios(id: number, grupoId?: number) {
    await this.obtenerPorId(id, grupoId);
    return usuarioRepository.findHistorialSalarios(id);
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
