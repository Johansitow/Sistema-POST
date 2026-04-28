import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({
  default: {
    get:   vi.fn(),
    post:  vi.fn(),
    put:   vi.fn(),
    patch: vi.fn(),
  },
}));

import { proveedorService } from '../services/servicios-gestion';
import api from '../services/api';

const mock = api as unknown as {
  get:   ReturnType<typeof vi.fn>;
  post:  ReturnType<typeof vi.fn>;
  put:   ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

const proveedorBase = {
  id: 1, razon_social: 'Distribuidora XYZ', estado: 'activo', fecha_creacion: '2026-01-01',
};

beforeEach(() => vi.clearAllMocks());

// ── getAll ────────────────────────────────────────────────────────────────────

describe('getAll', () => {
  it('retorna data y meta de la respuesta', async () => {
    mock.get.mockResolvedValueOnce({
      data: { data: [proveedorBase], meta: { total: 1, page: 1, limit: 20 } },
    });

    const result = await proveedorService.getAll();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].razon_social).toBe('Distribuidora XYZ');
    expect(result.meta.total).toBe(1);
    expect(mock.get).toHaveBeenCalledWith('/proveedores', { params: {} });
  });

  it('pasa parámetros de búsqueda', async () => {
    mock.get.mockResolvedValueOnce({ data: { data: [], meta: {} } });
    await proveedorService.getAll({ search: 'XYZ', estado: 'activo', page: 2 });
    expect(mock.get).toHaveBeenCalledWith('/proveedores', {
      params: { search: 'XYZ', estado: 'activo', page: 2 },
    });
  });
});

// ── getById ───────────────────────────────────────────────────────────────────

describe('getById', () => {
  it('llama a /proveedores/:id y retorna el proveedor', async () => {
    mock.get.mockResolvedValueOnce({ data: { data: proveedorBase } });
    const result = await proveedorService.getById(1);
    expect(result.id).toBe(1);
    expect(mock.get).toHaveBeenCalledWith('/proveedores/1');
  });
});

// ── create ────────────────────────────────────────────────────────────────────

describe('create', () => {
  it('envía POST y retorna el proveedor creado', async () => {
    mock.post.mockResolvedValueOnce({ data: { data: { ...proveedorBase, id: 5 } } });
    const result = await proveedorService.create({ razon_social: 'Nuevo Proveedor' });
    expect(result.id).toBe(5);
    expect(mock.post).toHaveBeenCalledWith('/proveedores', { razon_social: 'Nuevo Proveedor' });
  });
});

// ── update ────────────────────────────────────────────────────────────────────

describe('update', () => {
  it('envía PUT con los datos parciales', async () => {
    mock.put.mockResolvedValueOnce({ data: { data: { ...proveedorBase, calificacion: 5 } } });
    const result = await proveedorService.update(1, { calificacion: 5 });
    expect(result.calificacion).toBe(5);
    expect(mock.put).toHaveBeenCalledWith('/proveedores/1', { calificacion: 5 });
  });
});

// ── cambiarEstado ─────────────────────────────────────────────────────────────

describe('cambiarEstado', () => {
  it('envía PATCH con el estado nuevo', async () => {
    mock.patch.mockResolvedValueOnce({ data: { data: { ...proveedorBase, estado: 'inactivo' } } });
    const result = await proveedorService.cambiarEstado(1, 'inactivo');
    expect(result.estado).toBe('inactivo');
    expect(mock.patch).toHaveBeenCalledWith('/proveedores/1/estado', { estado: 'inactivo' });
  });
});
