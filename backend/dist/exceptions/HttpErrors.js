"use strict";
/**
 * HttpErrors - Un error por código HTTP
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.ConflictError = exports.NotFoundError = void 0;
const AppError_1 = require("./AppError");
class NotFoundError extends AppError_1.AppError {
    constructor(resource = 'Recurso') {
        super(`${resource} no encontrado`, 404);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError_1.AppError {
    constructor(message) {
        super(message, 409);
    }
}
exports.ConflictError = ConflictError;
class BadRequestError extends AppError_1.AppError {
    constructor(message) {
        super(message, 400);
    }
}
exports.BadRequestError = BadRequestError;
class UnauthorizedError extends AppError_1.AppError {
    constructor(message = 'No autorizado') {
        super(message, 401);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError_1.AppError {
    constructor(message = 'Acceso denegado') {
        super(message, 403);
    }
}
exports.ForbiddenError = ForbiddenError;
class ValidationError extends AppError_1.AppError {
    constructor(message) {
        super(message, 422);
    }
}
exports.ValidationError = ValidationError;
//# sourceMappingURL=HttpErrors.js.map