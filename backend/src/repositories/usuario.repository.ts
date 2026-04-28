/**
 * UsuarioRepository - Queries Prisma para el módulo de usuarios
 *
 * Dos selectores principales:
 * - selectPublico: campos seguros para devolver al frontend (sin password_hash)
 * - findByCredencial: usa include completo porque necesita password_hash para bcrypt
 */

import { EstadoGeneral } from '@prisma/client';
import prisma from '../config/database';
import { PaginationParams, getSkip } from '../lib/pagination';

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
  documento_identidad:          true,
  fecha_nacimiento:             true,
  direccion:                    true,
  // Datos laborales
  cargo:                        true,
  fecha_ingreso:                true,
  turno:                        true,
  tipo_contrato:                true,
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
};

export const usuarioRepository = {

  findAll: (
    pagination: PaginationParams,
    filters: { search?: string; estado?: EstadoGeneral; id_rol?: number }
  ) => {
    // Por defecto excluye eliminados; se sobreescribe si se pasa un estado específico
    const where: any = { estado: { not: EstadoGeneral.eliminado } };

    if (filters.search) {
      where.OR = [
        { nombre_completo: { contains: filters.search, mode: 'insensitive' } },
        { email:           { contains: filters.search, mode: 'insensitive' } },
        { usuario:         { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.estado) where.estado = filters.estado;
    if (filters.id_rol) where.id_rol = filters.id_rol;

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

  create: (data: {
    nombre_completo: string;
    email:           string;
    usuario:         string;
    password_hash:   string;
    telefono?:       string;
    id_rol:          number;
    creado_por?:     number;
  }) => prisma.usuario.create({ data, select: selectPublico }),

  update: (id: number, data: Partial<{
    nombre_completo: string;
    email:           string;
    telefono:        string;
    id_rol:          number;
    estado:          EstadoGeneral;
    password_hash:   string;
    ultimo_acceso:   Date;
    // Empleado
    documento_identidad:          string;
    fecha_nacimiento:              Date;
    direccion:                     string;
    cargo:                         string;
    fecha_ingreso:                 Date;
    turno:                         string;
    tipo_contrato:                 string;
    contacto_emergencia_nombre:    string;
    contacto_emergencia_telefono:  string;
    notas:                         string;
  }>) => prisma.usuario.update({ where: { id }, data, select: selectPublico }),

  // ── Nómina ─────────────────────────────────────────────────────────────────

  findNomina: (id_usuario: number) =>
    prisma.nominaEmpleado.findUnique({ where: { id_usuario } }),

  upsertNomina: (id_usuario: number, data: {
    salario_base:   number;
    tipo_pago:      string;
    banco?:         string;
    tipo_cuenta?:   string;
    numero_cuenta?: string;
    observaciones?: string;
  }) =>
    prisma.nominaEmpleado.upsert({
      where:  { id_usuario },
      update: data,
      create: { id_usuario, ...data },
    }),

  count:         ()                      => prisma.usuario.count(),
  countByEstado: (estado: EstadoGeneral) => prisma.usuario.count({ where: { estado } }),

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