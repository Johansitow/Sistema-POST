"use strict";
/**
 * exceptions/index.ts - Re-exporta todas las excepciones desde un solo punto
 * Esto resuelve el problema de paths relativos entre archivos del mismo folder
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePrismaError = exports.ValidationError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.ConflictError = exports.NotFoundError = exports.AppError = void 0;
var AppError_1 = require("./AppError");
Object.defineProperty(exports, "AppError", { enumerable: true, get: function () { return AppError_1.AppError; } });
var HttpErrors_1 = require("./HttpErrors");
Object.defineProperty(exports, "NotFoundError", { enumerable: true, get: function () { return HttpErrors_1.NotFoundError; } });
Object.defineProperty(exports, "ConflictError", { enumerable: true, get: function () { return HttpErrors_1.ConflictError; } });
Object.defineProperty(exports, "BadRequestError", { enumerable: true, get: function () { return HttpErrors_1.BadRequestError; } });
Object.defineProperty(exports, "UnauthorizedError", { enumerable: true, get: function () { return HttpErrors_1.UnauthorizedError; } });
Object.defineProperty(exports, "ForbiddenError", { enumerable: true, get: function () { return HttpErrors_1.ForbiddenError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return HttpErrors_1.ValidationError; } });
var PrismaErrors_1 = require("./PrismaErrors");
Object.defineProperty(exports, "handlePrismaError", { enumerable: true, get: function () { return PrismaErrors_1.handlePrismaError; } });
//# sourceMappingURL=index.js.map