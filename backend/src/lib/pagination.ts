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

export const getPaginationParams = (
  page: unknown,
  limit: unknown
): PaginationParams => ({
  page:  Math.max(1, Number(page)  || 1),
  limit: Math.min(500, Math.max(1, Number(limit) || 20)),
});

export const getSkip = ({ page, limit }: PaginationParams): number =>
  (page - 1) * limit;

export const buildPaginatedResult = <T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> => ({
  data,
  meta: {
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  },
});
