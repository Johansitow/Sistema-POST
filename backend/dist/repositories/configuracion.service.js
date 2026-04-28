"use strict";
/**
 * ConfiguracionService
 *
 * Gestiona la configuración dinámica del sistema.
 * Solo superadmin (o permiso config.sistema) puede editar.
 *
 * Incluye también gestión de permisos: qué permisos puede
 * otorgar un superadmin a otros roles/usuarios.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configuracionService = void 0;
const database_1 = __importDefault(require("../config/database"));
const configuracion_repository_1 = require("../repositories/configuracion.repository");
const HttpErrors_1 = require("../exceptions/HttpErrors");
// Claves que NUNCA se pueden editar desde el frontend (solo via seed/migration)
const CLAVES_SISTEMA = ['prefijo_orden'];
exports.configuracionService = {
    // ── LECTURA ──────────────────────────────────────────────────────────────
    async listar(categoria) {
        const configs = await configuracion_repository_1.configuracionRepository.findAll(categoria);
        // Parsear valores al tipo correcto
        return configs.map(c => ({
            ...c,
            valor_parseado: configuracion_repository_1.configuracionRepository.parseValor(c),
        }));
    },
    async obtenerPorClave(clave) {
        const config = await configuracion_repository_1.configuracionRepository.findByClave(clave);
        if (!config)
            throw new HttpErrors_1.NotFoundError(`Configuración '${clave}'`);
        return { ...config, valor_parseado: configuracion_repository_1.configuracionRepository.parseValor(config) };
    },
    /** Shortcut para leer un valor ya parseado directo */
    async getValor(clave) {
        const config = await configuracion_repository_1.configuracionRepository.findByClave(clave);
        if (!config)
            throw new HttpErrors_1.NotFoundError(`Configuración '${clave}'`);
        return configuracion_repository_1.configuracionRepository.parseValor(config);
    },
    // ── ESCRITURA (solo superadmin / config.sistema) ──────────────────────────
    async actualizar(clave, valor) {
        if (CLAVES_SISTEMA.includes(clave))
            throw new HttpErrors_1.ForbiddenError(`La clave '${clave}' no es editable`);
        const config = await configuracion_repository_1.configuracionRepository.findByClave(clave);
        if (!config)
            throw new HttpErrors_1.NotFoundError(`Configuración '${clave}'`);
        if (!config.es_editable)
            throw new HttpErrors_1.ForbiddenError(`La clave '${clave}' no es editable`);
        // Validar tipo
        this._validarTipo(valor, config.tipo_dato);
        return configuracion_repository_1.configuracionRepository.update(clave, valor);
    },
    async actualizarVarias(items) {
        // Validar todas antes de escribir ninguna
        for (const item of items) {
            if (CLAVES_SISTEMA.includes(item.clave))
                throw new HttpErrors_1.ForbiddenError(`La clave '${item.clave}' no es editable`);
            const config = await configuracion_repository_1.configuracionRepository.findByClave(item.clave);
            if (!config)
                throw new HttpErrors_1.NotFoundError(`Configuración '${item.clave}'`);
            if (!config.es_editable)
                throw new HttpErrors_1.ForbiddenError(`La clave '${item.clave}' no es editable`);
            this._validarTipo(item.valor, config.tipo_dato);
        }
        return configuracion_repository_1.configuracionRepository.updateMany(items);
    },
    _validarTipo(valor, tipo) {
        if (tipo === 'number' && isNaN(Number(valor)))
            throw new HttpErrors_1.BadRequestError(`El valor '${valor}' no es un número válido`);
        if (tipo === 'boolean' && !['true', 'false'].includes(valor))
            throw new HttpErrors_1.BadRequestError(`El valor debe ser 'true' o 'false'`);
        if (tipo === 'json') {
            try {
                JSON.parse(valor);
            }
            catch {
                throw new HttpErrors_1.BadRequestError(`El valor no es JSON válido`);
            }
        }
    },
    // ── GESTIÓN DE PERMISOS ───────────────────────────────────────────────────
    /** Lista todos los permisos disponibles en el sistema */
    async listarPermisos() {
        return database_1.default.permiso.findMany({ orderBy: [{ modulo: 'asc' }, { nombre: 'asc' }] });
    },
    /** Lista permisos asignados a un rol */
    async listarPermisosRol(id_rol) {
        const rol = await database_1.default.rol.findUnique({
            where: { id: id_rol },
            include: { permisos: { include: { permiso: true } } },
        });
        if (!rol)
            throw new HttpErrors_1.NotFoundError('Rol');
        return rol.permisos.map(rp => rp.permiso);
    },
    /** Asigna un permiso a un rol (solo superadmin puede llamar esto) */
    async asignarPermiso(id_rol, id_permiso) {
        const [rol, permiso] = await Promise.all([
            database_1.default.rol.findUnique({ where: { id: id_rol } }),
            database_1.default.permiso.findUnique({ where: { id: id_permiso } }),
        ]);
        if (!rol)
            throw new HttpErrors_1.NotFoundError('Rol');
        if (!permiso)
            throw new HttpErrors_1.NotFoundError('Permiso');
        // Verificar que no exista ya
        const existente = await database_1.default.rolPermiso.findFirst({
            where: { id_rol, id_permiso },
        });
        if (existente)
            throw new HttpErrors_1.BadRequestError('El rol ya tiene ese permiso');
        return database_1.default.rolPermiso.create({ data: { id_rol, id_permiso } });
    },
    /** Revoca un permiso de un rol */
    async revocarPermiso(id_rol, id_permiso) {
        const rolPermiso = await database_1.default.rolPermiso.findFirst({
            where: { id_rol, id_permiso },
        });
        if (!rolPermiso)
            throw new HttpErrors_1.NotFoundError('Asignación de permiso');
        return database_1.default.rolPermiso.delete({ where: { id: rolPermiso.id } });
    },
    /** Reemplaza todos los permisos de un rol en una sola operación */
    async sincronizarPermisos(id_rol, ids_permisos) {
        const rol = await database_1.default.rol.findUnique({ where: { id: id_rol } });
        if (!rol)
            throw new HttpErrors_1.NotFoundError('Rol');
        // Verificar que todos los permisos existen
        const permisos = await database_1.default.permiso.findMany({ where: { id: { in: ids_permisos } } });
        if (permisos.length !== ids_permisos.length)
            throw new HttpErrors_1.BadRequestError('Uno o más permisos no existen');
        return database_1.default.$transaction(async (tx) => {
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
//# sourceMappingURL=configuracion.service.js.map