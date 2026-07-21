/**
 * DemandaService — analiza el consumo histórico de cada producto en una sede
 * para calcular su tendencia de rotación y un stock ideal a comprar.
 *
 * Fuente: movimientos de salida real del inventario (venta, salida, merma,
 * producción). Las entradas/ajustes NO son consumo. Se comparan los últimos
 * 7 días contra los 21 previos para detectar si un producto se está moviendo
 * más o menos que antes y ajustar cuánto conviene tener en stock.
 *
 * Todo se calcula POR SEDE (id_restaurante) — nunca cruza tenants.
 */

import prisma from '../config/database';
import { TipoMovimiento } from '@prisma/client';

/** Tipos de movimiento que representan consumo (salida de stock por uso/venta). */
const TIPOS_CONSUMO: TipoMovimiento[] = [
  TipoMovimiento.venta,
  TipoMovimiento.salida,
  TipoMovimiento.merma,
  TipoMovimiento.produccion,
];

const VENTANA_RECIENTE_DIAS = 7;   // "cómo se mueve ahora"
const VENTANA_TOTAL_DIAS    = 28;  // historial completo considerado
const DIAS_COBERTURA_BASE   = 14;  // stock ideal = cubrir ~2 semanas de consumo
const AJUSTE_TENDENCIA      = 0.25; // ±25% del stock ideal según la tendencia

export type Tendencia = 'subiendo' | 'estable' | 'bajando' | 'sin_datos';

export interface DemandaProducto {
  id_producto:         number;
  consumo_total:       number;   // unidades consumidas en la ventana total
  consumo_diario:      number;   // promedio diario en la ventana total
  consumo_reciente:    number;   // promedio diario en los últimos 7 días
  tendencia:           Tendencia;
  /** Stock que conviene tener para cubrir la demanda esperada, ajustado por tendencia. */
  stock_ideal:         number;
}

/** Fila cruda del groupBy de movimientos de consumo. */
interface ConsumoRow {
  id_producto: number;
  reciente:    number;  // consumo en los últimos VENTANA_RECIENTE_DIAS
  previo:      number;  // consumo entre VENTANA_RECIENTE y VENTANA_TOTAL
}

export const demandaService = {

  /**
   * Calcula la demanda de todos los productos con consumo en la sede.
   * Devuelve un Map id_producto → DemandaProducto para lookup O(1).
   */
  async calcularDemandaSede(id_restaurante: number): Promise<Map<number, DemandaProducto>> {
    const ahora = new Date();
    const inicioReciente = new Date(ahora.getTime() - VENTANA_RECIENTE_DIAS * 86_400_000);
    const inicioTotal    = new Date(ahora.getTime() - VENTANA_TOTAL_DIAS    * 86_400_000);

    // Una sola consulta agregada: consumo reciente vs. previo por producto.
    // El FILTER separa ambas ventanas sin traer filas individuales.
    const rows = await prisma.$queryRaw<ConsumoRow[]>`
      SELECT
        m.id_producto,
        COALESCE(SUM(m.cantidad) FILTER (WHERE m.fecha_movimiento >= ${inicioReciente}), 0)::float AS reciente,
        COALESCE(SUM(m.cantidad) FILTER (WHERE m.fecha_movimiento <  ${inicioReciente}), 0)::float AS previo
      FROM   movimientos m
      WHERE  m.id_restaurante   = ${id_restaurante}
        AND  m.tipo_movimiento  = ANY(${TIPOS_CONSUMO}::"TipoMovimiento"[])
        AND  m.fecha_movimiento >= ${inicioTotal}
      GROUP BY m.id_producto
    `;

    const diasPrevios = VENTANA_TOTAL_DIAS - VENTANA_RECIENTE_DIAS;
    const mapa = new Map<number, DemandaProducto>();

    for (const row of rows) {
      const consumoTotal    = row.reciente + row.previo;
      const consumoDiario   = consumoTotal / VENTANA_TOTAL_DIAS;
      const diarioReciente  = row.reciente / VENTANA_RECIENTE_DIAS;
      const diarioPrevio    = row.previo   / diasPrevios;

      mapa.set(row.id_producto, {
        id_producto:      row.id_producto,
        consumo_total:    redondear(consumoTotal),
        consumo_diario:   redondear(consumoDiario),
        consumo_reciente: redondear(diarioReciente),
        tendencia:        clasificarTendencia(diarioReciente, diarioPrevio),
        stock_ideal:      calcularStockIdeal(consumoDiario, diarioReciente, diarioPrevio),
      });
    }

    return mapa;
  },

  /** Demanda de un único producto (por si se necesita puntual). */
  async calcularDemandaProducto(id_producto: number, id_restaurante: number): Promise<DemandaProducto | null> {
    const mapa = await this.calcularDemandaSede(id_restaurante);
    return mapa.get(id_producto) ?? null;
  },
};

/**
 * Clasifica la tendencia comparando el consumo diario reciente contra el previo.
 * Umbral del 20% para no marcar ruido como cambio de tendencia.
 */
function clasificarTendencia(diarioReciente: number, diarioPrevio: number): Tendencia {
  if (diarioReciente === 0 && diarioPrevio === 0) return 'sin_datos';
  // Producto que no se movía antes y ahora sí → claramente subiendo.
  if (diarioPrevio === 0) return diarioReciente > 0 ? 'subiendo' : 'estable';

  const ratio = diarioReciente / diarioPrevio;
  if (ratio >= 1.2) return 'subiendo';
  if (ratio <= 0.8) return 'bajando';
  return 'estable';
}

/**
 * Stock ideal = consumo diario × días de cobertura, corregido por tendencia:
 * si se está moviendo más de lo normal, se sube hasta +25%; si se está moviendo
 * menos, se baja hasta -25%. Un producto casi sin rotación termina con ideal bajo.
 */
function calcularStockIdeal(consumoDiario: number, diarioReciente: number, diarioPrevio: number): number {
  const base = consumoDiario * DIAS_COBERTURA_BASE;
  if (base <= 0) return 0;

  const tendencia = clasificarTendencia(diarioReciente, diarioPrevio);
  const factor =
    tendencia === 'subiendo' ? 1 + AJUSTE_TENDENCIA :
    tendencia === 'bajando'  ? 1 - AJUSTE_TENDENCIA :
    1;

  return Math.ceil(base * factor);
}

function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}
