"use strict";
/**
 * ErrorMiddleware - Maneja todos los errores de la aplicación
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.errorHandler = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../exceptions/AppError");
const PrismaErrors_1 = require("../exceptions/PrismaErrors");
const logger_1 = __importDefault(require("../config/logger"));
const errorHandler = (err, req, res, _next) => {
    logger_1.default.error('Error capturado:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
    });
    // Error de validación Zod
    if (err instanceof zod_1.ZodError) {
        return res.status(422).json({
            error: 'Error de validación',
            details: err.errors.map(e => ({ campo: e.path.join('.'), mensaje: e.message })),
        });
    }
    // Errores de Prisma → traducir a AppError
    const appError = err instanceof AppError_1.AppError ? err : (0, PrismaErrors_1.handlePrismaError)(err);
    return res.status(appError.statusCode).json({
        error: appError.message,
        ...(process.env.NODE_ENV === 'development' && { stack: appError.stack }),
    });
};
exports.errorHandler = errorHandler;
// Wrapper para capturar errores asíncronos sin try/catch en cada handler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=error.middleware.js.map