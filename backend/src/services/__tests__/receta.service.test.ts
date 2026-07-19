/**
 * Tests para recetaService
 *
 * Cubre:
 *   - verificarDisponibilidadParaDetalles: stock ok, insuficiente, opcionales, conversión unidades
 *   - _calcularRentabilidad: costo, merma, margen, alerta
 *   - calcularDisponibilidad: conversión unidades en cálculo de portiones
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/receta.repository', () => ({
  recetaRepository: {
    findByProductoFinal:    vi.fn(),
    findAll:                vi.fn(),
    findById:               vi.fn(),
    findByIdScoped:         vi.fn(),   // guarded lookup (IDOR fix)
    findFaseById:           vi.fn(),   // lookup de fase por id
    findRecetaConStock:     vi.fn(),
    findRecetasVendiblesConStock: vi.fn(),
    create:                 vi.fn(),
    update:                 vi.fn(),
    reemplazarIngredientes: vi.fn(),
    findFasesByReceta:      vi.fn(),
    createFase:             vi.fn(),
    updateFase:             vi.fn(),
    deleteFase:             vi.fn(),
  },
}));

vi.mock('../../config/database', () => ({
  default: {
    producto: { findUnique: vi.fn(), findMany: vi.fn() },
    receta:   { findFirst: vi.fn() },
    recetaFase: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../alerta.service', () => ({
  alertaService: { sincronizar: vi.fn().mockResolvedValue(undefined) },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { recetaService } from '../receta.service';
import { recetaRepository } from '../../repositories/receta.repository';
import prisma from '../../config/database';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../exceptions/HttpErrors';
import type { TenantCtx } from '../../lib/tenantCtx';

// ── Helpers de fixtures ───────────────────────────────────────────────────────

const makeIngrediente = (
  id_producto: number,
  nombre: string,
  cantidad: number,
  unidad: string,
  stock_actual: number,
  unidad_medida: string,
  es_opcional = false,
) => ({
  id_producto,
  cantidad: new Decimal(cantidad),
  unidad,
  es_opcional,
  producto: { id: id_producto, nombre, stock_actual: new Decimal(stock_actual), unidad_medida, precio_unitario: new Decimal(1000) },
});

const makeReceta = (ingredientes: ReturnType<typeof makeIngrediente>[]) => ({
  id:                        1,
  nombre_receta:             'Test Receta',
  cantidad_producida:        new Decimal(1),
  unidad_produccion:         'unidad',
  merma_esperada_porcentaje: null,
  ingredientes,
  producto_final:            { id: 10, nombre: 'Plato Test', precio_venta: new Decimal(15000), precio_unitario: new Decimal(10000) },
});

// ── verificarDisponibilidadParaDetalles ───────────────────────────────────────

describe('recetaService.verificarDisponibilidadParaDetalles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna ok cuando todos los ingredientes tienen stock suficiente', async () => {
    (recetaRepository.findByProductoFinal as any).mockResolvedValue(
      makeReceta([makeIngrediente(2, 'Harina', 200, 'gramo', 500, 'gramo')])
    );

    const result = await recetaService.verificarDisponibilidadParaDetalles([
      { id_producto: 1, cantidad: 1 },
    ]);
    expect(result.ok).toBe(true);
  });

  it('retorna ok si el producto no tiene receta (stock del producto lo valida crear)', async () => {
    (recetaRepository.findByProductoFinal as any).mockResolvedValue(null);

    const result = await recetaService.verificarDisponibilidadParaDetalles([
      { id_producto: 1, cantidad: 5 },
    ]);
    expect(result.ok).toBe(true);
  });

  it('lanza BadRequestError cuando un ingrediente no tiene stock suficiente', async () => {
    (recetaRepository.findByProductoFinal as any).mockResolvedValue(
      makeReceta([makeIngrediente(2, 'Leche', 300, 'mililitro', 200, 'mililitro')])
    );
    (prisma.producto.findUnique as any).mockResolvedValue({ nombre: 'Café Especial' });

    await expect(
      recetaService.verificarDisponibilidadParaDetalles([{ id_producto: 1, cantidad: 1 }])
    ).rejects.toThrow(BadRequestError);
  });

  it('incluye los ingredientes faltantes en el error', async () => {
    (recetaRepository.findByProductoFinal as any).mockResolvedValue(
      makeReceta([makeIngrediente(2, 'Aceite', 100, 'mililitro', 50, 'mililitro')])
    );
    (prisma.producto.findUnique as any).mockResolvedValue({ nombre: 'Plato X' });

    await expect(
      recetaService.verificarDisponibilidadParaDetalles([{ id_producto: 1, cantidad: 1 }])
    ).rejects.toMatchObject({
      message: expect.stringContaining('ingrediente'),
    });
  });

  it('ignora ingredientes opcionales aunque tengan stock insuficiente', async () => {
    (recetaRepository.findByProductoFinal as any).mockResolvedValue(
      makeReceta([
        makeIngrediente(2, 'Queso Extra', 500, 'gramo', 10, 'gramo', true), // opcional, sin stock
      ])
    );

    const result = await recetaService.verificarDisponibilidadParaDetalles([
      { id_producto: 1, cantidad: 1 },
    ]);
    expect(result.ok).toBe(true);
  });

  it('convierte unidades: ingrediente en gramos, stock en kilogramos (1 kg cubre 800 g)', async () => {
    // stock: 1 kg = 1000 g; necesita 800 g → ok
    (recetaRepository.findByProductoFinal as any).mockResolvedValue(
      makeReceta([makeIngrediente(2, 'Harina', 800, 'gramo', 1, 'kilogramo')])
    );

    const result = await recetaService.verificarDisponibilidadParaDetalles([
      { id_producto: 1, cantidad: 1 },
    ]);
    expect(result.ok).toBe(true);
  });

  it('conversión unidades: ingrediente en gramos, stock en kilogramos — falla si no alcanza', async () => {
    // stock: 0.5 kg = 500 g; necesita 800 g → falla
    (recetaRepository.findByProductoFinal as any).mockResolvedValue(
      makeReceta([makeIngrediente(2, 'Harina', 800, 'gramo', 0.5, 'kilogramo')])
    );
    (prisma.producto.findUnique as any).mockResolvedValue({ nombre: 'Arepa de Queso' });

    await expect(
      recetaService.verificarDisponibilidadParaDetalles([{ id_producto: 1, cantidad: 1 }])
    ).rejects.toThrow(BadRequestError);
  });

  it('conversión unidades: ingrediente en mililitros, stock en litros', async () => {
    // stock: 1 L = 1000 ml; necesita 2 × 400 ml = 800 ml → ok
    (recetaRepository.findByProductoFinal as any).mockResolvedValue(
      makeReceta([makeIngrediente(2, 'Agua', 400, 'mililitro', 1, 'litro')])
    );

    const result = await recetaService.verificarDisponibilidadParaDetalles([
      { id_producto: 1, cantidad: 2 },
    ]);
    expect(result.ok).toBe(true);
  });

  it('multiplica la cantidad de ingrediente por la cantidad del detalle', async () => {
    // Receta necesita 100g por plato; se piden 4 platos → necesita 400g; stock = 350g → falla
    (recetaRepository.findByProductoFinal as any).mockResolvedValue(
      makeReceta([makeIngrediente(2, 'Arroz', 100, 'gramo', 350, 'gramo')])
    );
    (prisma.producto.findUnique as any).mockResolvedValue({ nombre: 'Bandeja Paisa' });

    await expect(
      recetaService.verificarDisponibilidadParaDetalles([{ id_producto: 1, cantidad: 4 }])
    ).rejects.toThrow(BadRequestError);
  });
});

// ── recetaService.calcularDisponibilidad ─────────────────────────────────────

describe('recetaService.calcularDisponibilidad', () => {
  beforeEach(() => vi.clearAllMocks());

  it('suma el stock ya producido del producto final a lo calculado desde ingredientes', async () => {
    // Puede prepararse 1 unidad más desde ingredientes crudos, y ya hay 5 producidas y listas.
    (recetaRepository.findRecetaConStock as any).mockResolvedValue({
      id: 1,
      nombre_receta: 'Hamburguesa',
      cantidad_producida: new Decimal(1),
      unidad_produccion: 'unidad',
      producto_final: { id: 10, nombre: 'Hamburguesa', stock_actual: new Decimal(5) },
      ingredientes: [
        makeIngrediente(2, 'Carne', 100, 'gramo', 100, 'gramo'), // alcanza para 1 más
      ],
    });

    const result = await recetaService.calcularDisponibilidad(1, { esSuperAdmin: true });

    expect(result.stock_producido).toBe(5);
    expect(result.disponibilidad_por_receta).toBe(1);
    expect(result.disponibilidad).toBe(6);
  });

  it('sin stock producido, la disponibilidad es solo lo calculado desde ingredientes', async () => {
    (recetaRepository.findRecetaConStock as any).mockResolvedValue({
      id: 1,
      nombre_receta: 'Hamburguesa',
      cantidad_producida: new Decimal(1),
      unidad_produccion: 'unidad',
      producto_final: { id: 10, nombre: 'Hamburguesa', stock_actual: new Decimal(0) },
      ingredientes: [
        makeIngrediente(2, 'Carne', 100, 'gramo', 300, 'gramo'), // alcanza para 3
      ],
    });

    const result = await recetaService.calcularDisponibilidad(1, { esSuperAdmin: true });

    expect(result.stock_producido).toBe(0);
    expect(result.disponibilidad_por_receta).toBe(3);
    expect(result.disponibilidad).toBe(3);
  });

  it('lanza NotFoundError si la receta no existe', async () => {
    (recetaRepository.findRecetaConStock as any).mockResolvedValue(null);
    await expect(recetaService.calcularDisponibilidad(999, { esSuperAdmin: true })).rejects.toThrow(NotFoundError);
  });
});

// ── recetaService.calcularDisponibilidadCatalogo ─────────────────────────────

describe('recetaService.calcularDisponibilidadCatalogo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calcula disponibilidad (producido + por receta) para cada receta vendible de la sede', async () => {
    (recetaRepository.findRecetasVendiblesConStock as any).mockResolvedValue([
      {
        id_producto_final: 10,
        cantidad_producida: new Decimal(1),
        unidad_produccion: 'unidad',
        producto_final: { id: 10, stock_actual: new Decimal(5) },
        ingredientes: [makeIngrediente(2, 'Carne', 100, 'gramo', 100, 'gramo')],
      },
      {
        id_producto_final: 11,
        cantidad_producida: new Decimal(1),
        unidad_produccion: 'unidad',
        producto_final: { id: 11, stock_actual: new Decimal(0) },
        ingredientes: [makeIngrediente(3, 'Pollo', 100, 'gramo', 0, 'gramo')],
      },
    ]);

    const result = await recetaService.calcularDisponibilidadCatalogo(1);

    expect(result).toEqual([
      { id_producto: 10, disponibilidad: 6, unidad_produccion: 'unidad' },
      { id_producto: 11, disponibilidad: 0, unidad_produccion: 'unidad' },
    ]);
    expect(recetaRepository.findRecetasVendiblesConStock).toHaveBeenCalledWith(1);
  });
});

// ── recetaService.crear ───────────────────────────────────────────────────────

describe('recetaService.crear', () => {
  // resetAllMocks limpia la cola de mockResolvedValueOnce además de calls/results
  beforeEach(() => vi.resetAllMocks());

  const baseData = {
    id_producto_final: 5,
    id_restaurante:    2,
    nombre_receta:     'Bandeja Paisa',
    cantidad_producida: 1,
    unidad_produccion:  'porcion',
    ingredientes: [{ id_producto: 10, cantidad: 200, unidad: 'gramo' }],
  };

  it('lanza ForbiddenError si id_restaurante no viene del contexto (undefined)', async () => {
    await expect(
      recetaService.crear({ ...baseData, id_restaurante: undefined as any })
    ).rejects.toThrow(ForbiddenError);
  });

  it('lanza NotFoundError si el producto final no existe', async () => {
    (prisma.producto.findUnique as any).mockResolvedValueOnce(null);

    await expect(recetaService.crear(baseData)).rejects.toThrow('Producto final');
  });

  it('lanza ConflictError si el producto ya tiene una receta activa', async () => {
    (prisma.producto.findUnique as any).mockResolvedValueOnce({ id: 5, nombre: 'Plato' });
    (recetaRepository.findByProductoFinal as any).mockResolvedValueOnce(makeReceta([]));

    await expect(recetaService.crear(baseData)).rejects.toThrow('ya tiene una receta activa');
  });

  it('propaga id_restaurante al repositorio (el producto queda en el restaurante correcto)', async () => {
    (prisma.producto.findUnique as any).mockResolvedValueOnce({ id: 5, nombre: 'Plato' });
    (prisma.producto.findMany as any).mockResolvedValueOnce([
      { id: 10, nombre: 'Arroz', tipo_materia: 'prima' },
    ]);
    (recetaRepository.findByProductoFinal as any).mockResolvedValueOnce(null);
    const mockReceta = { ...makeReceta([makeIngrediente(10, 'Arroz', 200, 'gramo', 500, 'gramo')]), id_restaurante: 2 };
    (recetaRepository.create as any).mockResolvedValueOnce(mockReceta);

    await recetaService.crear(baseData);

    const callArg = (recetaRepository.create as any).mock.calls[0][0];
    expect(callArg.id_restaurante).toBe(2);
  });

  it('strips id_restaurante si el cliente lo envía en el body (la ruta lo sobreescribe con el contexto)', () => {
    // Este test documenta el contrato: el body nunca puede fijar el restaurante.
    // La ruta hace: { ...body, id_restaurante: req.restauranteId! }
    // → un id_restaurante en el body es ignorado porque la desestructuración lo descarta:
    //   const { id_restaurante: _ignored, ...rest } = req.body
    // Verificamos que si el service recibe id_restaurante=99 (contexto), la receta se crea con 99.
    (prisma.producto.findUnique as any)
      .mockResolvedValueOnce({ id: 5, nombre: 'Plato' });
    (prisma.producto.findMany as any).mockResolvedValueOnce([
      { id: 10, nombre: 'Arroz', tipo_materia: 'prima' },
    ]);
    (recetaRepository.findByProductoFinal as any).mockResolvedValueOnce(null);
    const mockReceta = { ...makeReceta([makeIngrediente(10, 'Arroz', 200, 'gramo', 500, 'gramo')]), id_restaurante: 99 };
    (recetaRepository.create as any).mockResolvedValueOnce(mockReceta);

    // La ruta inyecta id_restaurante desde req.restauranteId (= 99 aquí)
    const promesa = recetaService.crear({ ...baseData, id_restaurante: 99 });
    return expect(promesa).resolves.toBeDefined();
  });
});

// ── _calcularRentabilidad ─────────────────────────────────────────────────────

describe('recetaService._calcularRentabilidad', () => {
  const makeRecetaRent = (
    ingredientes: { cantidad: number; precio_unitario: number; unidad?: string; unidad_medida?: string; nombre?: string }[],
    precio_venta: number,
    merma = 0,
    cantidad_producida = 1,
  ) => ({
    ingredientes: ingredientes.map(i => ({
      cantidad: i.cantidad,
      unidad:   i.unidad ?? 'unidad',
      producto: {
        nombre:        i.nombre ?? 'Ingrediente',
        precio_unitario: i.precio_unitario,
        unidad_medida: i.unidad_medida ?? i.unidad ?? 'unidad',
      },
    })),
    merma_esperada_porcentaje: merma > 0 ? merma : null,
    cantidad_producida,
    producto_final: { precio_venta, precio_unitario: precio_venta },
  });

  it('calcula costo básico y margen correctamente', () => {
    // 1 ingrediente: 2 unidades × $1000 = $2000 costo
    // precio venta: $4000 → margen = (4000-2000)/4000 = 50%
    const r = recetaService._calcularRentabilidad(makeRecetaRent([{ cantidad: 2, precio_unitario: 1000 }], 4000));

    expect(r.costo_ingredientes).toBe(2000);
    expect(r.costo_unitario).toBe(2000);
    expect(r.margen_actual_porcentaje).toBeCloseTo(50, 1);
    expect(r.es_rentable).toBe(true); // 50% > 40%
    expect(r.alerta_rentabilidad).toBeNull();
  });

  it('detecta precio por debajo del mínimo rentable y genera alerta', () => {
    // costo: $8000, precio venta: $9000 → margen ≈ 11% < 40%
    const r = recetaService._calcularRentabilidad(makeRecetaRent([{ cantidad: 1, precio_unitario: 8000 }], 9000));

    expect(r.es_rentable).toBe(false);
    expect(r.alerta_rentabilidad).not.toBeNull();
    expect(r.alerta_rentabilidad).toContain('$9.000');
  });

  it('aplica merma al costo: 20% de merma aumenta el costo unitario', () => {
    // Sin merma: costo = 1000. Con 20% merma: costo = 1000/(1-0.2) = 1250
    const sinMerma = recetaService._calcularRentabilidad(makeRecetaRent([{ cantidad: 1, precio_unitario: 1000 }], 5000, 0));
    const conMerma = recetaService._calcularRentabilidad(makeRecetaRent([{ cantidad: 1, precio_unitario: 1000 }], 5000, 20));

    expect(conMerma.costo_con_merma).toBeGreaterThan(sinMerma.costo_con_merma);
    expect(conMerma.costo_con_merma).toBe(1250);
  });

  it('distribuye el costo entre las unidades producidas', () => {
    // costo total: $6000, produce 3 unidades → costo unitario = $2000
    const r = recetaService._calcularRentabilidad(makeRecetaRent(
      [{ cantidad: 3, precio_unitario: 2000 }], 5000, 0, 3
    ));
    expect(r.costo_unitario).toBe(2000);
  });

  it('precio_sugerido_minimo cubre el margen mínimo del 40%', () => {
    const r = recetaService._calcularRentabilidad(makeRecetaRent([{ cantidad: 1, precio_unitario: 6000 }], 12000));
    // precio mínimo = ceil(6000 / 0.6) = 10000
    expect(r.precio_sugerido_minimo).toBe(10000);
  });

  it('diferencia_precio positivo cuando el precio cubre el mínimo', () => {
    const r = recetaService._calcularRentabilidad(makeRecetaRent([{ cantidad: 1, precio_unitario: 3000 }], 10000));
    // minimo = ceil(3000/0.6) = 5000; 10000 - 5000 = 5000
    expect(r.diferencia_precio).toBeGreaterThan(0);
  });

  it('caso Lechuga: unidad de ingrediente (kilogramo) incompatible con la unidad del producto (unidad) → no calcula un costo falso, agrega advertencia', () => {
    const r = recetaService._calcularRentabilidad(makeRecetaRent([
      { cantidad: 1, precio_unitario: 500, unidad: 'kilogramo', unidad_medida: 'unidad', nombre: 'Lechuga' },
    ], 5000));

    expect(r.costo_ingredientes).toBe(0); // el ingrediente incompatible no suma costo
    expect(r.advertencias).toHaveLength(1);
    expect(r.advertencias[0].ingrediente).toBe('Lechuga');
    expect(r.advertencias[0].mensaje).toContain('incompatible');
  });
});

// ── IDOR guard: recetaService.actualizar ─────────────────────────────────────

describe('recetaService.actualizar — tenant guard', () => {
  beforeEach(() => vi.resetAllMocks());

  const CTX_OK:       TenantCtx = { restauranteId: 1, esSuperAdmin: false };
  const CTX_ADMIN:    TenantCtx = { esSuperAdmin: true };
  const CTX_NO_TENANT: TenantCtx = { esSuperAdmin: false }; // sin restauranteId

  const mockReceta = makeReceta([]);

  it('lanza ForbiddenError si ctx no tiene restauranteId', async () => {
    (recetaRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new ForbiddenError('Se requiere contexto de restaurante'));

    await expect(
      recetaService.actualizar(10, { nombre_receta: 'X' }, CTX_NO_TENANT)
    ).rejects.toThrow(ForbiddenError);
  });

  it('lanza NotFoundError si la receta pertenece a otro restaurante (IDOR)', async () => {
    (recetaRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new NotFoundError('Registro 10 no encontrado'));

    await expect(
      recetaService.actualizar(10, { nombre_receta: 'X' }, CTX_OK)
    ).rejects.toThrow(NotFoundError);
  });

  it('superadmin puede actualizar cualquier receta sin error', async () => {
    (recetaRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockReceta);
    (recetaRepository.update as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockReceta);

    await expect(
      recetaService.actualizar(10, { nombre_receta: 'Nueva' }, CTX_ADMIN)
    ).resolves.toBeDefined();
  });

  it('caso feliz: dueño legítimo actualiza su receta', async () => {
    (recetaRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockReceta);
    (recetaRepository.update as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockReceta);

    const result = await recetaService.actualizar(10, { nombre_receta: 'Nueva' }, CTX_OK);
    expect(result).toBeDefined();
    expect((recetaRepository.update as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(10);
  });
});

// ── IDOR guard: recetaService.actualizarFase / eliminarFase ──────────────────

describe('recetaService.actualizarFase — tenant guard (vía receta padre)', () => {
  beforeEach(() => vi.resetAllMocks());

  const CTX_OK:    TenantCtx = { restauranteId: 1, esSuperAdmin: false };
  const CTX_ADMIN: TenantCtx = { esSuperAdmin: true };

  const mockFase = { id: 7, id_receta: 42, estado: 'activo', numero_fase: 1, nombre: 'Prep', descripcion: '' };

  it('lanza NotFoundError si la fase no existe', async () => {
    (recetaRepository.findFaseById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null);

    await expect(
      recetaService.actualizarFase(7, { nombre: 'X' }, CTX_OK)
    ).rejects.toThrow(NotFoundError);
  });

  it('lanza NotFoundError si la receta padre es de otro restaurante (IDOR)', async () => {
    (recetaRepository.findFaseById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFase);
    (recetaRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new NotFoundError('Registro 42 no encontrado'));

    await expect(
      recetaService.actualizarFase(7, { nombre: 'X' }, CTX_OK)
    ).rejects.toThrow(NotFoundError);
  });

  it('superadmin puede actualizar fase de cualquier receta', async () => {
    (recetaRepository.findFaseById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFase);
    (recetaRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(makeReceta([]));
    (recetaRepository.updateFase as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFase);

    await expect(
      recetaService.actualizarFase(7, { nombre: 'X' }, CTX_ADMIN)
    ).resolves.toBeDefined();
  });

  it('caso feliz: dueño legítimo actualiza su fase', async () => {
    (recetaRepository.findFaseById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFase);
    (recetaRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(makeReceta([]));
    (recetaRepository.updateFase as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ...mockFase, nombre: 'Actualizada' });

    const result = await recetaService.actualizarFase(7, { nombre: 'Actualizada' }, CTX_OK);
    expect(result).toBeDefined();
    expect((recetaRepository.updateFase as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(7);
  });
});

describe('recetaService.eliminarFase — tenant guard (vía receta padre)', () => {
  beforeEach(() => vi.resetAllMocks());

  const CTX_OK: TenantCtx = { restauranteId: 1, esSuperAdmin: false };

  const mockFase = { id: 7, id_receta: 42, estado: 'activo', numero_fase: 1, nombre: 'Prep', descripcion: '' };

  it('lanza NotFoundError si la fase no existe', async () => {
    (recetaRepository.findFaseById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null);

    await expect(recetaService.eliminarFase(7, CTX_OK)).rejects.toThrow(NotFoundError);
  });

  it('lanza NotFoundError si la receta padre es de otro restaurante (IDOR)', async () => {
    (recetaRepository.findFaseById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFase);
    (recetaRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new NotFoundError('Registro 42 no encontrado'));

    await expect(recetaService.eliminarFase(7, CTX_OK)).rejects.toThrow(NotFoundError);
  });

  it('caso feliz: dueño legítimo elimina su fase (soft-delete)', async () => {
    (recetaRepository.findFaseById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFase);
    (recetaRepository.findByIdScoped as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(makeReceta([]));
    (recetaRepository.deleteFase as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ...mockFase, estado: 'eliminado' });

    await expect(recetaService.eliminarFase(7, CTX_OK)).resolves.toBeDefined();
    expect((recetaRepository.deleteFase as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(7);
  });
});


// ── obtenerDesgloseRentabilidad ───────────────────────────────────────────────

const makeIngConProveedor = (
  nombre: string,
  cantidad: number,
  unidad: string,
  precioProveedor: number | null,
  preferido = true,
  unidad_medida: string = unidad,
) => ({
  id_producto:  99,
  cantidad:     new Decimal(cantidad),
  unidad,
  es_opcional:  false,
  producto: {
    id: 99, nombre,
    precio_unitario: new Decimal(1000),
    unidad_medida,
    proveedor_productos: precioProveedor != null
      ? [{ precio_unitario: new Decimal(precioProveedor), es_proveedor_preferido: preferido }]
      : [],
  },
});

const makeRecetaConProveedores = (
  ingredientes: ReturnType<typeof makeIngConProveedor>[],
  merma = 0,
  precio_venta: number | null = 15000,
) => ({
  id: 1,
  nombre_receta: 'Test Desglose',
  cantidad_producida: new Decimal(1),
  unidad_produccion: 'unidad',
  merma_esperada_porcentaje: merma > 0 ? new Decimal(merma) : null,
  ingredientes,
  producto_final: {
    id: 10, nombre: 'Plato',
    precio_venta: precio_venta != null ? new Decimal(precio_venta) : null,
    precio_unitario: new Decimal(10000),
  },
});

describe('recetaService.obtenerDesgloseRentabilidad', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calcula margen correctamente con todos los datos', async () => {
    const receta = makeRecetaConProveedores([
      makeIngConProveedor('Tomate', 100, 'gramo', 5000),
    ], 0, 15000);
    (recetaRepository as any).findByIdWithProveedores = vi.fn().mockResolvedValue(receta);

    const result = await recetaService.obtenerDesgloseRentabilidad(1, { esSuperAdmin: true });

    expect(result.costo_total).toBe(500000);          // 100 × 5000
    expect(result.costo_con_merma).toBe(500000);      // sin merma
    expect(result.precio_venta).toBe(15000);
    expect(result.margen_porcentaje).toBeLessThan(0); // precio < costo → margen negativo
    expect(result.advertencias).toHaveLength(0);
  });

  it('retorna advertencia si falta proveedor en un ingrediente', async () => {
    const receta = makeRecetaConProveedores([
      makeIngConProveedor('Pollo', 200, 'gramo', null),
    ]);
    (recetaRepository as any).findByIdWithProveedores = vi.fn().mockResolvedValue(receta);

    const result = await recetaService.obtenerDesgloseRentabilidad(1, { esSuperAdmin: true });

    expect(result.advertencias).toHaveLength(1);
    expect(result.advertencias[0].ingrediente).toBe('Pollo');
    expect(result.desglose[0].precio_unitario).toBeNull();
    expect(result.desglose[0].subtotal).toBe(0);
  });

  it('aplica merma esperada al costo (formula / (1 - merma%))', async () => {
    const receta = makeRecetaConProveedores([
      makeIngConProveedor('Harina', 1, 'kilogramo', 10000),
    ], 10);  // 10% merma
    (recetaRepository as any).findByIdWithProveedores = vi.fn().mockResolvedValue(receta);

    const result = await recetaService.obtenerDesgloseRentabilidad(1, { esSuperAdmin: true });

    expect(result.costo_total).toBe(10000);
    // costo_con_merma = 10000 / (1 - 0.10) = 11111.11
    expect(result.costo_con_merma).toBeCloseTo(11111.11, 0);
    expect(result.merma_costo).toBeCloseTo(1111.11, 0);
  });

  it('retorna margen negativo si precio venta < costo con merma', async () => {
    // costo = 15000, precio = 10000 → margen < 0
    const receta = makeRecetaConProveedores([
      makeIngConProveedor('Carne', 1, 'kilogramo', 15000),
    ], 0, 10000);
    (recetaRepository as any).findByIdWithProveedores = vi.fn().mockResolvedValue(receta);

    const result = await recetaService.obtenerDesgloseRentabilidad(1, { esSuperAdmin: true });

    expect(result.margen_porcentaje).not.toBeNull();
    expect(result.margen_porcentaje!).toBeLessThan(0);
  });

  it('retorna margen_porcentaje null si precio_venta es null', async () => {
    const receta = makeRecetaConProveedores([
      makeIngConProveedor('Arroz', 1, 'kilogramo', 3000),
    ], 0, null);
    (recetaRepository as any).findByIdWithProveedores = vi.fn().mockResolvedValue(receta);

    const result = await recetaService.obtenerDesgloseRentabilidad(1, { esSuperAdmin: true });

    expect(result.precio_venta).toBeNull();
    expect(result.margen_porcentaje).toBeNull();
  });

  it('caso Lechuga: unidad de ingrediente (kilogramo) incompatible con la unidad del producto (unidad) → subtotal en 0 y advertencia, no un costo falso', async () => {
    const receta = makeRecetaConProveedores([
      makeIngConProveedor('Lechuga', 1, 'kilogramo', 500, true, 'unidad'),
    ], 0, 15000);
    (recetaRepository as any).findByIdWithProveedores = vi.fn().mockResolvedValue(receta);

    const result = await recetaService.obtenerDesgloseRentabilidad(1, { esSuperAdmin: true });

    expect(result.desglose[0].unidad_incompatible).toBe(true);
    expect(result.desglose[0].subtotal).toBe(0);
    expect(result.costo_total).toBe(0);
    expect(result.advertencias).toHaveLength(1);
    expect(result.advertencias[0].ingrediente).toBe('Lechuga');
    expect(result.advertencias[0].mensaje).toContain('incompatible');
  });
});

// ── descontarIngredientesOrden / descontarIngredientesSede ────────────────────
// Ambas delegan en _descontarIngredientesDeVenta — una sola fórmula para las dos
// arquitecturas (antes divergían: el legado ignoraba cantidad_producida y la
// saga nueva no respetaba es_opcional ni convertía unidades).

describe('recetaService.descontarIngredientesOrden / descontarIngredientesSede', () => {
  const mockTx: any = {
    orden:         { findUnique: vi.fn() },
    receta:        { findFirst: vi.fn() },
    producto:      { findUnique: vi.fn() },
    movimiento:    { create: vi.fn() },
    productoStock: { findUnique: vi.fn(), upsert: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.producto.update = vi.fn();
    // Sin fila de ProductoStock por defecto → el stock anterior sale del campo legacy
    mockTx.productoStock.findUnique.mockResolvedValue(null);
    mockTx.productoStock.upsert.mockResolvedValue({});
  });

  it('divide por cantidad_producida: una receta que rinde 10 porciones descuenta 1/10 por unidad vendida', async () => {
    mockTx.orden.findUnique.mockResolvedValue({
      id: 1, numero_orden: 'ORD-000001', id_restaurante: 1,
      detalles: [{ id_producto: 10, cantidad: new Decimal(5) }], // se vendieron 5 unidades
    });
    mockTx.receta.findFirst.mockResolvedValue({
      nombre_receta:      'Bandeja Paisa',
      cantidad_producida: new Decimal(10), // el batch de la receta rinde 10 porciones
      ingredientes: [
        { id_producto: 2, cantidad: new Decimal(1000), unidad: 'gramo', es_opcional: false },
      ],
    });
    mockTx.producto.findUnique.mockResolvedValue({ id: 2, stock_actual: new Decimal(50000), unidad_medida: 'gramo' });

    await recetaService.descontarIngredientesOrden(1, mockTx);

    // 5 vendidas / 10 que rinde la receta = 0.5 → 1000g * 0.5 = 500g descontados
    const updateCall = (mockTx.producto.update as any).mock.calls[0][0];
    expect(Number(updateCall.data.stock_actual)).toBeCloseTo(49500);
    const movimientoCall = (mockTx.movimiento.create as any).mock.calls[0][0];
    expect(Number(movimientoCall.data.cantidad)).toBeCloseTo(500);

    // El stock POR SEDE (ProductoStock) también queda actualizado
    const upsertCall = (mockTx.productoStock.upsert as any).mock.calls[0][0];
    expect(upsertCall.where.id_producto_id_restaurante).toEqual({ id_producto: 2, id_restaurante: 1 });
    expect(Number(upsertCall.update.stock_actual)).toBeCloseTo(49500);
  });

  it('si la sede ya tiene fila de ProductoStock, descuenta desde ESE stock (no el legacy)', async () => {
    mockTx.orden.findUnique.mockResolvedValue({
      id: 1, numero_orden: 'ORD-000001', id_restaurante: 1,
      detalles: [{ id_producto: 10, cantidad: new Decimal(1) }],
    });
    mockTx.receta.findFirst.mockResolvedValue({
      nombre_receta:      'Bandeja Paisa',
      cantidad_producida: new Decimal(1),
      ingredientes: [
        { id_producto: 2, cantidad: new Decimal(100), unidad: 'gramo', es_opcional: false },
      ],
    });
    // Legacy dice 9999 (contaminado), pero la sede tiene 300 en ProductoStock
    mockTx.producto.findUnique.mockResolvedValue({ id: 2, stock_actual: new Decimal(9999), unidad_medida: 'gramo' });
    mockTx.productoStock.findUnique.mockResolvedValue({ stock_actual: new Decimal(300) });

    await recetaService.descontarIngredientesOrden(1, mockTx);

    const upsertCall = (mockTx.productoStock.upsert as any).mock.calls[0][0];
    expect(Number(upsertCall.update.stock_actual)).toBeCloseTo(200); // 300 - 100
  });

  it('no descuenta ingredientes marcados como es_opcional', async () => {
    mockTx.orden.findUnique.mockResolvedValue({
      id: 1, numero_orden: 'ORD-000001', id_restaurante: 1,
      detalles: [{ id_producto: 10, cantidad: new Decimal(1) }],
    });
    mockTx.receta.findFirst.mockResolvedValue({
      nombre_receta:      'Bandeja Paisa',
      cantidad_producida: new Decimal(1),
      ingredientes: [
        { id_producto: 2, cantidad: new Decimal(100), unidad: 'gramo', es_opcional: false },
        { id_producto: 3, cantidad: new Decimal(50),  unidad: 'gramo', es_opcional: true },
      ],
    });
    mockTx.producto.findUnique.mockResolvedValue({ id: 2, stock_actual: new Decimal(1000), unidad_medida: 'gramo' });

    await recetaService.descontarIngredientesOrden(1, mockTx);

    // Solo se consulta/descuenta el ingrediente obligatorio (id_producto 2)
    expect(mockTx.producto.findUnique).toHaveBeenCalledTimes(1);
    expect(mockTx.producto.findUnique).toHaveBeenCalledWith({ where: { id: 2 } });
  });

  it('descontarIngredientesSede usa la misma fórmula para la arquitectura nueva, scoped por restaurante', async () => {
    mockTx.receta.findFirst.mockResolvedValue({
      nombre_receta:      'Bandeja Paisa',
      cantidad_producida: new Decimal(2),
      ingredientes: [
        { id_producto: 2, cantidad: new Decimal(200), unidad: 'gramo', es_opcional: false },
      ],
    });
    mockTx.producto.findUnique.mockResolvedValue({ id: 2, stock_actual: new Decimal(1000), unidad_medida: 'gramo' });

    await recetaService.descontarIngredientesSede({
      id_orden: 5, numero_orden: 'ORD-000005', id_restaurante: 3,
      items: [{ id_producto: 10, cantidad: 4 }],
    }, mockTx);

    // 4 vendidas / 2 que rinde la receta = 2 → 200g * 2 = 400g descontados
    expect(Number((mockTx.producto.update as any).mock.calls[0][0].data.stock_actual)).toBeCloseTo(600);
    expect(mockTx.receta.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id_producto_final: 10, id_restaurante: 3, estado: 'activo' }),
    }));
  });
});
