/**
 * exceptions/index.ts - Re-exporta todas las excepciones desde un solo punto
 * Esto resuelve el problema de paths relativos entre archivos del mismo folder
 */
export { AppError } from './AppError';
export { NotFoundError, ConflictError, BadRequestError, UnauthorizedError, ForbiddenError, ValidationError, } from './HttpErrors';
export { handlePrismaError } from './PrismaErrors';
//# sourceMappingURL=index.d.ts.map