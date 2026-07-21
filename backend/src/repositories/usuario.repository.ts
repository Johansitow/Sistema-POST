/**
 * UsuarioRepository - Queries Prisma para el módulo de usuarios
 *
 * Dos selectores principales:
 * - selectPublico: campos seguros para devolver al frontend (sin password_hash)
 * - findByCredencial: usa include completo porque necesita password_hash para bcrypt
 */

import { EstadoGeneral, EstadoLaboral, TipoDocumento, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { PaginationParams, getSkip } from '../lib/pagination';

/**
 * Cliente Prisma o cliente transaccional. Permite que create/update/nómina
 * participen de una $transaction sin duplicar los métodos del repositorio.
 */
type PrismaTx = Prisma.TransactionClient | typeof prisma;

/**
 * Campos de EMPLEADO — fuente única de verdad, compartida por create y update.
 * Las fechas se aceptan como Date (el service normaliza los strings del DTO).
 */
export interface EmpleadoFields {
  // Personales
  tipo_documento:                TipoDocumento | null;
  documento_identidad:           string | null;
  fecha_nacimiento:              Date | null;
  direccion:                     string | null;
  foto_url:                      string | null;
  // Identidad y datos laborales
  codigo_empleado:               string | null;
  cargo:                         string | null;
  fecha_ingreso:                 Date | null;
  turno:                         string | null;
  tipo_contrato:                 string | null;
  jornada:                       string | null;
  estado_laboral:                EstadoLaboral;
  fecha_retiro:                  Date | null;
  motivo_retiro:                 string | null;
  id_restaurante_base:           number | null;
  id_jefe_directo:               number | null;
  // Seguridad social
  eps:                           string | null;
  afp:                           string | null;
  arl:                           string | null;
  nivel_riesgo_arl:              string | null;
  fondo_cesantias:               string | null;
  caja_compensacion:             string | null;
  // Contacto de emergencia
  contacto_emergencia_nombre:    string | null;
  contacto_emergencia_telefono:  string | null;
  // Notas internas
  notas:                         string | null;
}

export type UsuarioCreateData = {
  nombre_completo: string;
  email:           string;
  usuario:         string;
  password_hash:   string;
  telefono?:       string;
  id_rol:          number;
  creado_por?:     number;
} & Partial<EmpleadoFields>;

export type UsuarioUpdateData = Partial<{
  nombre_completo: string;
  email:           string;
  telefono:        string;
  id_rol:          number;
  estado:          EstadoGeneral;
  password_hash:   string;
  ultimo_acceso:   Date;
} & EmpleadoFields>;

const selectPublico = {
  id:                 true,
  uuid:               true,
  nombre_completo:    true,
  email:              true,
  telefono:           true,
  usuario:            true,
  estado:             true,
  ultimo_acceso:      true,
  fecha_creacion:     true,
  fecha_modificacion: true,
  // Flag de identidad del superadmin único del sistema
  es_super_admin:     true,
  // Datos personales del empleado
  tipo_documento:               true,
  documento_identidad:          true,
  fecha_nacimiento:             true,
  direccion:                    true,
  foto_url:                     true,
  // Identidad laboral
  codigo_empleado:              true,
  // Datos laborales
  cargo:                        true,
  fecha_ingreso:                true,
  turno:                        true,
  tipo_contrato:                true,
  jornada:                      true,
  estado_laboral:               true,
  fecha_retiro:                 true,
  motivo_retiro:                true,
  id_restaurante_base:          true,
  id_jefe_directo:              true,
  // Seguridad social
  eps:                          true,
  afp:                          true,
  arl:                          true,
  nivel_riesgo_arl:             true,
  fondo_cesantias:              true,
  caja_compensacion:            true,
  // Contacto de emergencia
  contacto_emergencia_nombre:   true,
  contacto_emergencia_telefono: true,
  // Notas
  notas:                        true,
  rol: {
    select: {
      id:             true,
      nombre:         true,
      descripcion:    true,
      color:          true,
      es_super_admin: true,
    },
  },
  creador: {
    select: {
      id:              true,
      nombre_completo: true,
      usuario:         true,
    },
  },
  jefe_directo: {
    select: {
      id:              true,
      nombre_completo: true,
      cargo:           true,
    },
  },
  restaurante_base: {
    select: {
      id:       true,
      nombre:   true,
      id_grupo: true,
    },
  },
};

/**
 * Fragmento where: el usuario pertenece al grupo, sea por membresía directa
 * (UsuarioGrupo) o por acceso a alguna sede del grupo (UsuarioRestaurante).
 * Usado para acotar todo el módulo de usuarios cuando administra un admin de grupo.
 */
const perteneceAGrupoWhere = (id_grupo: number) => ({
  OR: [
    { grupos:       { some: { id_grupo } } },
    { restaurantes: { some: { restaurante: { id_grupo } } } },
  ],
});

export const usuarioRepository = {

  findAll: (
    pagination: PaginationParams,
    filters: { search?: string; estado?: EstadoGeneral; id_rol?: number; id_grupo?: number }
  ) => {
    // Por defecto excluye eliminados; se sobreescribe si se pasa un estado específico
    const where: any = { estado: { not: EstadoGeneral.eliminado }, AND: [] as any[] };

    if (filters.search) {
      where.AND.push({
        OR: [
          { nombre_completo: { contains: filters.search, mode: 'insensitive' } },
          { email:           { contains: filters.search, mode: 'insensitive' } },
          { usuario:         { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }
    if (filters.estado)   where.estado = filters.estado;
    if (filters.id_rol)   where.id_rol = filters.id_rol;
    // Scope multi-tenant: admin de grupo solo ve usuarios de su grupo
    if (filters.id_grupo) where.AND.push(perteneceAGrupoWhere(filters.id_grupo));

    return Promise.all([
      prisma.usuario.findMany({
        where,
        select:  selectPublico,
        orderBy: { fecha_creacion: 'desc' },
        skip:    getSkip(pagination),
        take:    pagination.limit,
      }),
      prisma.usuario.count({ where }),
    ]);
  },

  /** ¿El usuario pertenece al grupo? (membresía o acceso a alguna sede) */
  perteneceAGrupo: (id: number, id_grupo: number) =>
    prisma.usuario.findFirst({
      where:  { id, ...perteneceAGrupoWhere(id_grupo) },
      select: { id: true },
    }),

  // ── Permisos directos (UsuarioPermiso) — otorgados por el superadmin ────────

  findPermisosDirectos: (id_usuario: number) =>
    prisma.usuarioPermiso.findMany({
      where:   { id_usuario },
      include: { permiso: true },
      orderBy: { permiso: { nombre: 'asc' } },
    }),

  /** Reemplaza todos los permisos directos del usuario en una sola operación */
  syncPermisosDirectos: (id_usuario: number, ids_permisos: number[]) =>
    prisma.$transaction(async (tx) => {
      await tx.usuarioPermiso.deleteMany({ where: { id_usuario } });
      if (ids_permisos.length > 0) {
        await tx.usuarioPermiso.createMany({
          data: ids_permisos.map(id_permiso => ({ id_usuario, id_permiso })),
        });
      }
      return tx.usuarioPermiso.findMany({
        where:   { id_usuario },
        include: { permiso: true },
      });
    }),

  findPermisosByIds: (ids: number[]) =>
    prisma.permiso.findMany({ where: { id: { in: ids } } }),

  /** Usuarios que son owner/admin de algún grupo (candidatos a permisos admin) */
  findAdminsDeGrupo: () =>
    prisma.usuario.findMany({
      where: {
        estado: { not: EstadoGeneral.eliminado },
        grupos: { some: { es_activo: true, rol_en_grupo: { in: ['owner', 'admin'] } } },
      },
      select: {
        id: true, uuid: true, nombre_completo: true, email: true, usuario: true, estado: true,
        grupos: {
          where:  { es_activo: true, rol_en_grupo: { in: ['owner', 'admin'] } },
          select: { id_grupo: true, rol_en_grupo: true, grupo: { select: { nombre: true } } },
        },
      },
      orderBy: { nombre_completo: 'asc' },
    }),

  findById: (id: number) =>
    prisma.usuario.findFirst({
      where: { id, estado: { not: EstadoGeneral.eliminado } },
      select: selectPublico,
    }),

  findByCredencial: (credencial: string) =>
    prisma.usuario.findFirst({
      where: {
        OR: [{ usuario: credencial }, { email: credencial }],
        estado: EstadoGeneral.activo,
      },
      // Se usa `include` (no `select`) para obtener password_hash + relaciones
      include: {
        rol: {
          select: {
            id:             true,
            nombre:         true,
            es_super_admin: true, // campo informativo del rol
            color:          true,
            permisos: {
              select: {
                permiso: { select: { codigo: true } },
              },
            },
          },
        },
        restaurantes: {
          where: { es_activo: true },
          include: {
            restaurante: {
              select: { id: true, nombre: true, es_default: true, activo: true, id_grupo: true },
            },
          },
        },
        // Permisos directos por usuario (UsuarioPermiso) — se unen a los del rol
        permisos_directos: {
          select: { permiso: { select: { codigo: true } } },
        },
        // Membresías owner/admin de grupo — claim grupos_admin del JWT
        grupos: {
          where: { es_activo: true, rol_en_grupo: { in: ['owner', 'admin'] } },
          select: { id_grupo: true, rol_en_grupo: true },
        },
      },
      // Nota: `include` devuelve todos los campos del usuario (incluyendo
      // es_super_admin y password_hash). buildPayload usa es_super_admin
      // directamente del usuario, no del rol.
    }),

  findByEmail: (email: string, excludeId?: number) =>
    prisma.usuario.findFirst({
      where: {
        email,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    }),

  findByUsuario: (usuario: string) =>
    prisma.usuario.findFirst({ where: { usuario } }),

  /**
   * findSuperAdminRol — devuelve el rol con es_super_admin = true si existe.
   * @param excludeRolId — excluye este rol de la búsqueda (útil en actualizarRol
   *   para no chocar el rol superadmin consigo mismo al editarlo).
   */
  findSuperAdminRol: (excludeRolId?: number) =>
    prisma.rol.findFirst({
      where: {
        es_super_admin: true,
        ...(excludeRolId ? { NOT: { id: excludeRolId } } : {}),
      },
    }),

  /**
   * findUsuarioActivoConRol — busca el primer usuario activo con el rol dado,
   * opcionalmente excluyendo un usuario específico.
   * Usado para verificar que no quede el sistema sin superadmin.
   */
  findUsuarioActivoConRol: (id_rol: number, excludeUsuarioId?: number) =>
    prisma.usuario.findFirst({
      where: {
        id_rol,
        estado: EstadoGeneral.activo,
        ...(excludeUsuarioId ? { NOT: { id: excludeUsuarioId } } : {}),
      },
      select: { id: true, usuario: true, nombre_completo: true },
    }),

  /** El parámetro `tx` permite participar de una $transaction del service. */
  create: (data: UsuarioCreateData, tx: PrismaTx = prisma) =>
    tx.usuario.create({ data, select: selectPublico }),

  update: (id: number, data: UsuarioUpdateData, tx: PrismaTx = prisma) =>
    tx.usuario.update({ where: { id }, data, select: selectPublico }),

  // ── Código de empleado — consecutivo por grupo ─────────────────────────────

  /**
   * Devuelve los códigos de empleado ya usados en el scope indicado.
   * Se comparan numéricamente en el service (no se ordena en SQL) porque el
   * orden lexicográfico rompería al pasar de EMP-9999 a EMP-10000.
   */
  findCodigosEmpleado: (id_grupo?: number, tx: PrismaTx = prisma) =>
    tx.usuario.findMany({
      where: {
        codigo_empleado: { not: null },
        ...(id_grupo ? perteneceAGrupoWhere(id_grupo) : {}),
      },
      select: { codigo_empleado: true },
    }),

  // ── Historial salarial ─────────────────────────────────────────────────────

  findHistorialSalarios: (id_usuario: number) =>
    prisma.historialSalario.findMany({
      where:   { id_usuario },
      orderBy: { vigencia_desde: 'desc' },
      include: {
        registrado_por: { select: { id: true, nombre_completo: true } },
      },
    }),

  createHistorialSalario: (data: {
    id_usuario:        number;
    salario_anterior?: Prisma.Decimal | number | null;
    salario_nuevo:     Prisma.Decimal | number;
    tipo_pago:         string;
    vigencia_desde:    Date;
    motivo?:           string;
    id_registrado_por?: number;
  }, tx: PrismaTx = prisma) => tx.historialSalario.create({ data }),

  // ── Nómina ─────────────────────────────────────────────────────────────────

  findNomina: (id_usuario: number, tx: PrismaTx = prisma) =>
    tx.nominaEmpleado.findUnique({ where: { id_usuario } }),

  upsertNomina: (id_usuario: number, data: {
    salario_base:   number;
    tipo_pago:      string;
    banco?:         string;
    tipo_cuenta?:   string;
    numero_cuenta?: string;
    observaciones?: string;
  }, tx: PrismaTx = prisma) =>
    tx.nominaEmpleado.upsert({
      where:  { id_usuario },
      update: data,
      create: { id_usuario, ...data },
    }),

  count: (id_grupo?: number) =>
    prisma.usuario.count({ where: id_grupo ? perteneceAGrupoWhere(id_grupo) : undefined }),
  countByEstado: (estado: EstadoGeneral, id_grupo?: number) =>
    prisma.usuario.count({ where: { estado, ...(id_grupo ? perteneceAGrupoWhere(id_grupo) : {}) } }),

  findRoles: () =>
    prisma.rol.findMany({
      where:   { estado: EstadoGeneral.activo as any },
      select: {
        id:             true,
        nombre:         true,
        descripcion:    true,
        color:          true,
        es_super_admin: true,
        _count: { select: { usuarios: true } },
      },
      orderBy: { nombre: 'asc' },
    }),

  findRolById: (id: number) =>
    prisma.rol.findUnique({ where: { id } }),

  /** createRol / updateRol — gestión de roles, llamados desde usuarioService */
  createRol: (data: {
    nombre:         string;
    descripcion?:   string;
    es_super_admin: boolean;
    color?:         string;
  }) => prisma.rol.create({ data }),

  updateRol: (id: number, data: Partial<{
    nombre:         string;
    descripcion:    string;
    es_super_admin: boolean;
    color:          string;
    estado:         EstadoGeneral;
  }>) => prisma.rol.update({ where: { id }, data }),
};