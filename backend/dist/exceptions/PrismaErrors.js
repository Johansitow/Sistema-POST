"use strict";
/**
 * PrismaErrors - Traduce errores de Prisma a errores HTTP legibles
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePrismaError = handlePrismaError;
const client_1 = require("@prisma/client");
const AppError_1 = require("./AppError");
const HttpErrors_1 = require("./HttpErrors");
function handlePrismaError(error) {
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case 'P2002': {
                const fields = error.meta?.target?.join(', ') ?? 'campo';
                return new HttpErrors_1.ConflictError(`Ya existe un registro con ese ${fields}`);
            }
            case 'P2025':
                return new HttpErrors_1.NotFoundError('Registro');
            case 'P2003':
                return new HttpErrors_1.BadRequestError('Referencia inválida: el registro relacionado no existe');
            default:
                return new AppError_1.AppError(`Error de base de datos: ${error.code}`, 500);
        }
    }
    if (error instanceof client_1.Prisma.PrismaClientValidationError)
        return new HttpErrors_1.BadRequestError('Datos inválidos enviados a la base de datos');
    if (error instanceof AppError_1.AppError)
        return error;
    return new AppError_1.AppError('Error interno del servidor', 500);
}
//# sourceMappingURL=PrismaErrors.js.map