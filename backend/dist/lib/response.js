"use strict";
/**
 * response.ts - Helper para respuestas HTTP estandarizadas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = void 0;
const successResponse = (data, message) => ({
    success: true,
    ...(message && { message }),
    data,
});
exports.successResponse = successResponse;
//# sourceMappingURL=response.js.map