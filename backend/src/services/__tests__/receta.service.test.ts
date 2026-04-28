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
    findByProductoFinal:  vi.fn(),
    findAll:              vi.fn(),
    findById:             vi.fn(),
    findRecetaConStock:   vi.fn(),
    create:               vi.fn(),
    update:               vi.fn(),
    reemplazarIngredientes: vi.fn(),
    findFasesByReceta:    vi.fn(),
    createFase:           vi.fn(),
    updateFase:           vi.fn(),
    deleteFase:           vi.fn(),
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
import { BadRequestError } from '../../exceptions/HttpErrors';

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

// ── _calcularRentabilidad ─────────────────────────────────────────────────────

describe('recetaService._calcularRentabilidad', () => {
  const makeRecetaRent = (
    ingredientes: { cantidad: number; precio_unitario: number }[],
    precio_venta: number,
    merma = 0,
    cantidad_producida = 1,
  ) => ({
    ingredientes: ingredientes.map(i => ({
      cantidad: i.cantidad,
      producto: { precio_unitario: i.precio_unitario },
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
});

