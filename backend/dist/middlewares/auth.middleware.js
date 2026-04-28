"use strict";
/**
 * AuthMiddleware - Verifica JWT y permisos
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireSuperAdmin = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const HttpErrors_1 = require("../exceptions/HttpErrors");
const authenticate = (req, _res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
        return next(new HttpErrors_1.UnauthorizedError('Token de autenticación requerido'));
    try {
        req.user = jsonwebtoken_1.default.verify(authHeader.split(' ')[1], env_1.config.jwt.secret);
        next();
    }
    catch {
        next(new HttpErrors_1.UnauthorizedError('Token inválido o expirado'));
    }
};
exports.authenticate = authenticate;
const requireSuperAdmin = (req, _res, next) => {
    if (!req.user?.rol?.es_super_admin)
        return next(new HttpErrors_1.ForbiddenError('Se requieren permisos de administrador'));
    next();
};
exports.requireSuperAdmin = requireSuperAdmin;
const requireRole = (...roles) => (req, _res, next) => {
    if (!req.user)
        return next(new HttpErrors_1.UnauthorizedError('No autenticado'));
    if (!roles.includes(req.user.rol.nombre) && !req.user.rol.es_super_admin)
        return next(new HttpErrors_1.ForbiddenError('No tienes permisos para esta acción'));
    next();
};
exports.requireRole = requireRole;
//# sourceMappingURL=auth.middleware.js.map