/**
 * pagination.ts - Helper de paginación reutilizable
 */
export interface PaginationParams {
    page: number;
    limit: number;
}
export interface PaginatedResult<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
export declare const getPaginationParams: (page: unknown, limit: unknown) => PaginationParams;
export declare const getSkip: ({ page, limit }: PaginationParams) => number;
export declare const buildPaginatedResult: <T>(data: T[], total: number, params: PaginationParams) => PaginatedResult<T>;
//# sourceMappingURL=pagination.d.ts.map