"use strict";
/**
 * permission.middleware.ts
 * Verifica que el usuario autenticado tenga el permiso requerido.
 * Debe usarse siempre después de `authenticate`.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = void 0;
const HttpErrors_1 = require("../exceptions/HttpErrors");
const database_1 = __importDefault(require("../config/database"));
const requirePermission = (codigoPermiso) => async (req, _res, next) => {
    try {
        const user = req.user;
        // Superadmin siempre tiene acceso
        if (user?.rol?.es_super_admin)
            return next();
        if (!user?.rol?.id)
            return next(new HttpErrors_1.ForbiddenError('No autorizado'));
        // Buscar si el rol tiene el permiso requerido
        const rolPermiso = await database_1.default.rolPermiso.findFirst({
            where: {
                id_rol: user.rol.id,
                permiso: { codigo: codigoPermiso },
            },
            include: { permiso: true },
        });
        if (!rolPermiso) {
            return next(new HttpErrors_1.ForbiddenError(`No tienes el permiso requerido: ${codigoPermiso}`));
        }
        next();
    }
    catch (e) {
        next(e);
    }
};
exports.requirePermission = requirePermission;
//# sourceMappingURL=permission.middleware.js.map