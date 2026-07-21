import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EstadoListaCompras, TipoMovimiento } from '@prisma/client';

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
    findAll:                        vi.fn(),
    findMejorProveedorParaProducto: vi.fn(),
  },
}));

vi.mock('../demanda.service', () => ({
  demandaService: {
    calcularDemandaSede: vi.fn(async () => new Map()),
  },
}));

vi.mock('../inventario.service', () => ({
  inventarioService: {
    registrarMovimiento: vi.fn(async () => ({ movimiento: { id: 1 } })),
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
    productoStock: { findMany: vi.fn() },
    movimiento:    { aggregate: vi.fn() },
    alerta:        { create: vi.fn() },
    tipoAlerta:    { findFirst: vi.fn() },
    restaurante:   { findFirst: vi.fn() },
  },
}));

// ── Imports DESPUÉS de los mocks ───────────────────────────────────────────────

import { listaComprasService }    from '../lista-compras.service';
import { listaComprasRepository }  from '../../repositories/lista-compras.repository';
import { proveedorRepository }     from '../../repositories/proveedor.repository';
import { demandaService }          from '../demanda.service';
import { inventarioService }       from '../inventario.service';
import prisma from '../../config/database';

const repo       = listaComprasRepository as ReturnType<typeof vi.fn> & typeof listaComprasRepository;
const provRepo   = proveedorRepository    as ReturnType<typeof vi.fn> & typeof proveedorRepository;
const demandaMock = demandaService as any;
const invMock     = inventarioService as any;
const prismaMock  = prisma as any;

const mockLista = {
  id: 1, numero_lista: 'LC-000001',
  estado: EstadoListaCompras.generada,
  id_restaurante: 1,
  id_usuario_generado: 7,
  notas: null, total_estimado: null,
  items: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  demandaMock.calcularDemandaSede.mockResolvedValue(new Map());
});

// ── listar ────────────────────────────────────────────────────────────────────

describe('listar', () => {
  it('devuelve resultado paginado', async () => {
    (repo.findAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([[mockLista], 1]);
    const result = await listaComprasService.listar({ page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });
});

// ── obtenerPorId (IDOR) ─────────────────────────────────────────────────────────

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

  it('oculta una lista de otra sede (IDOR): NotFound aunque exista', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...mockLista, id_restaurante: 2 });
    await expect(listaComprasService.obtenerPorId(1, 1)).rejects.toThrow('Lista de compras');
  });

  it('permite ver la lista de la sede activa', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...mockLista, id_restaurante: 1 });
    const result = await listaComprasService.obtenerPorId(1, 1);
    expect(result.id).toBe(1);
  });
});

// ── generarAutomatico ─────────────────────────────────────────────────────────

describe('generarAutomatico', () => {
  it('retorna mensaje si la sede no tiene productos con stock', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    const result = await listaComprasService.generarAutomatico(1, { id_restaurante: 1 });
    expect(result.mensaje).toContain('no tiene productos');
    expect(result.lista).toBeNull();
  });

  it('incluye producto bajo mínimo y lo lleva hasta el stock máximo', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: 1, nombre: 'Harina', sku: 'HR-001', unidad_medida: 'kg',
        stock_actual: 5, stock_minimo: 20, stock_maximo: 100 },
    ]);
    (provRepo.findMejorProveedorParaProducto as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    mockTx.listaCompras.findFirst.mockResolvedValueOnce(null);
    mockTx.listaCompras.create.mockResolvedValueOnce({
      ...mockLista, items: [{ id: 1, id_producto: 1, cantidad_sugerida: 95 }],
    });
    prismaMock.alerta.create.mockResolvedValueOnce({});
    prismaMock.tipoAlerta.findFirst.mockResolvedValueOnce({ id: 2 });

    const result = await listaComprasService.generarAutomatico(1, { notas: 'Test', id_restaurante: 1 });

    expect(mockTx.listaCompras.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ numero_lista: 'LC-000001' }) }),
    );
    // objetivo = max(stock_maximo 100, min*2.5=50) = 100 → pedir 100-5 = 95
    const items = mockTx.listaCompras.create.mock.calls[0][0].data.items.create;
    expect(items[0].cantidad_sugerida).toBe(95);
    expect(result.total_items).toBe(1);
  });

  it('incluye un producto agotado aunque no tenga stock mínimo', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: 3, nombre: 'Sal', sku: 'SL-001', unidad_medida: 'kg',
        stock_actual: 0, stock_minimo: 0, stock_maximo: null },
    ]);
    // La tendencia sugiere un stock ideal de 10
    demandaMock.calcularDemandaSede.mockResolvedValueOnce(new Map([
      [3, { id_producto: 3, consumo_total: 20, consumo_diario: 0.7, consumo_reciente: 1, tendencia: 'subiendo', stock_ideal: 10 }],
    ]));
    (provRepo.findMejorProveedorParaProducto as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    mockTx.listaCompras.findFirst.mockResolvedValueOnce(null);
    mockTx.listaCompras.create.mockResolvedValueOnce({ ...mockLista });
    prismaMock.tipoAlerta.findFirst.mockResolvedValueOnce({ id: 2 });

    const result = await listaComprasService.generarAutomatico(1, { id_restaurante: 1 });
    const items = mockTx.listaCompras.create.mock.calls[0][0].data.items.create;
    expect(items[0].cantidad_sugerida).toBe(10);       // objetivo 10 - stock 0
    expect(items[0].observaciones).toContain('Agotado');
    expect(result.total_items).toBe(1);
  });

  it('ignora un producto con stock suficiente', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: 4, nombre: 'Azúcar', sku: 'AZ-001', unidad_medida: 'kg',
        stock_actual: 100, stock_minimo: 10, stock_maximo: 50 },
    ]);
    const result = await listaComprasService.generarAutomatico(1, { id_restaurante: 1 });
    expect(result.lista).toBeNull();
    expect(result.mensaje).toContain('No hay productos que necesiten reposición');
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
    prismaMock.tipoAlerta.findFirst.mockResolvedValueOnce({ id: 2 });

    await listaComprasService.generarAutomatico(1, { id_restaurante: 1 });

    expect(mockTx.listaCompras.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ numero_lista: 'LC-000006' }) }),
    );
  });
});

// ── crearManual ─────────────────────────────────────────────────────────────────

describe('crearManual', () => {
  it('crea la lista cuando todos los productos son de la sede', async () => {
    prismaMock.productoStock.findMany.mockResolvedValueOnce([{ id_producto: 1 }, { id_producto: 2 }]);
    mockTx.listaCompras.findFirst.mockResolvedValueOnce(null);
    mockTx.listaCompras.create.mockResolvedValueOnce({ ...mockLista });
    prismaMock.tipoAlerta.findFirst.mockResolvedValueOnce({ id: 2 });

    const result = await listaComprasService.crearManual(7, {
      id_restaurante: 1,
      items: [
        { id_producto: 1, cantidad_sugerida: 10, precio_estimado: 2000 },
        { id_producto: 2, cantidad_sugerida: 5 },
      ],
    });
    expect(result.total_items).toBe(2);
  });

  it('rechaza productos que no pertenecen a la sede', async () => {
    prismaMock.productoStock.findMany.mockResolvedValueOnce([{ id_producto: 1 }]); // falta el 2
    await expect(listaComprasService.crearManual(7, {
      id_restaurante: 1,
      items: [
        { id_producto: 1, cantidad_sugerida: 10 },
        { id_producto: 2, cantidad_sugerida: 5 },
      ],
    })).rejects.toThrow('fuera de esta sede');
  });
});

// ── cambiarEstado + recepción al inventario ──────────────────────────────────────

describe('cambiarEstado', () => {
  it('cambia de generada a enviada sin tocar inventario', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockLista);
    (repo.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...mockLista, estado: EstadoListaCompras.enviada });

    const result = await listaComprasService.cambiarEstado(1, { estado: EstadoListaCompras.enviada });
    expect(result.estado).toBe(EstadoListaCompras.enviada);
    expect(invMock.registrarMovimiento).not.toHaveBeenCalled();
  });

  it('al recibir, ingresa al inventario la cantidad recibida no ingresada aún', async () => {
    const listaEnviada = {
      ...mockLista, estado: EstadoListaCompras.enviada,
      items: [{ id: 10, id_producto: 1, id_proveedor_sugerido: 3, cantidad_recibida: 8 }],
    };
    // obtenerPorId (dentro de cambiarEstado) y luego _ingresarRecepcion vuelven a leer
    (repo.findById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(listaEnviada)   // obtenerPorId
      .mockResolvedValueOnce(listaEnviada);  // _ingresarRecepcion
    prismaMock.movimiento.aggregate.mockResolvedValueOnce({ _sum: { cantidad: 0 } }); // nada ingresado aún
    (repo.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...listaEnviada, estado: EstadoListaCompras.recibida });

    await listaComprasService.cambiarEstado(1, { estado: EstadoListaCompras.recibida });

    expect(invMock.registrarMovimiento).toHaveBeenCalledWith(expect.objectContaining({
      id_producto:     1,
      id_restaurante:  1,
      tipo_movimiento: TipoMovimiento.entrada,
      cantidad:        8,
      referencia:      'LC:1:item:10',
    }));
  });

  it('recepción idempotente: no re-ingresa lo ya ingresado (parcial → recibida)', async () => {
    const lista = {
      ...mockLista, estado: EstadoListaCompras.parcial,
      items: [{ id: 10, id_producto: 1, id_proveedor_sugerido: 3, cantidad_recibida: 8 }],
    };
    (repo.findById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(lista)
      .mockResolvedValueOnce(lista);
    prismaMock.movimiento.aggregate.mockResolvedValueOnce({ _sum: { cantidad: 8 } }); // ya se ingresaron 8
    (repo.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...lista, estado: EstadoListaCompras.recibida });

    await listaComprasService.cambiarEstado(1, { estado: EstadoListaCompras.recibida });
    expect(invMock.registrarMovimiento).not.toHaveBeenCalled();
  });

  it('lanza BadRequestError para transición inválida', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...mockLista, estado: EstadoListaCompras.recibida });
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
  it('actualiza cantidad recibida de un item de la lista', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...mockLista, items: [{ id: 1 }] });
    (repo.updateItem as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1, cantidad_recibida: 15 });

    const result = await listaComprasService.actualizarItem(1, 1, { cantidad_recibida: 15 });
    expect(result.cantidad_recibida).toBe(15);
  });

  it('rechaza un item que no pertenece a la lista', async () => {
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...mockLista, items: [{ id: 1 }] });
    await expect(listaComprasService.actualizarItem(1, 999, { cantidad_recibida: 5 }))
      .rejects.toThrow('Item de la lista');
  });
});
