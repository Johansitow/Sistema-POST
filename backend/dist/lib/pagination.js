"use strict";
/**
 * pagination.ts - Helper de paginación reutilizable
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPaginatedResult = exports.getSkip = exports.getPaginationParams = void 0;
const getPaginationParams = (page, limit) => ({
    page: Math.max(1, Number(page) || 1),
    limit: Math.min(100, Math.max(1, Number(limit) || 20)),
});
exports.getPaginationParams = getPaginationParams;
const getSkip = ({ page, limit }) => (page - 1) * limit;
exports.getSkip = getSkip;
const buildPaginatedResult = (data, total, params) => ({
    data,
    meta: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
    },
});
exports.buildPaginatedResult = buildPaginatedResult;
//# sourceMappingURL=pagination.js.map