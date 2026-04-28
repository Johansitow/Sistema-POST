"use strict";
/**
 * UsuarioRepository - Queries Prisma para el módulo de usuarios
 *
 * Dos selectores principales:
 * - selectPublico: campos seguros para devolver al frontend (sin password_hash)
 * - findByCredencial: usa include completo porque necesita password_hash para bcrypt
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usuarioRepository = void 0;
const client_1 = require("@prisma/client");
const database_1 = __importDefault(require("../config/database"));
const pagination_1 = require("../lib/pagination");
const selectPublico = {
    id: true,
    uuid: true,
    nombre_completo: true,
    email: true,
    telefono: true,
    usuario: true,
    estado: true,
    ultimo_acceso: true,
    fecha_creacion: true,
    fecha_modificacion: true,
    rol: {
        select: {
            id: true,
            nombre: true,
            descripcion: true,
            color: true,
            es_super_admin: true,
        },
    },
    creador: {
        select: {
            id: true,
            nombre_completo: true,
            usuario: true,
        },
    },
};
exports.usuarioRepository = {
    findAll: (pagination, filters) => {
        const where = {};
        if (filters.search) {
            where.OR = [
                { nombre_completo: { contains: filters.search, mode: 'insensitive' } },
                { email: { contains: filters.search, mode: 'insensitive' } },
                { usuario: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
        if (filters.estado)
            where.estado = filters.estado;
        if (filters.id_rol)
            where.id_rol = filters.id_rol;
        return Promise.all([
            database_1.default.usuario.findMany({
                where,
                select: selectPublico,
                orderBy: { fecha_creacion: 'desc' },
                skip: (0, pagination_1.getSkip)(pagination),
                take: pagination.limit,
            }),
            database_1.default.usuario.count({ where }),
        ]);
    },
    findById: (id) => database_1.default.usuario.findUnique({ where: { id }, select: selectPublico }),
    findByCredencial: (credencial) => database_1.default.usuario.findFirst({
        where: {
            OR: [{ usuario: credencial }, { email: credencial }],
            estado: client_1.EstadoGeneral.activo,
        },
        include: {
            rol: {
                select: {
                    id: true,
                    nombre: true,
                    es_super_admin: true,
                    color: true,
                },
            },
        },
    }),
    findByEmail: (email, excludeId) => database_1.default.usuario.findFirst({
        where: {
            email,
            ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
    }),
    findByUsuario: (usuario) => database_1.default.usuario.findFirst({ where: { usuario } }),
    /**
     * findSuperAdminRol — devuelve el rol con es_super_admin = true si existe.
     * @param excludeRolId — excluye este rol de la búsqueda (útil en actualizarRol
     *   para no chocar el rol superadmin consigo mismo al editarlo).
     */
    findSuperAdminRol: (excludeRolId) => database_1.default.rol.findFirst({
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
    findUsuarioActivoConRol: (id_rol, excludeUsuarioId) => database_1.default.usuario.findFirst({
        where: {
            id_rol,
            estado: client_1.EstadoGeneral.activo,
            ...(excludeUsuarioId ? { NOT: { id: excludeUsuarioId } } : {}),
        },
        select: { id: true, usuario: true, nombre_completo: true },
    }),
    create: (data) => database_1.default.usuario.create({ data, select: selectPublico }),
    update: (id, data) => database_1.default.usuario.update({ where: { id }, data, select: selectPublico }),
    count: () => database_1.default.usuario.count(),
    countByEstado: (estado) => database_1.default.usuario.count({ where: { estado } }),
    findRoles: () => database_1.default.rol.findMany({
        where: { estado: client_1.EstadoGeneral.activo },
        select: {
            id: true,
            nombre: true,
            descripcion: true,
            color: true,
            es_super_admin: true,
            _count: { select: { usuarios: true } },
        },
        orderBy: { nombre: 'asc' },
    }),
    findRolById: (id) => database_1.default.rol.findUnique({ where: { id } }),
    /** createRol / updateRol — gestión de roles, llamados desde usuarioService */
    createRol: (data) => database_1.default.rol.create({ data }),
    updateRol: (id, data) => database_1.default.rol.update({ where: { id }, data }),
};
//# sourceMappingURL=usuario.repository.js.map