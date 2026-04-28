"use strict";
/**
 * AuthController - Recibe request, valida con DTO, delega al service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.changePassword = exports.getProfile = exports.refreshToken = exports.login = void 0;
const auth_service_1 = require("../services/auth.service");
const error_middleware_1 = require("../middlewares/error.middleware");
const auth_dto_1 = require("../dto/auth.dto");
exports.login = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const { usuario, password } = auth_dto_1.loginSchema.parse(req.body);
    const result = await auth_service_1.authService.login(usuario, password);
    res.json({ message: 'Login exitoso', user: result.user, tokens: result.tokens });
});
exports.refreshToken = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const { refreshToken } = auth_dto_1.refreshTokenSchema.parse(req.body);
    const tokens = await auth_service_1.authService.refreshToken(refreshToken);
    res.json({ tokens });
});
exports.getProfile = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const user = await auth_service_1.authService.getProfile(req.user.id);
    res.json({ user });
});
exports.changePassword = (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const { currentPassword, newPassword } = auth_dto_1.changePasswordSchema.parse(req.body);
    const result = await auth_service_1.authService.changePassword(req.user.id, currentPassword, newPassword);
    res.json(result);
});
exports.logout = (0, error_middleware_1.asyncHandler)(async (_req, res) => {
    res.json({ message: 'Sesión cerrada correctamente' });
});
//# sourceMappingURL=auth.controller.js.map