/**
 * events.ts — catálogo de eventos de dominio del sistema POS.
 *
 * Cada constante es el nombre del evento. Las interfaces definen
 * el payload tipado que se debe emitir/consumir.
 *
 * Convención: MODULO_ACCION (pasado → algo ya ocurrió)
 */

// ─── Nombres de eventos ───────────────────────────────────────────────────────

export const EVENTS = {
  // Órdenes (legado — mantener para compatibilidad)
  ORDEN_CREADA:           'orden.creada',
  ORDEN_ESTADO_CAMBIADO:  'orden.estado_cambiado',
  ORDEN_COMPLETADA:       'orden.completada',
  ORDEN_CANCELADA:        'orden.cancelada',

  // Nueva arquitectura de órdenes (multi-restaurante)
  ORDEN_GLOBAL_CREADA:    'orden.global.creada',     // Orden + sedes creadas
  SEDE_EN_PREPARACION:    'orden.sede.en_preparacion',
  SEDE_LISTA:             'orden.sede.lista',         // → activa saga de delivery
  ORDEN_LISTA:            'orden.global.lista',       // todas las sedes listas
  ORDEN_PAGADA:           'orden.global.pagada',      // → activa saga de entrega + stock
  ORDEN_ENTREGADA:        'orden.global.entregada',   // → activa saga de descuento stock
  SEDE_CANCELADA:         'orden.sede.cancelada',

  // Inventario
  STOCK_BAJO:             'inventario.stock_bajo',
  STOCK_AGOTADO:          'inventario.stock_agotado',
  LOTE_VENCIDO:           'lote.vencido',
  LOTE_PRODUCIDO:         'produccion.lote_producido',
  MOVIMIENTO_REGISTRADO:  'inventario.movimiento_registrado',

  // Caja
  CIERRE_COMPLETADO:      'caja.cierre_completado',

  // Feature flags
  FEATURE_FLAG_CAMBIADO:  'feature_flag.cambiado',
} as const;

export type EventName = typeof EVENTS[keyof typeof EVENTS];

// ─── Payloads tipados ─────────────────────────────────────────────────────────

export interface OrdenCreadaPayload {
  idOrden:        number;
  numeroOrden:    string;
  idRestaurante:  number;
  idGrupo?:       number;
  idCliente?:     number;
  tipoOrden:      string;
  total:          number;
  idOrdenGrupo?:  number;
}

export interface OrdenEstadoCambiadoPayload {
  idOrden:        number;
  numeroOrden:    string;
  idRestaurante:  number;
  idEstado:       number;
  nombreEstado:   string;
}

export interface OrdenCompletadaPayload {
  idOrden:        number;
  numeroOrden:    string;
  idRestaurante:  number;
  idGrupo?:       number;
  idCliente?:     number;
  total:          number;
  detalles: Array<{
    idProducto:     number;
    idVariante?:    number;
    cantidad:       number;
    precioUnitario: number;
    subtotal:       number;
  }>;
}

export interface OrdenCanceladaPayload {
  idOrden:        number;
  idRestaurante:  number;
}

export interface StockBajoPayload {
  idProducto:     number;
  idRestaurante:  number;
  nombreProducto: string;
  stockActual:    number;
  stockMinimo:    number;
}

export interface StockAgotadoPayload {
  idProducto:    number;
  idRestaurante: number;
  nombre:        string;
}

export interface LoteVencidoPayload {
  idLote:           number;
  idProducto:       number;
  idRestaurante:    number;
  nombreProducto:   string;
  fechaVencimiento: Date;
}

export interface MovimientoRegistradoPayload {
  idMovimiento:   number;
  idProducto:     number;
  idRestaurante?: number;
  tipoMovimiento: string;
  cantidad:       number;
}

export interface LoteProducidoPayload {
  idLote:         number;
  idProducto:     number;
  idRestaurante:  number;
  cantidadProducida: number;
}

export interface CierreCompletadoPayload {
  idCierre:       number;
  idRestaurante:  number;
  totalVentas:    number;
  diferencia:     number;
}

export interface FeatureFlagCambiadoPayload {
  nombre:     string;
  habilitado: boolean;
  accion:     'crear' | 'actualizar' | 'eliminar' | 'asignacion';
}

// ── Nueva arquitectura ────────────────────────────────────────────────────────

export interface OrdenGlobalCreadaPayload {
  idOrden:       number;
  numeroOrden:   string;
  idGrupo:       number;
  idCliente?:    number;
  tipoOrden:     string;
  total:         number;
  sedes: Array<{ idSede: number; idRestaurante: number; sufijo: string }>;
}

export interface SedeEnPreparacionPayload {
  idOrden:       number;
  idSede:        number;
  idRestaurante: number;
  sufijo?:       string;
}

export interface SedeListaPayload {
  idOrden:       number;
  idSede:        number;
  idRestaurante: number;
}

export interface OrdenListaPayload {
  idOrden:       number;
  numeroOrden:   string;
  idGrupo:       number;
  total:         number;
}

export interface OrdenPagadaPayload {
  idOrden:       number;
  numeroOrden:   string;
  idGrupo:       number;
  idCliente?:    number;
  total:         number;
  totalPagado:   number;
}

export interface OrdenEntregadaPayload {
  idOrden:       number;
  numeroOrden:   string;
  idGrupo:       number;
  sedes: Array<{
    idSede:        number;
    idRestaurante: number;
    items: Array<{ idProducto: number; idVariante?: number; cantidad: number }>;
  }>;
}

export interface SedeCanceladaPayload {
  idOrden:           number;
  idSede:            number;
  idRestaurante:     number;
  motivo?:           string;
  eraUnicaSede:      boolean;  // si true → Orden también cancelada
}
