import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EstadoGeneral } from '@prisma/client';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/categoria.repository', () => ({
  categoriaRepository: {
    findAll:          vi.fn(),
    findById:         vi.fn(),
    findByNombre:     vi.fn(),
    create:           vi.fn(),
    update:           vi.fn(),
    delete:           vi.fn(),
    reorder:          vi.fn(),
    countProductos:   vi.fn(),
    countSubcategorias: vi.fn(),
  },
}));

vi.mock('../../config/redis', () => ({
  cacheGetOrSet: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()),
  cacheDel:      vi.fn(),
  CACHE_TTL:     { SHORT: 60, MID: 300, LONG: 3600 },
}));

// ── Imports DESPUÉS de los mocks ───────────────────────────────────────────────

import { categoriaService } from '../categoria.service';
import { categoriaRepository } from '../../repositories/categoria.repository';
import { cacheDel } from '../../config/redis';

const repo = categoriaRepository as ReturnType<typeof vi.fn> & typeof categoriaRepository;

const mockCategoria = {
  id: 1, nombre: 'Bebidas', descripcion: null,
  categoria_padre: null, imagen_url: null,
  estado: EstadoGeneral.activo, orden: 0,
  icono: null, color: null,
};

beforeEach(() => vi.clearAllMocks());

// ── listar ────────────────────────────────────────────────────────────────────

describe('listar', () => {
  it('devuelve lista de categorías', async () => {
    (repo.findAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockCategoria]);
    const result = await categoriaService.listar();
    expect(result).toEqual([mockCategoria]);
  });

  it('pasa el filtro de estado al repository', async () => {
    (repo.findAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    await categoriaService.listar(EstadoGeneral.inactivo);
    expect(repo.findAll).toHaveBeenCalledWith(EstadoGeneral.inactivo, undefined);
  });
});

// ── obtenerPorId ─────────────────────────────────────────────────────────────

describe('obtenerPorId', () => {
  it('devuelve categoría existente', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCategoria);
    const result = await categoriaService.obtenerPorId(1);
    expect(result).toEqual(mockCategoria);
  });

  it('lanza NotFoundError si no existe', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(categoriaService.obtenerPorId(99)).rejects.toThrow('Categoría');
  });
});

// ── crear ─────────────────────────────────────────────────────────────────────

describe('crear', () => {
  it('crea categoría y limpia caché', async () => {
    (repo.findByNombre as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    (repo.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCategoria);

    const result = await categoriaService.crear({ nombre: 'Bebidas', id_grupo: 1 });

    expect(result).toEqual(mockCategoria);
    expect(cacheDel).toHaveBeenCalled();
  });

  it('lanza ConflictError si el nombre ya existe', async () => {
    (repo.findByNombre as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCategoria);
    await expect(categoriaService.crear({ nombre: 'Bebidas', id_grupo: 1 }))
      .rejects.toThrow('Ya existe una categoría');
  });
});

// ── actualizar ────────────────────────────────────────────────────────────────

describe('actualizar', () => {
  it('actualiza y limpia caché', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCategoria);
    const actualizada = { ...mockCategoria, nombre: 'Bebidas Calientes' };
    (repo.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce(actualizada);

    const result = await categoriaService.actualizar(1, { nombre: 'Bebidas Calientes' });

    expect(result.nombre).toBe('Bebidas Calientes');
    expect(cacheDel).toHaveBeenCalled();
  });

  it('lanza NotFoundError si no existe', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(categoriaService.actualizar(99, { nombre: 'X' }))
      .rejects.toThrow('Categoría');
  });
});

// ── eliminar ─────────────────────────────────────────────────────────────────

describe('eliminar', () => {
  it('elimina categoría sin productos ni subcategorías', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCategoria);
    (repo.countProductos as ReturnType<typeof vi.fn>).mockResolvedValueOnce(0);
    (repo.countSubcategorias as ReturnType<typeof vi.fn>).mockResolvedValueOnce(0);
    (repo.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    await expect(categoriaService.eliminar(1)).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith(1);
    expect(cacheDel).toHaveBeenCalled();
  });

  it('lanza ConflictError si tiene productos', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCategoria);
    (repo.countProductos as ReturnType<typeof vi.fn>).mockResolvedValueOnce(3);

    await expect(categoriaService.eliminar(1))
      .rejects.toThrow('tiene productos asociados');
  });

  it('lanza ConflictError si tiene subcategorías', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCategoria);
    (repo.countProductos as ReturnType<typeof vi.fn>).mockResolvedValueOnce(0);
    (repo.countSubcategorias as ReturnType<typeof vi.fn>).mockResolvedValueOnce(2);

    await expect(categoriaService.eliminar(1))
      .rejects.toThrow('tiene subcategorías');
  });

  it('lanza NotFoundError si no existe', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(categoriaService.eliminar(99)).rejects.toThrow('Categoría');
  });
});

// ── reordenar ─────────────────────────────────────────────────────────────────

describe('reordenar', () => {
  it('llama a repository y limpia caché', async () => {
    (repo.reorder as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await categoriaService.reordenar([{ id: 1, orden: 0 }, { id: 2, orden: 1 }]);
    expect(repo.reorder).toHaveBeenCalled();
    expect(cacheDel).toHaveBeenCalled();
  });
});
