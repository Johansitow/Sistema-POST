"use strict";
/**
 * UsuariosController - Recibe request, valida con DTO, delega al service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.estadisticas = exports.listarRoles = exports.asignarRol = exports.resetPassword = exports.cambiarEstado = exports.actualizar = exports.crear = exports.obtener = exports.listar = void 0;
const usuario_service_1 = require("../services/usuario.service");
const error_middleware_1 = require("../middlewares/error.middleware");
const HttpErrors_1 = require("../exceptions/HttpErrors");
const usuarios_dto_1 = require("../dto/usuarios.dto");
const qs = (val) => Array.isArray(val) ? val[0] : val;
const pid = (val) => {
    const n = parseInt(Array.isArray(val) ? val[0] : val, 10);
    if (isNaN(n))
        throw new HttpErrors_1.BadRequestError('ID inválido');
    return n;
};
exports.listar = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const result = await usuario_service_1.usuarioService.listar({
        page: qs(req.query.page),
        limit: qs(req.query.limit),
        search: qs(req.query.search),
        estado: qs(req.query.estado),
        id_rol: qs(req.query.id_rol) ? parseInt(qs(req.query.id_rol), 10) : undefined,
    });
    res.json(result);
});
exports.obtener = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const usuario = await usuario_service_1.usuarioService.obtenerPorId(pid(req.params.id));
    res.json({ usuario });
});
exports.crear = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = usuarios_dto_1.createUsuarioSchema.parse(req.body);
    const usuario = await usuario_service_1.usuarioService.crear(data, req.user.id);
    res.status(201).json({ message: 'Usuario creado correctamente', usuario });
});
exports.actualizar = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = usuarios_dto_1.updateUsuarioSchema.parse(req.body);
    const usuario = await usuario_service_1.usuarioService.actualizar(pid(req.params.id), data);
    res.json({ message: 'Usuario actualizado correctamente', usuario });
});
exports.cambiarEstado = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const { estado } = usuarios_dto_1.cambiarEstadoSchema.parse(req.body);
    const result = await usuario_service_1.usuarioService.cambiarEstado(pid(req.params.id), estado, req.user.id // solicitanteId
    );
    res.json(result);
});
exports.resetPassword = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const { newPassword } = usuarios_dto_1.resetPasswordSchema.parse(req.body);
    const result = await usuario_service_1.usuarioService.resetPassword(pid(req.params.id), newPassword);
    res.json(result);
});
exports.asignarRol = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const { id_rol } = usuarios_dto_1.asignarRolSchema.parse(req.body);
    const result = await usuario_service_1.usuarioService.asignarRol(pid(req.params.id), id_rol, req.user.id // solicitanteId — necesario para los guards de superadmin
    );
    res.json(result);
});
exports.listarRoles = (0, error_middleware_1.asyncHandler)(async (_req, res) => {
    const roles = await usuario_service_1.usuarioService.listarRoles();
    res.json({ roles });
});
exports.estadisticas = (0, error_middleware_1.asyncHandler)(async (_req, res) => {
    const stats = await usuario_service_1.usuarioService.estadisticas();
    res.json({ stats });
});
//# sourceMappingURL=usuarios.controller.js.map