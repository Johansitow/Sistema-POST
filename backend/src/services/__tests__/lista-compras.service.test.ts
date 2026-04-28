import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EstadoListaCompras } from '@prisma/client';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/lista-compras.repository', () => ({
  listaComprasRepository: {
    findAll:    vi.fn(),
    findById:   vi.fn(),
    update:     vi.fn(),
    updateItem: vi.fn(),
  },
}));

vi.mock('../../repositories/proveedor.repository', () => ({
  proveedorRepository: {
    findAll:                      vi.fn(),
    findMejorProveedorParaProducto: vi.fn(),
  },
}));

const mockTx = {
  listaCompras: {
    findFirst: vi.fn(),
    create:    vi.fn(),
  },
};

vi.mock('../../config/database', () => ({
  default: {
    $queryRaw:    vi.fn(),
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
    alerta: {
      create: vi.fn(),
    },
    tipoAlerta: {
      findFirst: vi.fn(),
    },
    restaurante: {
      findFirst: vi.fn(),
    },
  },
}));

// ── Imports DESPUÉS de los mocks ───────────────────────────────────────────────

import { listaComprasService }   from '../lista-compras.service';
import { listaComprasRepository } from '../../repositories/lista-compras.repository';
import { proveedorRepository }    from '../../repositories/proveedor.repository';
import prisma from '../../config/database';

const repo      = listaComprasRepository as ReturnType<typeof vi.fn> & typeof listaComprasRepository;
const provRepo  = proveedorRepository    as ReturnType<typeof vi.fn> & typeof proveedorRepository;
const prismaMock = prisma as any;

const mockLista = {
  id: 1, numero_lista: 'LC-000001',
  estado: EstadoListaCompras.generada,
  notas: null, total_estimado: null,
  items: [],
};

beforeEach(() => vi.clearAllMocks());

// ── listar ────────────────────────────────────────────────────────────────────

describe('listar', () => {
  it('devuelve resultado paginado', async () => {
    (repo.findAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([[mockLista], 1]);
    const result = await listaComprasService.listar({ page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });
});

// ── obtenerPorId ──────────────────────────────────────────────────────────────

describe('obtenerPorId', () => {
  it('devuelve lista existente', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockLista);
    const result = await listaComprasService.obtenerPorId(1);
    expect(result.numero_lista).toBe('LC-000001');
  });

  it('lanza NotFoundError si no existe', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(listaComprasService.obtenerPorId(99)).rejects.toThrow('Lista de compras');
  });
});

// ── generarAutomatico ─────────────────────────────────────────────────────────

describe('generarAutomatico', () => {
  it('retorna mensaje si no hay productos bajo stock', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]); // sin productos bajo mínimo

    const result = await listaComprasService.generarAutomatico(1, { id_restaurante: 1 });
    expect(result.mensaje).toContain('No hay');
    expect(result.lista).toBeNull();
  });

  it('genera lista con número secuencial LC-000001', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: 1, nombre: 'Harina', sku: 'HR-001', unidad_medida: 'kg',
        stock_actual: 5, stock_minimo: 20, stock_maximo: 100 },
    ]);
    // No hay mejor proveedor para este producto
    (provRepo.findMejorProveedorParaProducto as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null);

    // Simular que no hay lista previa → número será LC-000001
    mockTx.listaCompras.findFirst.mockResolvedValueOnce(null);
    mockTx.listaCompras.create.mockResolvedValueOnce({
      ...mockLista, items: [{ id: 1, id_producto: 1, cantidad_sugerida: 95 }],
    });

    prismaMock.alerta.create.mockResolvedValueOnce({});
    prismaMock.tipoAlerta.findFirst.mockResolvedValueOnce({ id: 2 });

    const result = await listaComprasService.generarAutomatico(1, { notas: 'Test', id_restaurante: 1 });

    expect(mockTx.listaCompras.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ numero_lista: 'LC-000001' }),
      })
    );
    expect(result.total_items).toBe(1);
  });

  it('incrementa número si ya existe lista previa', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: 2, nombre: 'Aceite', sku: 'AC-001', unidad_medida: 'L',
        stock_actual: 2, stock_minimo: 10, stock_maximo: 50 },
    ]);
    (provRepo.findMejorProveedorParaProducto as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id_proveedor: 3, precio_unitario: 5000 });

    mockTx.listaCompras.findFirst.mockResolvedValueOnce({ numero_lista: 'LC-000005' });
    mockTx.listaCompras.create.mockResolvedValueOnce({ ...mockLista, numero_lista: 'LC-000006' });

    prismaMock.alerta.create.mockResolvedValueOnce({});
    prismaMock.tipoAlerta.findFirst.mockResolvedValueOnce({ id: 2 });

    await listaComprasService.generarAutomatico(1, { id_restaurante: 1 });

    expect(mockTx.listaCompras.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ numero_lista: 'LC-000006' }),
      })
    );
  });
});

// ── cambiarEstado ─────────────────────────────────────────────────────────────

describe('cambiarEstado', () => {
  it('cambia de generada a enviada', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockLista);
    (repo.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...mockLista, estado: EstadoListaCompras.enviada,
    });

    const result = await listaComprasService.cambiarEstado(1, { estado: EstadoListaCompras.enviada });
    expect(result.estado).toBe(EstadoListaCompras.enviada);
  });

  it('lanza BadRequestError para transición inválida', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...mockLista, estado: EstadoListaCompras.recibida, // estado final
    });

    await expect(
      listaComprasService.cambiarEstado(1, { estado: EstadoListaCompras.generada })
    ).rejects.toThrow('No se puede cambiar de estado');
  });

  it('lanza NotFoundError si no existe', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(
      listaComprasService.cambiarEstado(99, { estado: EstadoListaCompras.enviada })
    ).rejects.toThrow('Lista de compras');
  });
});

// ── actualizarItem ────────────────────────────────────────────────────────────

describe('actualizarItem', () => {
  it('actualiza cantidad recibida de un item', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockLista);
    (repo.updateItem as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 1, cantidad_recibida: 15,
    });

    const result = await listaComprasService.actualizarItem(1, 1, { cantidad_recibida: 15 });
    expect(result.cantidad_recibida).toBe(15);
  });
});
