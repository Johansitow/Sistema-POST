"use strict";
/**
 * UsuarioService - Lógica de negocio para usuarios y roles
 *
 * Restricción de superadmin único — se aplica en 4 puntos:
 *
 * 1. crear()        → si el rol asignado es superadmin, verifica que no haya
 *                     otro usuario activo con ese rol
 * 2. cambiarEstado() → no se puede desactivar al único usuario superadmin activo
 * 3. asignarRol()   → valida en ambas direcciones:
 *                     - si el rol nuevo es superadmin: no puede haber otro
 *                     - si se le quita el rol superadmin: debe quedar otro activo
 * 4. crearRol() /
 *    actualizarRol() → solo puede existir 1 rol con es_super_admin = true
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usuarioService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
const usuario_repository_1 = require("../repositories/usuario.repository");
const HttpErrors_1 = require("../exceptions/HttpErrors");
const pagination_1 = require("../lib/pagination");
exports.usuarioService = {
    // ── USUARIOS ──────────────────────────────────────────────────────────────
    async listar(params) {
        const pagination = (0, pagination_1.getPaginationParams)(params.page, params.limit);
        const [usuarios, total] = await usuario_repository_1.usuarioRepository.findAll(pagination, {
            search: params.search,
            estado: params.estado,
            id_rol: params.id_rol,
        });
        return (0, pagination_1.buildPaginatedResult)(usuarios, total, pagination);
    },
    async obtenerPorId(id) {
        const usuario = await usuario_repository_1.usuarioRepository.findById(id);
        if (!usuario)
            throw new HttpErrors_1.NotFoundError('Usuario');
        return usuario;
    },
    async crear(data, creadoPorId) {
        const existeEmail = await usuario_repository_1.usuarioRepository.findByEmail(data.email);
        if (existeEmail)
            throw new HttpErrors_1.ConflictError('El email ya está registrado');
        const existeUsuario = await usuario_repository_1.usuarioRepository.findByUsuario(data.usuario);
        if (existeUsuario)
            throw new HttpErrors_1.ConflictError('El nombre de usuario ya está en uso');
        const rol = await usuario_repository_1.usuarioRepository.findRolById(data.id_rol);
        if (!rol)
            throw new HttpErrors_1.NotFoundError('Rol');
        // [SUPERADMIN] Si el rol asignado es superadmin, no puede existir otro usuario activo con él
        if (rol.es_super_admin) {
            const superAdminExistente = await usuario_repository_1.usuarioRepository.findUsuarioActivoConRol(rol.id);
            if (superAdminExistente) {
                throw new HttpErrors_1.ConflictError(`Ya existe un superadmin activo (${superAdminExistente.usuario}). ` +
                    `Solo puede haber uno en el sistema.`);
            }
        }
        const password_hash = await bcrypt_1.default.hash(data.password, 10);
        return usuario_repository_1.usuarioRepository.create({
            nombre_completo: data.nombre_completo,
            email: data.email,
            usuario: data.usuario,
            password_hash,
            telefono: data.telefono,
            id_rol: data.id_rol,
            creado_por: creadoPorId,
        });
    },
    async actualizar(id, data) {
        await this.obtenerPorId(id);
        if (data.email) {
            const existe = await usuario_repository_1.usuarioRepository.findByEmail(data.email, id);
            if (existe)
                throw new HttpErrors_1.ConflictError('El email ya está en uso por otro usuario');
        }
        if (data.id_rol) {
            const rol = await usuario_repository_1.usuarioRepository.findRolById(data.id_rol);
            if (!rol)
                throw new HttpErrors_1.NotFoundError('Rol');
            // Si se cambia el rol via actualizar(), redirige a la lógica de asignarRol
            // para que se apliquen todas las validaciones de superadmin
            return this.asignarRol(id, data.id_rol, id); // solicitanteId != id, ver nota abajo
        }
        return usuario_repository_1.usuarioRepository.update(id, data);
    },
    /**
     * cambiarEstado — no permite desactivar al único superadmin activo.
     * @param solicitanteId — ID del usuario que hace la petición (de req.user)
     */
    async cambiarEstado(id, estado, solicitanteId) {
        if (id === solicitanteId)
            throw new HttpErrors_1.BadRequestError('No puedes cambiar tu propio estado');
        const usuario = await usuario_repository_1.usuarioRepository.findById(id);
        if (!usuario)
            throw new HttpErrors_1.NotFoundError('Usuario');
        // [SUPERADMIN] No se puede desactivar al único superadmin activo
        if (estado !== client_1.EstadoGeneral.activo && usuario.rol.es_super_admin) {
            const otroSuperAdmin = await usuario_repository_1.usuarioRepository.findUsuarioActivoConRol(usuario.rol.id, id // excluir al usuario actual
            );
            if (!otroSuperAdmin) {
                throw new HttpErrors_1.ForbiddenError('No puedes desactivar al único superadmin activo del sistema. ' +
                    'Asigna el rol superadmin a otro usuario primero.');
            }
        }
        const actualizado = await usuario_repository_1.usuarioRepository.update(id, { estado });
        return {
            message: `Usuario ${estado === 'activo' ? 'activado' : 'desactivado'} correctamente`,
            usuario: actualizado,
        };
    },
    async resetPassword(id, newPassword) {
        await this.obtenerPorId(id);
        if (newPassword.length < 8)
            throw new HttpErrors_1.BadRequestError('La contraseña debe tener al menos 8 caracteres');
        const password_hash = await bcrypt_1.default.hash(newPassword, 10);
        await usuario_repository_1.usuarioRepository.update(id, { password_hash });
        return { message: 'Contraseña reseteada correctamente' };
    },
    /**
     * asignarRol — valida las dos direcciones del cambio de rol superadmin.
     * @param solicitanteId — ID del usuario que hace la petición
     *
     * Caso A — nuevo rol ES superadmin:
     *   verifica que no haya otro usuario activo con ese rol
     *
     * Caso B — nuevo rol NO ES superadmin, pero el usuario actual SÍ lo era:
     *   verifica que quede al menos otro usuario activo con el rol superadmin
     */
    async asignarRol(id, id_rol, solicitanteId) {
        if (id === solicitanteId)
            throw new HttpErrors_1.BadRequestError('No puedes cambiar tu propio rol');
        const usuario = await usuario_repository_1.usuarioRepository.findById(id);
        if (!usuario)
            throw new HttpErrors_1.NotFoundError('Usuario');
        const rolNuevo = await usuario_repository_1.usuarioRepository.findRolById(id_rol);
        if (!rolNuevo)
            throw new HttpErrors_1.NotFoundError('Rol');
        // Sin cambio real — evitar operación innecesaria
        if (usuario.rol.id === id_rol) {
            return { message: 'El usuario ya tiene ese rol', usuario };
        }
        // [SUPERADMIN] Caso A: el rol nuevo es superadmin
        if (rolNuevo.es_super_admin) {
            const superAdminExistente = await usuario_repository_1.usuarioRepository.findUsuarioActivoConRol(rolNuevo.id, id // excluir al propio usuario
            );
            if (superAdminExistente) {
                throw new HttpErrors_1.ConflictError(`Ya existe un superadmin activo (${superAdminExistente.usuario}). ` +
                    `Solo puede haber uno en el sistema.`);
            }
        }
        // [SUPERADMIN] Caso B: el usuario actual es superadmin y se le quita ese rol
        if (usuario.rol.es_super_admin && !rolNuevo.es_super_admin) {
            const otroSuperAdmin = await usuario_repository_1.usuarioRepository.findUsuarioActivoConRol(usuario.rol.id, id // excluir al usuario actual
            );
            if (!otroSuperAdmin) {
                throw new HttpErrors_1.ForbiddenError('No puedes quitarle el rol superadmin si no hay otro superadmin activo. ' +
                    'Asigna primero el rol superadmin a otro usuario.');
            }
        }
        const actualizado = await usuario_repository_1.usuarioRepository.update(id, { id_rol });
        return { message: `Rol "${rolNuevo.nombre}" asignado correctamente`, usuario: actualizado };
    },
    async listarRoles() {
        return usuario_repository_1.usuarioRepository.findRoles();
    },
    async estadisticas() {
        const [total, activos, inactivos] = await Promise.all([
            usuario_repository_1.usuarioRepository.count(),
            usuario_repository_1.usuarioRepository.countByEstado(client_1.EstadoGeneral.activo),
            usuario_repository_1.usuarioRepository.countByEstado(client_1.EstadoGeneral.inactivo),
        ]);
        return { total, activos, inactivos };
    },
    // ── ROLES ─────────────────────────────────────────────────────────────────
    /**
     * crearRol — garantiza que no se cree un segundo rol superadmin.
     */
    async crearRol(data) {
        if (data.es_super_admin) {
            const existente = await usuario_repository_1.usuarioRepository.findSuperAdminRol();
            if (existente) {
                throw new HttpErrors_1.ConflictError(`Ya existe el rol superadmin "${existente.nombre}". ` +
                    `Solo puede haber uno en el sistema.`);
            }
        }
        return usuario_repository_1.usuarioRepository.createRol(data);
    },
    /**
     * actualizarRol — tres guards de superadmin:
     * 1. No crear un segundo rol superadmin
     * 2. No quitar es_super_admin al único rol superadmin
     * 3. No desactivar el rol superadmin
     */
    async actualizarRol(id, data) {
        const rol = await usuario_repository_1.usuarioRepository.findRolById(id);
        if (!rol)
            throw new HttpErrors_1.NotFoundError('Rol');
        // [SUPERADMIN] Guard 1: intentar convertir otro rol en superadmin
        if (data.es_super_admin === true && !rol.es_super_admin) {
            const existente = await usuario_repository_1.usuarioRepository.findSuperAdminRol(id);
            if (existente) {
                throw new HttpErrors_1.ConflictError(`Ya existe el rol superadmin "${existente.nombre}". ` +
                    `Solo puede haber uno en el sistema.`);
            }
        }
        // [SUPERADMIN] Guard 2: quitar flag superadmin al único rol superadmin
        if (data.es_super_admin === false && rol.es_super_admin) {
            throw new HttpErrors_1.ForbiddenError('No puedes quitar el flag superadmin al único rol superadmin del sistema.');
        }
        // [SUPERADMIN] Guard 3: desactivar el rol superadmin
        if (data.estado && data.estado !== client_1.EstadoGeneral.activo && rol.es_super_admin) {
            throw new HttpErrors_1.ForbiddenError('No se puede desactivar el rol superadmin.');
        }
        return usuario_repository_1.usuarioRepository.updateRol(id, data);
    },
};
//# sourceMappingURL=usuario.service.js.map