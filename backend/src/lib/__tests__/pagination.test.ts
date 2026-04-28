import { describe, it, expect } from 'vitest';
import { getPaginationParams, getSkip, buildPaginatedResult } from '../pagination';

describe('getPaginationParams', () => {
  it('devuelve defaults cuando no se pasan parámetros', () => {
    const p = getPaginationParams(undefined, undefined);
    expect(p).toEqual({ page: 1, limit: 20 });
  });

  it('convierte strings numéricos', () => {
    const p = getPaginationParams('3', '50');
    expect(p).toEqual({ page: 3, limit: 50 });
  });

  it('page mínimo es 1', () => {
    expect(getPaginationParams(0, 10).page).toBe(1);
    expect(getPaginationParams(-5, 10).page).toBe(1);
  });

  it('limit máximo es 500', () => {
    expect(getPaginationParams(1, 600).limit).toBe(500);
  });

  it('limit=0 usa el default 20 (0 es falsy)', () => {
    // La impl usa (Number(limit) || 20): 0 es falsy → aplica default 20
    expect(getPaginationParams(1, 0).limit).toBe(20);
  });

  it('limit=-1 retorna el mínimo 1', () => {
    expect(getPaginationParams(1, -1).limit).toBe(1);
  });
});

describe('getSkip', () => {
  it('page 1 → skip 0', () => {
    expect(getSkip({ page: 1, limit: 20 })).toBe(0);
  });

  it('page 2 con limit 20 → skip 20', () => {
    expect(getSkip({ page: 2, limit: 20 })).toBe(20);
  });

  it('page 3 con limit 10 → skip 20', () => {
    expect(getSkip({ page: 3, limit: 10 })).toBe(20);
  });
});

describe('buildPaginatedResult', () => {
  it('calcula totalPages correctamente', () => {
    const result = buildPaginatedResult(['a', 'b'], 25, { page: 1, limit: 10 });
    expect(result.meta.totalPages).toBe(3);
  });

  it('estructura correcta', () => {
    const data = [{ id: 1 }];
    const result = buildPaginatedResult(data, 1, { page: 1, limit: 20 });
    expect(result.data).toBe(data);
    expect(result.meta.total).toBe(1);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(20);
  });

  it('totalPages con total = 0', () => {
    const result = buildPaginatedResult([], 0, { page: 1, limit: 20 });
    expect(result.meta.totalPages).toBe(0);
  });
});
